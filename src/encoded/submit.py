from pyramid.paster import get_app
from pyramid.response import Response
from pyramid.view import view_config
from snovault.util import debug_log
# from webtest import TestApp
from dcicutils.misc_utils import VirtualApp
from dcicutils import ff_utils
from webtest.app import AppError
import ast
import datetime
import json
import xlrd


BGM_FIELD_MAPPING = {
    'bcgg-id': 'patient id',
    'bcgg-f-id': 'family id',
    "date req rec'd": 'date requisition received'
}


POST_ORDER = ['sample', 'sample_processing', 'individual', 'family']


SECOND_ROUND = {}


# This is a placeholder for a submission endpoint modified from loadxl
@view_config(route_name='submit_data', request_method='POST', permission='add')
@debug_log
def submit_data(context, request):
    '''
    usage notes here later
    '''
    config_uri = request.json.get('config_uri', 'production.ini')
    patch_only = request.json.get('patch_only', False)
    post_only = request.json.get('post_only', False)
    app = get_app(config_uri, 'app')
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
    virtualapp = VirtualApp(app, environ)
    # expected response
    request.response.status = 200
    result = {
        'status': 'success',
        '@type': ['result'],
    }

    raise NotImplementedError


def xls_to_json(xls_data, project, institution):
    '''
    Converts excel file to json for submission.
    Functional but expect future changes.
    '''
    book = xlrd.open_workbook(xls_data)
    sheet, = book.sheets()
    row = row_generator(sheet)
    top_header = next(row)
    keys = next(row)
    next(row)
    rows = []
    counter = 0
    for values in row:
        r = [val for val in values]
        row_dict = {keys[i].lower(): item for i, item in enumerate(r)}
        rows.append(row_dict)

    items = {'individual': {}, 'family': {}, 'sample': {}, 'sample_processing': {}}
    specimen_ids = {}
    for row in rows:
        indiv_alias = '{}:individual-{}'.format(project['name'], row['patient id'])
        fam_alias = '{}:family-{}'.format(project['name'], row['family id'])
        sp_alias = '{}:sampleproc-{}'.format(project['name'], row['specimen id'])
        # create items for Individual
        items = fetch_individual_metadata(row, items, indiv_alias)
        # create/edit items for Family
        items = fetch_family_metadata(row, items, indiv_alias, fam_alias)
        # create item for Sample if there is a specimen
        if row['specimen id']:
            samp_alias = '{}:sample-{}'.format(project['name'], row['specimen id'])
            if row['specimen id'] in specimen_ids:
                samp_alias = samp_alias + '-' + specimen_ids[row['specimen id']]
                specimen_ids[row['specimen id']] += 1
            else:
                specimen_ids[row['specimen id']] = 1
            items = fetch_sample_metadata(row, items, indiv_alias, samp_alias, sp_alias)
        else:
            print('WARNING: No specimen id present for patient {},'
                  ' sample will not be created.'.format(row['patient id']))
    # create SampleProcessing item for trio/group if needed
    items = create_sample_processing_groups(items, sp_alias)
    # removed unused fields, add project and institution
    for val1 in items.values():
        for val2 in val1.values():
            remove_keys = [k for k, v in val2.items() if not v]
            for key in remove_keys:
                del val2[key]
            val2['project'] = project['@id']
            val2['institution'] = institution['@id']

    return items


def fetch_individual_metadata(row, items, indiv_alias):
    new_items = items.copy()
    info = {
        'aliases': [indiv_alias],
        'individual_id': row['patient id'],
        'sex': row.get('sex'),
        'age': row.get('age'),
        'birth_year': row.get('birth year')
    }
    if indiv_alias not in new_items['individual']:
        new_items['individual'][indiv_alias] = {k: v for k, v in info.items() if v}
    else:
        for key in info:
            if key not in new_items['individual'][indiv_alias]:
                new_items['individual'][indiv_alias][key] = info[key]
    return new_items


def fetch_family_metadata(row, items, indiv_alias, fam_alias):
    new_items = items.copy()
    info = {
        'aliases': [fam_alias],
        'family_id': row['family id'],
        'members': [indiv_alias]
    }
    if row.get('relation to proband', '').lower() in ['proband', 'mother', 'father']:
        info[row['relation to proband'].lower()] = indiv_alias
    if fam_alias not in new_items['family']:
        new_items['family'][fam_alias] = info
    else:
        if indiv_alias not in new_items['family'][fam_alias]['members']:
            new_items['family'][fam_alias]['members'].append(indiv_alias)
        if row.get('relation to proband', '').lower() not in new_items['family'][fam_alias]:
            new_items['family'][fam_alias][row['relation to proband'].lower()] = indiv_alias
    return new_items


