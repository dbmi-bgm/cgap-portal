import json


class GeneIngestion(object):
    """ Class that encapsulates data/methods for ingesting genes.
        Note that this consists of nothing except a reference to the file containing
        JSON and some Python operators that make manipulation convenient.
    """

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
