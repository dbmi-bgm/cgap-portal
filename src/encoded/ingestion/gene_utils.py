import json
from tqdm import tqdm
from pyramid.httpexceptions import HTTPConflict
from .common import CGAP_CORE_PROJECT, CGAP_CORE_INSTITUTION


class GeneIngestion(object):
    """ Class that encapsulates data/methods for ingesting genes.
        Note that this consists of nothing except a reference to the file containing
        JSON and some Python operators that make manipulation convenient.
    """
    GENE_ENDPOINT = '/gene'

    def __init__(self, location):
        """ Note that this load could potentially be very expensive. Should not be done
            ever as part of a request.
        """
        self.genes_to_ingest = json.load(open(location, 'r'))

    def __len__(self):
        return len(self.genes_to_ingest)

    def __iter__(self):
        for gene in self.genes_to_ingest:
            yield gene

    def __getitem__(self, item):
        return self.genes_to_ingest[item]

    def upload(self, vapp, project=CGAP_CORE_PROJECT, institution=CGAP_CORE_INSTITUTION, use_tqdm=False):
        """ Uploads all (or some if a failure occurs) of the genes

        :param vapp: VirtualApp from dcicutils to post to
        :param project: project to attach to these genes
        :param institution: institution to attach to these genes
        :param use_tqdm: boolean on whether or not to show a progress bar
        :raises: VirtualAppError if a post is unsuccessful
        """
        if use_tqdm:
            _iter = tqdm(self.genes_to_ingest, unit='genes')
        else:
            _iter = self.genes_to_ingest
        for gene in _iter:
            gene['status'] = 'shared'  # default gene status to shared, so visible to everyone
            if project:
                gene['project'] = project
            if institution:
                gene['institution'] = institution
            try:
                vapp.post_json(self.GENE_ENDPOINT, gene, status=201)
            except HTTPConflict:  # XXX: PATCH on conflict - Should use put instead - See C4-272
                vapp.patch_json('/'.join([self.GENE_ENDPOINT, gene['ensgid']]), gene)
