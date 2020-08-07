import structlog
from base64 import b64encode
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

log = structlog.getLogger(__name__)


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
    1) We find a gene item with matching gene_symbol
    2) No match for gene_symbol, but the query with provided gene id returns gene items
    3) No result is returned with provided gene id as query
    If a match between the provided id and a gene_symbol is caught, its uuid is added to the list
    If not, a query results is provided with error, and the option gene_symbols for the provided gene id
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
    # verification on the attachment.
    if request.json['type'] != '' or not request.json['download'].endswith('.pbxml'):
        raise HTTPUnprocessableEntity('GeneList %s: Bad file upload. Use .txt'
                                      ' file. Found: %s (file type), %s (file name)'
                                      % (genelist_item, request.json['type'], request.json['download']))

    config_uri = request.params.get('config_uri', 'production.ini')
    app = get_app(config_uri, 'app')
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
    testapp = TestApp(app, environ)
    # parse the file for genes
    response = {'title': 'GeneList Processing'}
    try:
        content = request.json['href']
        # use following as delimenter [space, tab, new line, comma, colon, semicolon]
        for delimeter in [' ', '\t', '\n', ',', ':', ';']:
            content = content.replace(delimeter, ',')
        genes = [i.strip().upper() for i in content.split(',')]
        assert genes
    except Exception as exc:
        response['status'] = 'failure'
        response['detail'] = 'Error parsing file: %s' % str(exc)
        return response

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
    data_href = 'data:%s;base64,%s' % (request.json['type'], b64encode(request.json['href'].encode()).decode('ascii'))
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
        bulls_eye = [i for i in res if i.get('gene_symbol', '') == a_gene]
        if bulls_eye:
            gene_list.append(bulls_eye['uuid'])
        elif res:
            option_symbols = [i['gene_symbol'] for i in res]
            option_uuids = [i['uuid'] for i in res]
            not_matching_with_options.append({'gene_id': a_gene,
                                              'option_symbols': option_symbols,
                                              'option_uuids': option_uuids})
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
