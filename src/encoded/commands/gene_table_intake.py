import csv
import six
import json
import argparse
import logging
from .variant_table_intake import MappingTableParser
from collections import OrderedDict, Mapping

logger = logging.getLogger(__name__)
EPILOG = __doc__


class GeneTableIntakeException(Exception):
    """ Specific type of exception we'd like to throw if we fail in this stage
            due to an error with the table itself
        """
    pass


class GeneTableParser(MappingTableParser):
    """ Subclass of MappingTableParser that overrides methods required for any differences across tables. """

    def __init__(self, *args, **kwargs):
        super(GeneTableParser, self).__init__(*args, **kwargs)
        self.FIELD_TYPE_INDEX = 11
        self.INTEGER_FIELDS = ['no', 'column_priority', 'facet_priority']
        self.BOOLEAN_FIELDS = ['is_list', 'do_import']
        self.NAME_FIELD = 'field_name'

    def generate_gene_schema(self, gene_props, columns, facets):
        """
        Builds gene.json schema based on gene_props

        :param gene_props: dictionary of 'properties' based on the gene fields
        :param columns: columns to attach
        :param facets: facets to compute
        :return: gene schema
        """
        schema = {}
        self.add_default_schema_fields(schema)
        schema['title'] = 'Genes'
        schema['description'] = "Schema for Genes"
        schema['id'] = '/profiles/gene.json'
        schema['properties'] = gene_props
        schema['properties']['schema_version'] = {'default': '1'}
        schema['facets'] = facets
        schema['columns'] = columns
        logger.info('Build gene schema')
        return schema