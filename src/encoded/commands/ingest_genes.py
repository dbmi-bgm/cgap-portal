import json


class GeneIngestion(object):
    """ Class that encapsulates data/methods for ingesting genes """

    def __init__(self, location):
        self.genes_to_ingest = json.load(open(location, 'r'))

    def __len__(self):
        return len(self.genes_to_ingest)

    def __iter__(self):
        for gene in self.genes_to_ingest:
            yield gene

    def __getitem__(self, item):
        return self.genes_to_ingest[item]
