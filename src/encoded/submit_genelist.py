import itertools
import json
from base64 import b64encode

from .util import s3_local_file


def submit_genelist(
        *,
        s3_client,
        bucket,
        key,
        project,
        institution,
        vapp,
        validate_only=False
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
                'success': False,
                'validation_output': [],
                'result': {},
                'post_output': [],
                'upload_info': []
        }
        if filename.endswith('.txt'):
            genelist = GeneListSubmission(filename, project, institution, vapp) 
            if genelist.post_output:
                results['success'] = True
                results['validation_output'] = genelist.validation_output
                results['result'] = {
                        'Gene list title': genelist.title,
                        'Number of genes in gene list': len(genelist.gene_ids),
                        'Document title': ''
                }
                results['post_output'] = genelist.post_output
                return results
            else:
                results['validation_output'] = genelist.errors
                return results
        else:
            msg = 'Gene list must be a .txt file.'
            results['validation_output'].append(msg)
            return results


class GeneListSubmission:
    """
    Class to handle processing of submitted gene list.
    """

    def __init__(self, filename, project, institution, vapp):
        self.filename = filename
        self.project = project['@id']
        self.instutition = institution['@id']
        self.vapp = vapp
        self.genes, self.title = self.parse_genelist()
        self.gene_ids = self.match_genes()
        self.jsons_to_post = self.create_jsons_to_post()
        self.validation_output = self.validate_postings()
        self.post_output = self.post_items()
        self.errors = []

    def parse_genelist(self):
        """
        Parses gene list file and removes any duplicates.

        Assumes gene list is txt file with line-separated title/genes.

        Returns one of:
            - a unique gene list & gene list title
            - None & None if gene list is empty or no title found
        """

        with open(self.filename, 'r') as genelist_file:
            genelist_raw = genelist_file.readlines()
        for line in genelist_raw:
            if 'Title' in line:
                title_line = line
                title_idx = title_line.index('Title')
                title_line = title_line[title_idx+5:]
                title_line = title_line.translate(
                        {ord(i): None for i in ':;"\n"'}
                )
                title = title_line.strip()
                genelist_raw.remove(line)
                break
        if not title:
            self.errors.append('No title found for the gene list.')
            return None, None
        genelist = []
        for line in genelist_raw:
            line = line.translate({ord(i): None for i in '"\t""\n":;'})
            genelist.append(line.strip())
        while '' in genelist:
            genelist.remove('')
        if len(genelist) != len(set(genelist)):
            unique_genes = []
            for gene in genelist:
                if gene not in unique_genes:
                    unique_genes.append(gene)
            genelist = unique_genes
        if not genelist:
            self.errors.append('The gene list appears to be empty.')
            return None, None
        return genelist, title

    def match_genes(self):
        """
        Attempts to match every gene to unique gene item in CGAP.

        Matches by gene symbol, alias symbol, previous symbol, and genereviews
        symbol, in that order. If multiple genes in the given gene list direct
        to the same gene item, only one instance is included, so the gene list
        produced may be shorter than the one submitted.

        Returns one of:
            - list of gene uuids in alphabetical order
            - None if no genes were passed in or >= 1 gene could not be matched
        """

        if not self.genes:
            return None
        gene_ids = {}
        unmatched_genes = {}
        for gene in self.genes:
            response = self.vapp.get(
                    '/search/?type=Gene&gene_symbol=' + gene + '&field=@id',
            ).json
            if len(response) == 1:
                if response[0]['@id'] in gene_ids:
                    continue
                else:
                    gene_ids[gene] = response[0]['@id']
            else:
                unmatched_genes[gene] = len(response)
        if unmatched_genes:
            genes_without_options = []
            genes_with_options = []
            for gene in unmatched_genes.copy():
                response = self.vapp.get('/search/?type=Gene&q=' + gene).json
                import pdb
                pdb.set_trace()
                if len(response) >= 1:
                    search_order = [
                            'alias_symbol',
                            'prev_symbol',
                            'genereviews'
                    ]
                    for search_term, response_item in \
                            itertools.product(search_order, response):
                        if (
                            search_term in response_item.keys()
                            and gene in response_item[search_term]
                        ):
                            if response_item['@id'] in \
                                    list(gene_ids.values()):
                                break   
                            else:
                                gene_ids[gene] = response_item['@id']
                                unmatched_genes.pop(gene)
                    if gene in unmatched_genes:
                        options = []
                        for possible_match in response:
                            options.append(possible_match['gene_symbol'])
                        genes_with_options.append({gene: options})
                else: 
                    genes_without_options.append(gene)
        if unmatched_genes:
            if genes_without_options:
                self.errors.append(
                        'The gene(s) %s could not be found in our database.'
                        % ', '.join(genes_without_options)
                )
            if genes_with_options:
                for gene in genes_with_options:
                    self.errors.append(
                            'No perfect match found for gene %s. '
                            'Consider replacing with one of the following: %s.'
                            % (gene, ', '.join(genes_with_options[gene])))
            return None
        gene_ids = {
            dict_key: gene_ids[dict_key]
            for dict_key in sorted(gene_ids.keys())
        }
        return list(gene_ids.values())

    def create_jsons_to_post(self):
        """
        Creates gene list and document jsons for posting. 

        Returns one of:
            - List of jsons [document, gene list]
            - None if no input
        """

        if not self.gene_ids:
            return None
        with open(self.filename, 'rb') as stream:
            attach = {
                'download': self.filename.split('/')[-1],
                'type': 'text/plain',
                'href': (
                    'data:%s;base64,%s'
                    % ('text/plain', b64encode(stream.read()).decode('ascii'))
                )
            }
        document_post_body = json.dumps(
            {
                'institution': self.institution,
                'project': self.project,
                'status': 'shared',
                'attachment': attach
            }
        )
        genelist_post_body = json.dumps(
            {
                'title': self.title + ' (%s)' % len(self.gene_ids),
                # 'source_file': ?
                'institution': self.institution,
                'project': self.project,
                'genes': self.gene_ids,
                'status': 'shared',
            }
        )
        return [document_post_body, genelist_post_body]

    def validate_posting(self):
        """
        Attempts to validate document and gene list jsons provided by
        jsons_to_post.

        May need to be updated when handling overwriting of previous files as
        is only set to post at the moment. 

        Returns one of:
            - 'success' if both documents validated
            - None if no jsons were created or validation failed
        """

        if not self.jsons_to_post:
            return None
        document_json = self.jsons_to_post[0]
        genelist_json = self.jsons_to_post[1]
        try:
            self.vapp.post_json('/Document/?check_only=true', document_json)
        except Exception:
            self.errors.append('Document validation failed')
            return None
        try:
            self.vapp.post_json('/GeneList/?check_only=true', genelist_json)
        except Exception:
            self.errors.append('Gene list validation failed.')
            return None
        return 'success'

    def post_items(self):
        """
        Attempts to post document and gene list jsons to CGAP.

        Returns one of:
            - 'success'
            - None if no jsons were created or posting failed
        """

        if not self.jsons_to_post:
            return None
        document_json = self.jsons_to_post[0]
        genelist_json = self.jsons_to_post[1]
        try:
            document_post = self.vapp.post_json('/Document/', document_json)
        except Exception:
            self.errors.append('Posting document failed.')
            return None
        # Add in document_post uuid to genelist_json source file so can be
        # posted. 
        try:
            self.vapp.post_json('/GeneList/', genelist_json)
        except Exception:
            self.errors.append('Posting gene list failed.')
            return None
        return 'success'

# Features to add/work on:
#     * Create error class to handle all errors? Seems overboard here.
#     * Handle overwriting existing document and gene list
#     * Handle duplication within gene list (both duplicates in raw gene list and
#         mulitple genes of different name that refer to same gene in database)
#     * How to handle title input (either in input document vs via UI?)
#     * Need to add document posted uuid to genelist post body before posting
