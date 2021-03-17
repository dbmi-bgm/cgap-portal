import itertools
import re
from base64 import b64encode
from openpyxl import load_workbook

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
            msg = "Gene list must be a .txt file."
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
            self.variants_queued = self.queue_associated_variants()

    @staticmethod
    def extract_txt_file(txt_file):
        title = None
        genelist = []
        with open(txt_file, "r") as genelist_file:
            genelist_raw = genelist_file.readlines()
        for line in genelist_raw:
            if "title" in line.lower():
                title_line = line
                title_idx = title_line.lower().index("title")
                title_line = title_line[title_idx + 5:]
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
        title = None
        genelist = []
        wb = load_workbook(xlsx_file)
        sheet = wb.worksheets[0]
        for col in sheet.iter_cols(values_only=True):
            if col[0] is not None:
                if "Title" in col[0]:
                    title = col[1]
                if "Genes" in col[0]:
                    for cell in col[1:]:
                        if cell is not None:
                            genelist.append(cell)
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
        if not title:
            self.errors.append("No title found for the gene list.")
        while "" in genelist:
            genelist.remove("")
        if not genelist:
            self.errors.append("The gene list appears to be empty.")
        if len(genelist) != len(set(genelist)):
            unique_genes = []
            for gene in genelist:
                if gene not in unique_genes:
                    unique_genes.append(gene)
            genelist = unique_genes
        return genelist, title

    def match_genes(self):
        """
        Attempts to match every gene to unique gene item in CGAP.

        Matches by gene symbol, alias symbol, previous symbol, genereviews
        symbol, OMIM ID, Entrez ID, and UniProt ID, in that order.
        If multiple genes in the given gene list direct to the same gene item,
        only one instance is included, so the gene list produced may be shorter
        than the one submitted.

        Returns one of:
            - list of gene uuids in CGAP gene title alphabetical order
            - None if no genes were passed in or >= 1 gene could not be matched
        """

        if not self.genes:
            return None
        gene_ids = {}
        unmatched_genes = []
        unmatched_genes_without_options = []
        unmatched_genes_with_options = {}
        for gene in self.genes:
            try:
                response = self.vapp.get(
                    "/search/?type=Gene&gene_symbol=" + gene,
                ).json["@graph"]
                if len(response) >= 1:
                    for response_item in response:
                        if gene in gene_ids:
                            gene_ids[gene].append(response_item["uuid"])
                            self.notes.append(
                                "Note: gene %s refers to multiple genes in our "
                                "database." % gene
                            )
                        else:
                            gene_ids[gene] = [response_item["uuid"]]
                else:
                    unmatched_genes.append(gene)
            except Exception:
                unmatched_genes.append(gene)
        for gene in unmatched_genes.copy():
            try:
                response = self.vapp.get("/search/?type=Gene&q=" + gene).json[
                    "@graph"
                ]
                if len(response) >= 1:
                    search_order = [
                        "alias_symbol",
                        "prev_symbol",
                        "genereviews",
                        "omim_id",
                        "entrez_id",
                        "uniprot_ids",
                    ]
                    for search_term, response_item in itertools.product(
                        search_order, response
                    ):
                        if (
                            search_term in response_item.keys()
                            and gene in response_item[search_term]
                        ):
                            current_gene_uuids = [
                                uuid
                                for sublist in gene_ids.values()
                                for uuid in sublist
                            ]
                            if response_item["uuid"] in current_gene_uuids:
                                unmatched_genes.remove(gene)
                                break
                            else:
                                gene_ids[
                                    response_item["gene_symbol"]
                                ] = [response_item["uuid"]]
                                unmatched_genes.remove(gene)
                    if gene in unmatched_genes:
                        options = []
                        for possible_match in response:
                            options.append(possible_match["gene_symbol"])
                        unmatched_genes_with_options[gene] = options
                else:
                    unmatched_genes_without_options.append(gene)
            except Exception as e:
                unmatched_genes_without_options.append(gene)
                msg = "Error when searching for gene %s." % gene
                self.errors.append(msg + str(e))
        if unmatched_genes:
            if unmatched_genes_without_options:
                self.errors.append(
                    "The gene(s) %s could not be found in our database."
                    % ", ".join(unmatched_genes_without_options)
                )
            if unmatched_genes_with_options:
                for gene in unmatched_genes_with_options:
                    self.errors.append(
                        "No perfect match found for gene %s. "
                        "Consider replacing with one of the following: %s."
                        % (gene, ", ".join(unmatched_genes_with_options[gene]))
                    )
        sorted_gene_names = sorted(gene_ids)
        matched_gene_uuids = []
        for gene_name in sorted_gene_names:
            matched_gene_uuids += gene_ids[gene_name]
        return matched_gene_uuids

    def create_post_bodies(self):
        """
        Creates gene list and document bodies for posting.

        Returns one of:
            - List of bodies to post: [document, gene list]
            - None if no input
        """

        if not self.gene_ids:
            return None
        with open(self.filename, "rb") as stream:
            if self.filename.endswith("txt"):
                attach = {
                    "download": (
                        self.title.replace(" ", "_").replace("'", "")
                        + "_genelist.txt"
                        if self.title
                        else "Stand_in_genelist.txt"
                    ),
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
                    "download": (
                        self.title.replace(" ", "_").replace("'", "")
                        + "_genelist.xlsx"
                        if self.title
                        else "Stand_in_genelist.xlsx"
                    ),
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

        Returns one of:
            - Dict with information on validation, previously existing gene
              list uuid (None if no match), previously existing document
              uuid (None if no match), and list of genes that were removed from
              the previous gene list (None if not applicable).
            - None, None, None, None if no jsons were created in previous step
        """

        if not self.post_bodies:
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
            except Exception:
                pass
        try:
            project_documents = self.vapp.get(
                "/search/?type=Document"
                "&project.%40id="
                + self.project.replace("/", "%2F")
                + "&field=display_title&field=uuid"
            ).json["@graph"]
            project_docs = [x["display_title"] for x in project_documents]
            if document_json["attachment"]["download"] in project_docs:
                document_idx = project_docs.index(
                    document_json["attachment"]["download"]
                )
                document_uuid = project_documents[document_idx]["uuid"]
        except Exception:
            pass
        if document_uuid:
            try:
                self.vapp.patch_json(
                    "/Document/" + document_uuid + "?check_only=true",
                    {"attachment": document_json["attachment"]},
                )
                validate_result["Document"] = "success"
            except Exception as e:
                self.errors.append("Document validation failed: " + str(e))
        else:
            try:
                self.vapp.post_json(
                    "/Document/?check_only=true", document_json
                )
                validate_result["Document"] = "success"
            except Exception as e:
                self.errors.append("Document validation failed: " + str(e))
        if genelist_uuid:
            try:
                self.vapp.patch_json(
                    "/GeneList/" + genelist_uuid + "?check_only=true",
                    {
                        "title": genelist_json["title"],
                        "genes": genelist_json["genes"],
                    },
                )
                validate_result["Gene list"] = "success"
                validate_result["Title"] = self.title
                validate_result["Number of genes"] = len(
                    genelist_json["genes"]
                )
            except Exception as e:
                self.errors.append("Gene list validation failed: " + str(e))
        else:
            try:
                self.vapp.post_json(
                    "/GeneList/?check_only=true", genelist_json
                )
                validate_result["Gene list"] = "success"
                validate_result["Title"] = self.title
                validate_result["Number of genes"] = len(
                    genelist_json["genes"]
                )
            except Exception as e:
                self.errors.append("Gene list validation failed: " + str(e))
        if validate_result:
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

        Returns one of:
            - Dict with posting information
            - None if post failed (or didn't occur) or other errors
              occurred during prior processing
        """

        if self.errors or not self.validation_output:
            return None
        post_result = {}
        document_json = self.post_bodies[0]
        genelist_json = self.post_bodies[1]
        if self.patch_document_uuid:
            try:
                document_post = self.vapp.patch_json(
                    "/Document/" + self.patch_document_uuid,
                    {"attachment": document_json["attachment"]},
                ).json
                post_result["Document"] = "success"
            except Exception as e:
                self.errors.append("Document posting failed: " + str(e))
        else:
            try:
                document_post = self.vapp.post_json(
                    "/Document/", document_json
                ).json
                post_result["Document"] = "success"
            except Exception as e:
                self.errors.append("Document posting failed: " + str(e))
        if document_post["status"] == "success":
            genelist_json["source_file"] = document_post["@graph"][0]["@id"]
            if self.patch_genelist_uuid:
                try:
                    self.vapp.patch_json(
                        "/GeneList/" + self.patch_genelist_uuid,
                        {
                            "title": genelist_json["title"],
                            "genes": genelist_json["genes"],
                            "source_file": genelist_json["source_file"],
                        },
                    )
                    post_result["Gene list"] = "success"
                except Exception as e:
                    self.errors.append("Gene list posting failed: " + str(e))
            else:
                try:
                    self.vapp.post_json("/GeneList/", genelist_json)
                    post_result["Gene list"] = "success"
                except Exception as e:
                    self.errors.append("Gene list posting failed: " + str(e))
        if post_result:
            post_display = []
            for key in post_result:
                post_display.append("%s: %s" % (key, post_result[key]))
            post_result = post_display
        return post_result

    def queue_associated_variants(self):
        """
        If gene list successfully posted, queue variant(sample)s for indexing
        so they can be updated to reflect the new gene list.

        Returns one of:
            - 'success' if variants found and queued for indexing
            - None if otherwise
        """
        if not self.post_output:
            return None
        variants_to_index = []
        variant_samples_to_index = []
        genes_to_search = list(set(self.gene_ids + self.previous_gene_ids))
        for gene_id in genes_to_search:
            try:
                variant_search = self.vapp.get(
                    "/search/?type=Variant"
                    "&genes.genes_most_severe_gene.uuid="
                    + gene_id
                    + "&field=uuid"
                ).json
                if variant_search["@graph"]:
                    for variant_response in variant_search["@graph"]:
                        variants_to_index.append(variant_response["uuid"])
            except Exception:
                pass
            try:
                variant_sample_search = self.vapp.get(
                    "/search/?type=VariantSample"
                    "&variant.genes.genes_most_severe_gene.uuid="
                    + gene_id
                    + "&field=uuid"
                ).json
                if variant_sample_search["@graph"]:
                    for variant_sample_response in variant_sample_search[
                        "@graph"
                    ]:
                        variant_samples_to_index.append(
                            variant_sample_response["uuid"]
                        )
            except Exception:
                pass
        items_to_index = variants_to_index + variant_samples_to_index
        if items_to_index:
            index_queue_post = {
                "uuids": items_to_index,
                "target_queue": "primary",
                "strict": True,
            }
            post_response = self.vapp.post_json(
                "/queue_indexing", index_queue_post
            )
            if post_response.json["notification"] == "Success":
                return "success"
        else:
            return None
