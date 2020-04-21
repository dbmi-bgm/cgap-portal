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
