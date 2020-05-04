import argparse
import logging
from pyramid.paster import get_app
from dcicutils.misc_utils import VirtualApp
from encoded.commands.variant_table_intake import MappingTableParser


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
        self.FIELD_TYPE_INDEX = 12
        self.INTEGER_FIELDS = ['no', 'column_priority', 'facet_priority']
        self.BOOLEAN_FIELDS = ['is_list', 'do_import']
        self.STRING_FIELDS.extend(['schema_title', 'description', 'comments', 'link', 'pattern'])
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
        gene_props['ensgid']['uniqueKey'] = True  # XXX: This is required for genes
        schema['properties'] = gene_props
        schema['properties']['schema_version'] = {'default': '1'}
        schema['facets'] = facets
        schema['columns'] = columns
        logger.info('Build gene schema')
        return schema

    def run(self, gs_out=None, write=True):
        """
        Ingests the gene table, producing the gene schema

        :param gs_out: path where to write the gene schema
        :param write: whether or not to actually write the schema (can do dry-run)
        :return: gene_annotation_field inserts
        """
        inserts = self.process_annotation_field_inserts()
        gene_props, columns, facets = self.generate_properties(inserts)
        gene_schema = self.generate_gene_schema(gene_props, columns, facets)
        if write:
            if not gs_out:
                raise GeneTableIntakeException('Write specified but no output file given')
            self.write_schema(gene_schema, gs_out)
            logger.info('Successfully wrote gene schema')
        return inserts


def main():
    """ Takes in the gene mapping table, produces + posts gene annotation fields and
        writes the gene schema.
    """
    logging.basicConfig()
    parser = argparse.ArgumentParser(
        description="Takes in a variant mapping table and produces variant related inserts/schemas",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('gene_table', help='path to gene table')
    parser.add_argument('gene_annotation_field_schema', help='path to gene annotation field schema')
    parser.add_argument('gene', help='where to write gene schema')
    parser.agg_argument('config_uri', help='path to app configfile')
    parser.add_argument('--app-name', help='Pyramid app name in configfile')
    parser.add_argument('--write-schema', action='store_true', default=False,
                        help='If specified will write schema to location')
    parser.add_argument('--post-inserts', action='store_true', default=False,
                        help='If specified will post inserts to portal')
    args = parser.parse_args()

    # read/process gene table, build inserts
    logger.info('Building gene annotation fields from mapping table %s' % args.gene_table)
    parser = GeneTableParser(args.gene_table, args.gene_annotation_field_schema)
    inserts = parser.run(gs_out=args.gene, write=args.write_schema)

    # if not a dry run try to post inserts
    if args.post_inserts:
        environ = {
            'HTTP_ACCEPT': 'application/json',
            'REMOTE_USER': 'TEST',
        }
        app = get_app(args.config_uri, args.app_name)
        app_handle = VirtualApp(app, environ)
        for entry in inserts:
            app_handle.post_json('/gene_annotation_field', entry)
        logger.info('Successfully posted gene annotations')


if __name__ == '__main__':
    main()