def fetch_sample_metadata(row, items, indiv_alias, samp_alias, sp_alias):
    new_items = items.copy()
    info = {
        'aliases': [samp_alias],
        'workup_type': row.get('workup type'),
        'specimen_type': row.get('specimen type'),
        'specimen_collection_date': row.get('date collected'),
        'specimen_collection_location': row.get('location collected'),
        'specimen_accession': row['specimen id'],
        'date_transported': row.get('date transported'),
        'transported_by': row.get('transport method'),
        'sent_by': row.get('sent by'),
        'date_received': row.get("date rec'd at ref lab"),
        'specimen_accepted': row.get('specimen accepted by ref lab'),
        'dna_concentration': row.get('dna concentration'),
        'specimen_notes': row.get('specimen notes')
    }
    new_items['sample'][samp_alias] = {k: v for k, v in info.items() if v}
    if indiv_alias in new_items['individual']:
        new_items['individual'][indiv_alias]['samples'] = [samp_alias]
    # create SampleProcessing item for that one sample if needed
    if row['report required'].lower() in ['yes', 'y']:
        new_items['sample_processing'][sp_alias] = {
            'aliases': [sp_alias],
            'analysis_type': row['workup type'],
            'samples': [samp_alias]
        }
    return new_items


def create_sample_processing_groups(items, sp_alias):
    new_items = items.copy()
    for v in new_items['family'].values():
        if 'members' in v and len(v['members']) > 1:
            # create sample_processing item
            samples = [items['individual'][indiv].get('samples', [None])[0] for indiv in v['members']]
            samples = [s for s in samples if s]
            if len (samples) > 1:
                sp = {
                    'aliases': [sp_alias],
                    'samples': samples
                }
                analysis_type = items['sample'][items['individual'][v['proband']]['samples'][0]]['workup_type']
                if all([relation in v for relation in ['proband', 'mother', 'father']]) and sorted(
                    v['members']) == sorted([v['proband'], v['mother'], v['father']]
                ):
                    sp['analysis_type'] = analysis_type + '-Trio'
                else:
                    sp['analysis_type'] = analysis_type + '-Group'
                new_items['sample_processing'][sp_alias] = sp
    return new_items

# NOT YET TESTED
def compare_with_db(alias, virtualapp):
    try:  # check if already in db
        # result = virtualapp.get(alias + '/?frame=object')
        # result = virtualapp.get('/search/?type=Item&aliases={}'.format(alias))
        result = virtualapp.get('/search/?type=Item&age=33')
        print(result)
    except Exception as e:  # if not in db
        print(e)
        if 'HTTPNotFound' in str(e):
            return None
    else:
        return result.json


def validate_item(virtualapp, item, method, itemtype, atid=None):
    if method == 'post':
        #import pdb; pdb.set_trace()
        try:
            validation = virtualapp.post_json('/{}/?checkonly=True'.format(itemtype), item)
        except AppError as e:
            print('exception')
            return parse_exception(e)
        else:
            return
    elif method == 'patch':
        try:
            validation = virtualapp.patch_json(atid + '?checkonly=True', item, status=200)
        except Exception as e:
            return parse_exception(e)
        else:
            return
    else:
        raise ValueError("Unrecognized method -- must be 'post' or 'patch'")


def parse_exception(e):
    """ff_utils functions raise an exception when the expected code is not returned.
    This response is a pre-formatted text, and this function will get the resonse json
    out of it. [Adapted from Submit4DN]"""
    try:
        # try parsing the exception
        text = e.args[0]
        resp_text = text[text.index('{'):-1]
        resp_text = json.loads(resp_text.replace('\\', ''))
        resp_list = [error['description'] for error in resp_text['errors']]
        return resp_list
    # if not re-raise
    except:  # pragma: no cover
        raise e


def patch_item_data():
    pass


def post_item_data():
    pass


