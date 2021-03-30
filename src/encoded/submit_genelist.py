import re
from base64 import b64encode

from dcicutils.misc_utils import VirtualAppError
from openpyxl import load_workbook
from webtest import AppError

from .util import s3_local_file


def submit_genelist(
    *, s3_client, bucket, key, project, institution, vapp, validate_only=False
):
    """
    Handles processing of a submitted gene list.

    Args:
        s3_client: a boto3 s3 client object
        bucket: the name of the s3 bucket that contains the data to be
            processed
        key: the name of a key within the given bucket that contains the data
            to be processed
        project: a project identifier
        institution: an institution identifier
        vapp: a vapp object
        validate_only: a bool. If True, only do validation, not posting;
            otherwise (if False), do posting, too.
    """

    with s3_local_file(s3_client, bucket=bucket, key=key) as filename:
        results = {
            "success": False,
            "validation_output": [],
            "result": {},
            "post_output": [],
            "upload_info": [],
        }
        if filename.endswith((".txt", ".xlsx")):
            genelist = GeneListSubmission(
                filename, project, institution, vapp, validate_only
            )
            if validate_only:
                if genelist.errors:
                    results["validation_output"] = genelist.errors
                else:
                    results["success"] = True
                    results["validation_output"] = (
                        genelist.validation_output + genelist.notes
                    )
            elif genelist.post_output:
                results["success"] = True
                results["validation_output"] = (
                    genelist.validation_output + genelist.notes
                )
                results["post_output"] = genelist.post_output
            else:
                results["validation_output"] = genelist.errors
        else:
            msg = "Gene list must be a .txt or .xlsx file."
            results["validation_output"].append(msg)
        return results


