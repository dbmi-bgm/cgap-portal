import itertools
import re
from base64 import b64encode

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
        if filename.endswith(".txt"):
            genelist = GeneListSubmission(filename, project, institution, vapp)
            results["results"] = {
                "Gene list title": genelist.title,
                "Number of unique genes in gene list": (
                    0 if genelist.gene_ids is None else len(genelist.gene_ids)
                ),
            }
            if genelist.post_output:
                results["success"] = True
                results["validation_output"] = genelist.validation_output
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

    def __init__(self, filename, project, institution, vapp):
        self.filename = filename
        self.project = project["uuid"]
        self.institution = institution["uuid"]
        self.vapp = vapp
        self.errors = []
        self.genes, self.title = self.parse_genelist()
        self.gene_ids = self.match_genes()
        self.post_bodies = self.create_post_bodies()
        self.validation_output = self.validate_postings()
        self.post_output = self.post_items()

    def parse_genelist(self):
        """
        Parses gene list file, extracts title, and removes any duplicate genes.

        Assumes gene list is txt file with line-separated title/genes.

        Returns:
            - a unique gene list (None if empty)
            - gene list title (None if not found or project already has a gene
              list of the same title)
        """

        with open(self.filename, "r") as genelist_file:
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
                genelist_raw.remove(line)
                break
        if not title:
            title = None
            self.errors.append("No title found for the gene list.")
        genelist = []
        for line in genelist_raw:
            line = line.translate({ord(i): None for i in '"\t""\n":;'})
            genelist.append(line.strip())
        while "" in genelist:
            genelist.remove("")
        if len(genelist) != len(set(genelist)):
            unique_genes = []
            for gene in genelist:
                if gene not in unique_genes:
                    unique_genes.append(gene)
            genelist = unique_genes
        if not genelist:
            genelist = None
            self.errors.append("The gene list appears to be empty.")
        return genelist, title

    def match_genes(self):
        """
        Attempts to match every gene to unique gene item in CGAP.

        Matches by gene symbol, alias symbol, previous symbol, genereviews
        symbol, Ensembl ID, OMIM ID, Entrez ID, and UniProt ID, in that order.
        If multiple genes in the given gene list direct to the same gene item,
        only one instance is included, so the gene list produced may be shorter
        than the one submitted.

        Returns one of:
            - list of gene uuids in alphabetical order
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
                if len(response) == 1:
                    if response[0]["@id"] in gene_ids:
                        continue
                    else:
                        gene_ids[gene] = response[0]["@id"]
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
                            if response_item["@id"] in list(gene_ids.values()):
                                unmatched_genes.remove(gene)
                                break
                            else:
                                gene_ids[gene] = response_item["@id"]
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
        gene_ids = {
            dict_key: gene_ids[dict_key]
            for dict_key in sorted(gene_ids.keys())
        }
        return list(gene_ids.values())

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
            attach = {
                "download": self.filename.split("/")[-1],
                "type": "text/plain",
                "href": (
                    "data:%s;base64,%s"
                    % ("text/plain", b64encode(stream.read()).decode("ascii"))
                ),
            }
        document_post_body = {
            "institution": self.institution,
            "project": self.project,
            "status": "shared",
            "attachment": attach,
        }
        genelist_post_body = {
            "title": self.title + " (%s)" % len(self.gene_ids),
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

        May need to be updated when handling overwriting of previous files as
        is only set to post at the moment.

        Returns one of:
            - 'success' if both documents validated
            - None if no jsons were created or validation failed
        """

        if not self.post_bodies:
            return None
        result = "success"
        document_json = self.post_bodies[0]
        genelist_json = self.post_bodies[1]
        try:
            self.vapp.post_json("/Document/?check_only=true", document_json)
        except Exception as e:
            self.errors.append("Document validation failed: " + str(e))
            result = None
        try:
            self.vapp.post_json("/GeneList/?check_only=true", genelist_json)
        except Exception as e:
            self.errors.append("Gene list validation failed: " + str(e))
            result = None
        # Ensure gene list and document titles are unique. If not, notify
        # submitter and add error message.
        if self.title:
            try:
                project_genelists = self.vapp.get(
                    "/search/?type=GeneList"
                    "&project.uuid=" + self.project + "&field=title"
                ).json["@graph"]
                project_titles = [x["title"] for x in project_genelists]
                title_exist_msg = (
                    "A gene list of this name is already associated with "
                    "your project. If you would like to update an already "
                    "existing gene list, please delete the existing "
                    "version and then resubmit."
                )
                for previous_title in project_titles:
                    title_count = re.findall(r"\(\d{1,}\)", previous_title)
                    if not title_count:
                        if self.title == previous_title:
                            self.errors.append(title_exist_msg)
                            break
                        else:
                            continue
                    title_count = title_count[-1]
                    title_count_idx = previous_title.index(title_count)
                    previous_title_stripped = previous_title[
                        :title_count_idx
                    ].strip()
                    if self.title == previous_title_stripped:
                        self.errors.append(title_exist_msg)
                        break
                    else:
                        continue
            except Exception:
                pass
        try:
            project_documents = self.vapp.get(
                "/search/?type=Document"
                "&project.uuid=" + self.project + "&field=display_title"
            ).json["@graph"]
            project_docs = [x["display_title"] for x in project_documents]
            doc_exist_msg = (
                "A document of this name is already associated with "
                "your project. If you would like to update an already "
                "existing document, please delete the existing "
                "version and then resubmit."
            )
            if self.filename.split("/")[-1] in project_docs:
                self.errors.append(doc_exist_msg)
        except Exception:
            pass
        return result

    def post_items(self):
        """
        Attempts to post document and gene list.

        Returns one of:
            - 'success'
            - None if validation failed (or didn't occur) or other errors
              occurred during processing
        """

        if not self.validation_output or self.errors:
            return None
        result = "success"
        document_json = self.post_bodies[0]
        genelist_json = self.post_bodies[1]
        try:
            document_post = self.vapp.post_json(
                "/Document/", document_json
            ).json
        except Exception as e:
            self.errors.append("Posting document failed: " + str(e))
            result = None
        # Add in document_post uuid to genelist_json source file so can be
        # posted.
        if document_post["status"] == "success":
            genelist_json["source_file"] = document_post["@graph"][0]["@id"]
            try:
                self.vapp.post_json("/GeneList/", genelist_json)
            except Exception as e:
                self.errors.append("Posting gene list failed: " + str(e))
                result = None
        return result
