import structlog
from base64 import b64decode
from pyramid.httpexceptions import HTTPUnprocessableEntity
from pyramid.paster import get_app
from pyramid.view import view_config
from snovault import (
    calculated_property,
    collection,
    load_schema,
    CONNECTION,
    display_title_schema
)
from snovault.util import debug_log
from webtest import TestApp
from .base import Item, get_item_or_none
from pandas import read_excel

log = structlog.getLogger(__name__)


@collection(
    name='genes',
    unique_key='gene:ensgid',
    properties={
        'title': 'Genes',
        'description': 'Gene items',
    })
class Gene(Item):
    """Gene class."""
    item_type = 'gene'
    name_key = 'ensgid'  # use the ENSEMBL Gene ID as the identifier
    schema = load_schema('encoded:schemas/gene.json')
    rev = {'gene_lists': ('GeneList', 'genes')}
    embedded_list = ['gene_lists.title']

    @calculated_property(schema={
        "title": "Display Title",
        "description": "Gene ID",
        "type": "string"
    })
    def display_title(self, gene_symbol):
        return gene_symbol

    @calculated_property(schema={
        "title": "Gene Lists",
        "description": "Gene Lists which this gene is part of",
        "type": "array",
        "items": {
            "title": "Gene List",
            "type": "string",
            "linkTo": "GeneList"
        }
    })
    def gene_lists(self, request):
        result = self.rev_link_atids(request, "gene_lists")
        if result:
            return result


@collection(
    name='gene-lists',
    properties={
        'title': 'Gene Lists',
        'description': 'Collection of Genes related to a condition'
    }
)
class GeneList(Item):
    """The class to store information about gene lists"""
    item_type = 'gene_list'
    schema = load_schema('encoded:schemas/gene_list.json')
    name_key = 'gene_list'
    embedded_list = []


@view_config(name='process-genelist', context=GeneList, request_method='PATCH',
             permission='edit')