# NOT FINISHED
def validate_and_post(virtualapp, json_data, dryrun=False):
    '''
    Still in progress, not necessarily functional yet. NOT YET TESTED.

    Function that:
    1. looks up each item in json
    2. if item in db, will validate and patch any different metadata
    3. if item not in db, will post item
    '''
    alias_dict = {}
    links = ['samples', 'members', 'mother', 'father', 'proband']
    errors = []
    json_data_final = {'post': {}, 'patch': {}}
    for itemtype in POST_ORDER:
        profile = virtualapp.get('/profiles/{}.json'.format(itemtype))
        for alias in results[itemtype]:
            result = compare_with_db(alias)
            if not result:
                error = validate_item(results[itemtype][alias], 'post', itemtype)
                if error:  # modify to check for presence of validation errors
                    # do something to report validation errors
                    errors.append(error)
                else:
                    json_data_final['post'].setdefault(itemtype, default=[]).append(results[itemtype][alias])
            else:
                # patch if item exists in db
                alias_dict[alias] = result['@id']
                to_patch = {}
                for field in results[itemtype][alias]:
                    if field in links:
                        # look up atids of links
                        if profile['properties'][field]['type'] != 'array':
                            for i, item in enumerate(results[itemtype][alias][field]):
                                if item in alias_dict:
                                    results[itemtype][alias][field][i] = alias_dict[item]
                        elif profile['properties'][field]['type'] == 'string':
                            if item in alias_dict:
                                results[itemtype][alias][field] = alias_dict[item]
                    # if not an array, patch field gets overwritten (if different from db)
                    if profile['properties'][field]['type'] != 'array':
                        if results[itemtype][alias][field] != result.get(field):
                            to_patch[field] = results[itemtype][alias][field]
                    else:
                        # if array, patch field vals get added to what's in db
                        if sorted(results[itemtype][alias][field]) != sorted(result.get(field, [])):
                            val = result.get(field, [])
                            val.extend(results[itemtype][alias][field])
                            to_patch[field] = list(set(val))
                error = validate_item(to_patch, 'post', itemtype, atid=result['@id'])
                if error:  # modify to check for presence of validation errors
                    # do something to report validation errors
                    errors.append(error)
                else:  # patch
                    json_data_final['patch'][result['@id']] = to_patch
                    # do something to record response
    if errors:
        return errors
    output = []
    item_names = {'individual': 'individual_id', 'family': 'family_id', 'sample': 'specimen_id'}
    if json_data_final['post']:
        for k, v in json_data_final['post'].items():
            # also create Case and Report items for each SampleProcessing item created
            for item in v:
                for field in links:
                    if field in item:
                        json_data_final['patch'][item['aliases'][0]] = item[field]
                        del item[field]
                try:
                    response = virtualapp.post_json('/' + k, item, status=201)
                    aliasdict[item['aliases'][0]] = response.json['@graph'][0]['@id']
                    if response.json['status'] == 'success' and k in item_names:
                        output.append('Success - {} {} posted'.format(k, item[item_names[k]]))
                except Exception:
                    pass
    for k, v in json_data_final['patch'].items():
        atid = k if k.startswith('/') else aliasdict[k]
        try:
            response = testapp.patch_json(atid, v, status=200)
        except Exception:
            pass


# This was just to see if i could post something using testapp in the python command line, currently works.
# def test_function():
#     app = get_app('development.ini', 'app')
#     environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
#     testapp = TestApp(app, environ)
#     response = testapp.post_json('/project', {'name': 'test', 'title': 'Test'}, status=201)
#     print(response)


def cell_value(cell, datemode):
    """Get cell value from excel. [From Submit4DN]"""
    # This should be always returning text format
    ctype = cell.ctype
    value = cell.value
    if ctype == xlrd.XL_CELL_ERROR:  # pragma: no cover
        raise ValueError(repr(cell), 'cell error')
    elif ctype == xlrd.XL_CELL_BOOLEAN:
        return str(value).upper().strip()
    elif ctype == xlrd.XL_CELL_NUMBER:
        if value.is_integer():
            value = int(value)
        return str(value).strip()
    elif ctype == xlrd.XL_CELL_DATE:
        value = xlrd.xldate_as_tuple(value, datemode)
        if value[3:] == (0, 0, 0):
            return datetime.date(*value[:3]).isoformat()
        else:  # pragma: no cover
            return datetime.datetime(*value).isoformat()
    elif ctype in (xlrd.XL_CELL_TEXT, xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
        return value.strip()
    raise ValueError(repr(cell), 'unknown cell type')  # pragma: no cover


def row_generator(sheet):
    '''Generator that gets rows from excel sheet [From Submit4DN]'''
    datemode = sheet.book.datemode
    for index in range(sheet.nrows):
        yield [cell_value(cell, datemode) for cell in sheet.row(index)]