class GeneListSubmission:
    """
    Class to handle processing of submitted gene list.
    """

    def __init__(
        self, filename, project, institution, vapp, validate_only=False
    ):
        self.filename = filename
        self.project = project
        self.institution = institution
        self.vapp = vapp
        self.errors = []
        self.notes = []
        self.genes, self.title = self.parse_genelist()
        self.gene_ids = self.match_genes()
        self.post_bodies = self.create_post_bodies()
        (
            self.validation_output,
            self.patch_genelist_uuid,
            self.patch_document_uuid,
            self.previous_gene_ids,
        ) = self.validate_postings()
        if not validate_only:
            self.post_output = self.post_items()
            self.submit_variant_update()

    @staticmethod
    def extract_txt_file(txt_file):
        """
        Parses a .txt file for genes and title. For every non-empty line,
        assumes the line is a title if it contains the word "Title"; otherwise,
        line is assumed to be a gene.

        Returns:
            - title string
            - list of genes
        """
        title = None
        genelist = []
        with open(txt_file, "r") as genelist_file:
            genelist_raw = genelist_file.readlines()
        for line in genelist_raw:
            if "title" in line.lower():
                title_line = line
                title_idx = title_line.lower().index("title")
                title_line = title_line[title_idx + 5 :]
                title_line = title_line.translate(
                    {ord(i): None for i in ':;"\n"'}
                )
                title = title_line.strip()
                if title == "":
                    title = None
                genelist_raw.remove(line)
                break
        for line in genelist_raw:
            line = line.translate({ord(i): None for i in '"\t""\n":;'})
            genelist.append(line.strip())
        return title, genelist

    @staticmethod
    def extract_xlsx_file(xlsx_file):
        """
        Parses a .xlsx file for genes and title. Assumes headers "Genes" and
        "Title" are in the first row of document and will take the title from
        the first row below the title header and genes from all non-empty rows
        beneath the genes header.

        Returns:
            - title string
            - list of genes
        """
        title = None
        genelist = []
        wb = load_workbook(xlsx_file)
        sheet = wb.worksheets[0]
        for col in sheet.iter_cols(values_only=True):
            if col[0] is not None:
                if "Title" in col[0]:
                    title = str(col[1]).strip()
                if "Genes" in col[0]:
                    for cell in col[1:]:
                        if cell is not None:
                            genelist.append(str(cell).strip())
        return title, genelist

    def parse_genelist(self):
        """
        Parses gene list file, extracts title, and removes any duplicate genes.

        Assumes gene list is txt file with line-separated title/genes or an
        xlsx file with standard formatting defined.

        Returns:
            - gene list title (None if not found)
            - a unique gene list (possibly empty)
        """

        title = None
        genelist = []
        if self.filename.endswith(".txt"):
            title, genelist = self.extract_txt_file(self.filename)
        elif self.filename.endswith(".xlsx"):
            title, genelist = self.extract_xlsx_file(self.filename)
        if title:
            title = title.translate({ord(i): None for i in "'+&!?=%/"}).strip()
        else:
            self.errors.append(
                "No title was found in the gene list. Please check the "
                "formatting of the submitted document."
            )
        genelist = [x for x in genelist if x != ""]
        genes_with_spaces = []
        for gene in genelist.copy():
            if " " in gene:
                genelist.remove(gene)
                genes_with_spaces.append(gene)
        if genes_with_spaces:
            self.errors.append(
                "Gene symbols/IDs should not contain spaces. Please reformat "
                "the following gene entries: %s" % ", ".join(genes_with_spaces)
            )
        if not genelist:
            self.errors.append(
                "No genes were found in the gene list. Please check the "
                "formatting of the submitted document"
            )
        genelist = list(set(genelist))
        return genelist, title

    def match_genes(self):
        """
        Attempts to match every unique gene to unique gene item in CGAP.

        Matches by gene symbol, alias symbol, previous symbol, genereviews
        symbol, OMIM ID, Entrez ID, and UniProt ID, in that order.
        If an Ensembl ID is given, searches for a direct match, and if not
        found no additional search done given strange query behavior.
        If multiple genes in the given gene list direct to the same gene item,
        only one instance is included, so the gene list produced may be shorter
        than the one submitted.

        Returns one of:
            - list of gene uuids in CGAP gene title alphabetical order
            - None if no genes were passed in or >= 1 gene could not be matched
        """

        if not self.genes:
            return None
        ensgids = []
        non_ensgids = []
        gene_ids = {}
        gene_ensgids = {}
        unmatched_genes_without_options = []
        for gene in self.genes:
            if re.fullmatch(r"ENSG\d{11}", gene):
                ensgids.append(gene)
            else:
                non_ensgids.append(gene)
        if ensgids:
            ensgid_search = CommonUtils.batch_search(
                ensgids, "ensgid", self.vapp, batch_size=10
            )
            for response in ensgid_search:
                if response["gene_symbol"] in gene_ids:
                    gene_ids[response["gene_symbol"]].append(response["uuid"])
                    gene_ensgids[response["gene_symbol"]].append(
                        response["ensgid"]
                    )
                else:
                    gene_ids[response["gene_symbol"]] = [response["uuid"]]
                    gene_ensgids[response["gene_symbol"]] = [
                        response["ensgid"]
                    ]
                ensgids.remove(response["ensgid"])
            if ensgids:
                unmatched_genes_without_options += ensgids
        if non_ensgids:
            search_order = [
                "gene_symbol",
                "alias_symbol",
                "prev_symbol",
                "genereviews",
                "omim_id",
                "entrez_id",
                "uniprot_ids",
            ]
            for search_type in search_order:
                if not non_ensgids:
                    break
                search = CommonUtils.batch_search(
                    non_ensgids, search_type, self.vapp, batch_size=10
                )
                for response in search:
                    if (
                        response["gene_symbol"] in gene_ids
                        and response["uuid"]
                        not in gene_ids[response["gene_symbol"]]
                    ):
                        gene_ids[response["gene_symbol"]].append(
                            response["uuid"]
                        )
                        gene_ensgids[response["gene_symbol"]].append(
                            response["ensgid"]
                        )
                        responsible_gene = response[search_type]
                        if type(response[search_type]) is list:
                            for item in response[search_type]:
                                if item in gene_ensgids:
                                    responsible_gene = item
                                    break
                        self.notes.append(
                            "Note: gene %s refers to multiple genes "
                            "in our database, including genes with "
                            "the following Ensembl IDs: %s. If you "
                            "would prefer to "
                            "only include one of these genes in this "
                            "gene list, please resubmit and replace "
                            "the gene %s with one of "
                            "the Ensembl IDs above."
                            % (
                                responsible_gene,
                                ", ".join(gene_ensgids[responsible_gene]),
                                responsible_gene,
                            )
                        )
                        continue
                    else:
                        gene_ids[response["gene_symbol"]] = [response["uuid"]]
                        gene_ensgids[response["gene_symbol"]] = [
                            response["ensgid"]
                        ]
                    if type(response[search_type]) is str:
                        non_ensgids.remove(response[search_type])
                    elif type(response[search_type]) is list:
                        for item in response[search_type]:
                            if item in non_ensgids:
                                non_ensgids.remove(item)
                                break
        if non_ensgids:
            for gene in non_ensgids:
                try:
                    response = self.vapp.get(
                        "/search/?type=Gene&q=" + gene
                    ).json["@graph"]
                    options = [option["gene_symbol"] for option in response]
                    self.errors.append(
                        "No perfect match found for gene %s. "
                        "Consider replacing with one of the following: %s."
                        % (gene, ", ".join(options))
                    )
                except (VirtualAppError, AppError):
                    unmatched_genes_without_options.append(gene)
        if unmatched_genes_without_options:
            self.errors.append(
                "The gene(s) %s could not be found in our database. "
                "Consider replacement with an alias name or an Ensembl ID."
                % ", ".join(unmatched_genes_without_options)
            )
        sorted_gene_names = sorted(gene_ids)
        matched_gene_uuids = []
        for gene_name in sorted_gene_names:
            matched_gene_uuids += gene_ids[gene_name]
        return matched_gene_uuids

    def create_post_bodies(self):
        """
        Creates gene list and document bodies for posting.

        Returns:
            - List of bodies to post: [document, gene list] (None if no matched
              genes)
        """

        if not self.gene_ids:
            return None
        with open(self.filename, "rb") as stream:
            if not self.title:
                self.title = "Stand_in_genelist"
            if self.filename.endswith("txt"):
                attach = {
                    "download": self.title.replace(" ", "_") + "_genelist.txt",
                    "type": "text/plain",
                    "href": (
                        "data:%s;base64,%s"
                        % (
                            "text/plain",
                            b64encode(stream.read()).decode("ascii"),
                        )
                    ),
                }
            elif self.filename.endswith("xlsx"):
                attach = {
                    "download": self.title.replace(" ", "_")
                    + "_genelist.xlsx",
                    "type": (
                        "application/vnd.openxmlformats-officedocument."
                        "spreadsheetml.sheet"
                    ),
                    "href": (
                        "data:%s;base64,%s"
                        % (
                            "application/vnd.openxmlformats-officedocument."
                            "spreadsheetml.sheet",
                            b64encode(stream.read()).decode("ascii"),
                        )
                    ),
                }
        document_post_body = {
            "institution": self.institution,
            "project": self.project,
            "status": "shared",
            "attachment": attach,
        }
        genelist_post_body = {
            "title": (
                self.title + " (%s)" % len(self.gene_ids)
                if self.title
                else "Stand in title"
            ),
            "institution": self.institution,
            "project": self.project,
            "genes": self.gene_ids,
            "status": "shared",
        }
        return [document_post_body, genelist_post_body]

    def validate_postings(self):
        """
        Attempts to validate document and gene list jsons provided by
        post_bodies.

        Gene lists of the same title belonging to the same project will be
        searched for, and if a match is discovered, the gene list and document
        will be patched and updated. If no match is found, a new document and
        gene list will be posted.

        Returns:
            - List with information on validation (None if no matched genes)
            - Previously existing gene list uuid (None if no match)
            - Previously existing document uuid (None if no match)
            - List of genes that were removed from the previous gene list (None
              if not applicable).
        """

        if not self.gene_ids:
            return None, None, None, None
        validate_result = {}
        genelist_uuid = None
        document_uuid = None
        previous_genelist_gene_ids = []
        document_json = self.post_bodies[0]
        genelist_json = self.post_bodies[1]
        if self.title:
            try:
                project_genelists = self.vapp.get(
                    "/search/?type=GeneList"
                    "&project.%40id="
                    + self.project.replace("/", "%2F")
                    + "&field=title&field=uuid&field=genes.uuid"
                ).json["@graph"]
                project_titles = [x["title"] for x in project_genelists]
                for previous_title in project_titles:
                    title_count = re.findall(r"\(\d{1,}\)", previous_title)
                    if not title_count:
                        if self.title == previous_title:
                            genelist_idx = project_titles.index(previous_title)
                            genelist_uuid = project_genelists[genelist_idx][
                                "uuid"
                            ]
                            genelist_gene_uuids = project_genelists[
                                genelist_idx
                            ]["genes"]
                            for gene_uuid in genelist_gene_uuids:
                                previous_genelist_gene_ids.append(
                                    gene_uuid["uuid"]
                                )
                            break
                        else:
                            continue
                    title_count = title_count[-1]
                    title_count_idx = previous_title.index(title_count)
                    previous_title_stripped = previous_title[
                        :title_count_idx
                    ].strip()
                    if self.title == previous_title_stripped:
                        genelist_idx = project_titles.index(previous_title)
                        genelist_uuid = project_genelists[genelist_idx]["uuid"]
                        genelist_gene_uuids = project_genelists[genelist_idx][
                            "genes"
                        ]
                        for gene_uuid in genelist_gene_uuids:
                            previous_genelist_gene_ids.append(
                                gene_uuid["uuid"]
                            )
                        break
                    else:
                        continue
            except VirtualAppError:
                pass
        try:
            project_documents = self.vapp.get(
                "/search/?type=Document"
                "&project.%40id="
                + self.project.replace("/", "%2F")
                + "&field=display_title&field=uuid"
            ).json["@graph"]
            project_docs = [
                x["display_title"].replace(".txt", "").replace(".xlsx", "")
                for x in project_documents
            ]
            doc_title = self.title.replace(" ", "_") + "_genelist"
            if doc_title in project_docs:
                document_idx = project_docs.index(doc_title)
                document_uuid = project_documents[document_idx]["uuid"]
        except VirtualAppError:
            pass
        if document_uuid:
            self.vapp.patch_json(
                "/Document/" + document_uuid + "?check_only=true",
                {"attachment": document_json["attachment"]},
            )
        else:
            self.vapp.post_json("/Document/?check_only=true", document_json)
        validate_result["Document"] = "validated"
        if genelist_uuid:
            self.vapp.patch_json(
                "/GeneList/" + genelist_uuid + "?check_only=true",
                {
                    "title": genelist_json["title"],
                    "genes": genelist_json["genes"],
                },
            )
        else:
            self.vapp.post_json("/GeneList/?check_only=true", genelist_json)
        validate_result["Gene list"] = "validated"
        validate_result["Title"] = self.title
        validate_result["Number of genes"] = len(genelist_json["genes"])
        validate_display = []
        for key in validate_result:
            validate_display.append("%s: %s" % (key, validate_result[key]))
        validate_result = validate_display
        return (
            validate_result,
            genelist_uuid,
            document_uuid,
            previous_genelist_gene_ids,
        )

    def post_items(self):
        """
        Attempts to post document and gene list.

        Returns:
            - List with posting information (None if errors earlier in
              processing).
        """

        if self.errors:
            return None
        post_result = {}
        document_json = self.post_bodies[0]
        genelist_json = self.post_bodies[1]
        if self.patch_document_uuid:
            document_post = self.vapp.patch_json(
                "/Document/" + self.patch_document_uuid,
                {"attachment": document_json["attachment"]},
            ).json
        else:
            document_post = self.vapp.post_json(
                "/Document/", document_json
            ).json
        post_result["Document"] = (
            "posted with uuid " + document_post["@graph"][0]["uuid"]
        )
        if document_post["status"] == "success":
            genelist_json["source_file"] = document_post["@graph"][0]["@id"]
            if self.patch_genelist_uuid:
                genelist_post = self.vapp.patch_json(
                    "/GeneList/" + self.patch_genelist_uuid,
                    {
                        "title": genelist_json["title"],
                        "genes": genelist_json["genes"],
                        "source_file": genelist_json["source_file"],
                    },
                ).json
            else:
                genelist_post = self.vapp.post_json(
                    "/GeneList/", genelist_json
                ).json
            post_result["Gene list"] = (
                "posted with uuid " + genelist_post["@graph"][0]["uuid"]
            )
        post_display = []
        for key in post_result:
            post_display.append("%s: %s" % (key, post_result[key]))
        post_result = post_display
        return post_result

    def submit_variant_update(self):
        """
        If gene list successfully posted, submit the matched gene uuids to the
        'variant_update' endpoint so they can be updated to reflect the new
        gene list.

        Updates self.post_output with message regarding success or failure.
        """
        if not self.post_output:
            return
        creation_post_url = "/IngestionSubmission"
        creation_post_data = {
            "ingestion_type": "variant_update",
            "project": self.project,
            "institution": self.institution,
            "processing_status": {"state": "submitted"},
        }
        creation_response = self.vapp.post_json(
            creation_post_url,
            creation_post_data,
            content_type="application/json",
        ).json
        submission_id = creation_response["@graph"][0]["@id"]
        submission_post_url = submission_id + "submit_for_ingestion"
        submission_post_data = {"validate_only": False}
        upload_file = [
            (
                "datafile",
                self.title.replace(" ", "_") + "_gene_ids",
                bytes("\n".join(self.gene_ids), encoding="utf-8"),
            )
        ]
        try:
            submission_response = self.vapp.wrapped_app.post(
                submission_post_url,
                submission_post_data,
                upload_files=upload_file,
                content_type="multipart/form-data",
            ).json
        except AttributeError:  # Catch unit test error
            submission_response = self.vapp.post(
                submission_post_url,
                submission_post_data,
                upload_files=upload_file,
                content_type="multipart/form-data",
            ).json
        if submission_response["success"]:
            self.post_output.append(
                "Variants should begin updating shortly but may take a few "
                "hours depending on server load."
            )
        else:
            self.post_output.append(
                "Variants were not queued for updating. Please reach out "
                "to the CGAP team and alert them of this issue."
            )
        return