@debug_log
def process_genelist(context, request):
    """
    Endpoint to process a file with list of genes in to a GeneList object,
    linked to Gene items in our database. Uses a webtest TestApp to handle
    PATCHing items. The request.json contains attachment information and
    file content.
    Expected file format:
        txt file with gene ids (gene_symbol) separated by new line
    For each provided gene id, there are 3 scenirios:
    1) We find a gene item with matching gene_symbol or ensemble gene id
    2) No match for gene_symbol, but the query with provided gene id returns gene items
    3) No result is returned with provided gene id as query
    If a match between the provided id and a gene_symbol is caught, its uuid is added to the list
    If not, a query results for the first 10 is provided with error, and the option gene_symbols for the provided gene id
    If the query does not return any results, that information is provided in the response
    Args:
        request (Request): the current request. Attachment data should be
            given in the request JSON.
    Returns:
        dict: reponse, including 'status', and 'gene_list' on success
    Raises:
        HTTPUnprocessableEntity: on an error. Extra information may be logged
    """
    genelist_item = str(context.uuid)  # used in logging
    # verify that attachment data in request.json has type and href
    if not {'download', 'type', 'href'} <= set(request.json.keys()):
        raise HTTPUnprocessableEntity('GeneList %s: Request JSON must include following'
                                      ' keys: download, type, href. Found: %s'
                                      % (genelist_item, request.json.keys()))

    # get user email for TestApp authentication
    email = getattr(request, '_auth0_authenticated', None)
    if not email:
        user_uuid = None
        for principal in request.effective_principals:
            if principal.startswith('userid.'):
                user_uuid = principal[7:]
                break
        if not user_uuid:
            raise HTTPUnprocessableEntity('GeneList %s: Must provide authentication' % genelist_item)
        user_props = get_item_or_none(request, user_uuid)
        email = user_props['email']
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': email}
    config_uri = request.params.get('config_uri', 'production.ini')
    app = get_app(config_uri, 'app')
    testapp = TestApp(app, environ)

    # run get genes function to extact list of ref_ids
    # titles should start with #, they will be ignored by gen_genes
    # expected output is list, if str is returned, it carries an error message
    genes = get_genes(request.json, genelist_item)
    if isinstance(genes, str):
        raise HTTPUnprocessableEntity(genes)

    # parse the file for genes
    response = {'title': 'GeneList Processing'}
    # extra values that are used when creating the pedigree
    gene_list_props = context.upgrade_properties()
    post_extra = {'project': gene_list_props['project'],
                  'institution': gene_list_props['institution']}
    # bail if the gene list already has genes
    # the logic here can change based on the expected behavior
    if gene_list_props.get('genes'):
        response['status'] = 'failure'
        response['detail'] = 'GeneList item already has genes, expected empty'
        return response

    # create Document for input genelist file
    data_href = 'data:%s;base64,%s' % (request.json['type'], request.json['href'])
    attach = {'attachment': {'download': request.json['download'],
                             'type': request.json['type'],
                             'href': data_href}}
    attach.update(post_extra)

    try:
        attach_res = testapp.post_json('/Document', attach)
        assert attach_res.status_code == 201
    except Exception as exc:
        log.error('Failure to POST Document in process-gene_list! Exception: %s' % exc)
        error_msg = ('GeneList %s: Error encountered on POST in process-gene_list.'
                     % (genelist_item))
        raise HTTPUnprocessableEntity(error_msg)

    # add document to the gene_list item
    attach_uuid = attach_res.json['@graph'][0]['uuid']
    gene_list_patch = {}
    gene_list_patch['source_file'] = attach_uuid

    # match gene ids to our gene items, by gene_symbol
    gene_list = []
    not_matching_with_options = []
    not_matching_no_options = []
    for a_gene in genes:
        query = '/search/?type=Gene&q=' + a_gene
        res = testapp.get(query).json
        # look up with common ids gene_symbol and ensemble id
        bulls_eye_1 = [i for i in res if i.get('gene_symbol', '') == a_gene]
        bulls_eye_2 = [i for i in res if i.get('ensgid', '') == a_gene]
        # if it is gene_symbol
        if bulls_eye_1:
            gene_list.append(bulls_eye_1[0]['uuid'])
        # if it is ensemble gene id
        elif bulls_eye_2:
            gene_list.append(bulls_eye_2[0]['uuid'])
        # if no id match but some results were returned, report back top 10 gene ids
        elif res:
            topten = res[:10]
            option_symbols = [i['gene_symbol'] for i in topten]
            option_uuids = [i['uuid'] for i in topten]
            not_matching_with_options.append({'gene_id': a_gene,
                                              'option_symbols': option_symbols,
                                              'option_uuids': option_uuids})
        # we don't have an option
        else:
            not_matching_no_options.append(a_gene)

    if not not_matching_with_options and not not_matching_no_options:
        gene_list_patch['genes'] = gene_list
        # PATCH the GeneList with genes
        try:
            genelist_res = testapp.patch_json('/' + genelist_item, gene_list_patch)
            assert genelist_res.status_code == 200
            response['context'] = testapp.get('/gene_lists/' + genelist_item + '?frame=page&datastore=database', status=200).json
            response['status'] = 'success'
            return response
        except Exception as exc:
            log.error('Failure to PATCH GeneList %s in process-genelist with '
                      'data %s! Exception: %s' % (genelist_item, gene_list_patch, exc))
            error_msg = ('GeneList %s: Error encountered on PATCH in process-genelist.'
                         ' Check logs'
                         % (genelist_item))
            raise HTTPUnprocessableEntity(error_msg)
    else:
        response['status'] = 'failure'
        response['detail'] = 'GeneList item has unmatched gene ids'
        response['matching'] = gene_list
        response['not_matching_no_options'] = not_matching_no_options
        response['not_matching_with_options'] = not_matching_with_options
        return response


def get_genes(request_json, genelist_item):
    """get list of genes from the request, if str is returned, use it as error msg"""
    # verification on the attachment.
    accepted_types = [
        'text/plain',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
        ]
    accepted_extensions = ['txt', 'csv', 'xlsx', 'xls']
    extension = request_json['download'].split('.')[-1]
    if request_json['type'] not in accepted_types or extension not in accepted_extensions:
        error_msg = ('GeneList %s: Bad file upload. Use txt/csv/xls/xlsx'
                     ' files. Found: %s (file type), %s (file name)'
                     % (genelist_item, request_json['type'], request_json['download']))
        return error_msg

    # get b64 coded file
    content = b64decode(request_json['href'].encode('ascii'))
    # convert content to list of ids
    try:
        if extension in ['xlsx', 'xls']:
            excel_df = read_excel(content, header=None)
            content = excel_df.to_csv(index=False, header=False)
        else:
            content = content.decode()
        # use following as delimenter [space, tab, new line, comma, colon, semicolon]
        for delimeter in [' ', '\t', '\r\n', '\r', '\n', ',', ':', ';']:
            content = content.replace(delimeter, ',')
        genes = [i.strip().upper() for i in content.split(',') if i]
        # if there are any headers, they should start with #
        genes = [i for i in genes if not i.startswith('#')]
        return genes
    except Exception as exc:
        error_msg = 'Error parsing file: %s' % str(exc)
        return error_msg