def submit_variant_update(
    *, s3_client, bucket, key, project, institution, vapp, validate_only=False
):
    """
    Processes a submitted list of gene uuids to re-index associated variant
    samples.

    Args:
        s3_client: a boto3 s3 client object
        bucket: the name of the s3 bucket that contains the data to be
            processed
        key: the name of a key within the given bucket that contains the data
            to be processed
        project: a project identifier
        institution: an institution identifier
        vapp: a vapp object
        validate_only: a bool. If True, only do validation, not posting;
            otherwise (if False), do posting, too.

    Returns:
        results: information concerning output of processing
    """

    with s3_local_file(s3_client, bucket=bucket, key=key) as filename:
        results = {
            "success": False,
            "validation_output": [],
            "result": {},
            "post_output": [],
            "upload_info": [],
        }
        variant_update = VariantUpdateSubmission(
            filename, project, institution, vapp, validate_only
        )
        if validate_only:
            results["validation_output"] = variant_update.validate_output
        elif variant_update.post_output:
            results["success"] = True
            results["validation_output"] = variant_update.validate_output
            results["post_output"] = variant_update.post_output
        else:
            results["validation_output"] = variant_update.errors
        return results


class VariantUpdateSubmission:
    """
    Class to update all variant samples associated with a given
    list of gene uuids.
    """

    def __init__(
        self, filename, project, institution, vapp, validate_only=False
    ):
        self.filename = filename
        self.project = project
        self.institution = institution
        self.vapp = vapp
        self.errors = []
        self.gene_uuids = self.genes_from_file()
        self.variant_samples = self.find_associated_variants()
        self.json_post = self.create_post()
        self.validate_output = self.validate_post()
        if not validate_only:
            self.post_output = self.queue_variants_for_indexing()

    def genes_from_file(self):
        """
        Extracts gene uuids from input file. Expects gene uuids to be separated
        by '\n'.

        Returns:
            - List of gene uuids
        """
        gene_uuids = []
        with open(self.filename, "r") as genelist_file:
            genelist = genelist_file.readlines()
        for line in genelist:
            if line.endswith("\n"):
                line = line[:-1]
            gene_uuids.append(line)
        if not gene_uuids:
            self.errors.append("No gene uuids were found in the input file")
        return gene_uuids

    def find_associated_variants(self):
        """
        Finds associated variants and variant samples for the genes of
        interest.

        Returns:
            - List of unique variant and variant sample uuids (None if no gene
            uuids)
        """
        if not self.gene_uuids:
            return None
        variant_samples_to_index = []
        genes_to_search = list(set(self.gene_uuids))
        variant_sample_search = CommonUtils.batch_search(
            genes_to_search,
            "variant.genes.genes_most_severe_gene.uuid",
            self.vapp,
            item_type="VariantSample",
        )
        for variant_sample_response in variant_sample_search:
            variant_samples_to_index.append(variant_sample_response["uuid"])
        to_index = list(set(variant_samples_to_index))
        if not to_index:
            self.errors.append("No variant samples found for the given genes.")
        return to_index

    def create_post(self):
        """
        Returns:
            - Dict to post containing variant sample uuids (None if no
              variant samples found previously)
        """
        if not self.variant_samples:
            return None
        index_queue_post = {
            "uuids": self.variant_samples,
            "target_queue": "primary",
            "strict": True,
        }
        return index_queue_post

    def validate_post(self):
        """
        Validates posting to indexing queue.

        Returns:
            - String info about validation (None if no post created or
              validation failed)
        """
        if not self.json_post:
            return None
        validate_response = self.vapp.post_json(
            "/queue_indexing?validate_only=True", self.json_post
        )
        if validate_response.json["notification"] == "Success":
            validate_output = (
                "%s variant samples were validated for "
                "re-indexing" % str(len(self.variant_samples))
            )
        else:
            self.errors.append("Validation failed: " + validate_response.json)
            validate_output = None
        return validate_output

    def queue_variants_for_indexing(self):
        """
        Posts variant samples to indexing queue.

        Returns:
            - String info about post (None if validation failed or posting
              failed)
        """
        if not self.validate_output:
            return None
        post_response = self.vapp.post_json("/queue_indexing", self.json_post)
        if post_response.json["notification"] == "Success":
            post_output = (
                "%s variant samples were queued for "
                "re-indexing" % str(len(self.variant_samples))
            )
        else:
            self.errors.append("Posting failed: " + post_response.json)
            post_output = None
        return post_output


class CommonUtils:
    """
    For methods common to both submission endpoints above.
    """

    def __init__(self):
        pass

    @staticmethod
    def batch_search(
        item_list, search_term, app, item_type="Gene", batch_size=5
    ):
        """
        Performs get requests in batches to decrease the number of
        API calls and improve performance.

        Returns:
            - List of all items found by search
        """
        batch = []
        results = []
        flat_result = []
        for item in item_list:
            batch.append(item)
            if item == item_list[-1] or len(batch) == batch_size:
                batch_string = ("&" + search_term + "=").join(batch)
                try:
                    response = app.get(
                        "/search/?type="
                        + item_type
                        + "&"
                        + search_term
                        + "="
                        + batch_string
                    )
                    results.append(response.json["@graph"])
                except (VirtualAppError, AppError):
                    pass
                batch = []
        flat_result = [x for sublist in results for x in sublist]
        return flat_result
