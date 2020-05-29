from pyramid.paster import get_app
from pyramid.response import Response
from pyramid.view import view_config
from snovault.util import debug_log
from webtest import TestApp
import datetime
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
    testapp = TestApp(app, environ)
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
        indiv_alias = 'test-project:individual-{}'.format(row['patient id'])
        fam_alias = 'test-project:family-{}'.format(row['family id'])
        sp_alias = 'test-project:sampleproc-{}'.format(row['specimen id'])
        # create items for Individual
        if row['patient id'] not in items['individual']:
            items['individual'][indiv_alias] = {
                'aliases': [indiv_alias],
                'individual_id': row['patient id'],
                'sex': row['sex'],
                'age': row['age'],
                'birth_year': row['birth year']
            }
        # create/edit items for Family
        if fam_alias not in items['family']:
            items['Family'][fam_alias] = {
                'aliases': [fam_alias],
                'family_id': row['family id'],
                'members': [indiv_alias]
            }
        else:
            items['family'][fam_alias]['members'].append(indiv_alias)
        if row.get('relation to proband', '').lower() in ['proband', 'mother', 'father']:
            items['family'][fam_alias][row['relation to proband'].lower()] = indiv_alias
        # create item for Sample if there is a specimen
        if row['specimen id']:
            samp_alias = 'test-project:sample-{}'.format(row['specimen id'])
            if row['specimen id'] in specimen_ids:
                samp_alias = samp_alias + '-' + specimen_ids[row['specimen id']]
                specimen_ids[row['specimen id']] += 1
            else:
                specimen_ids[row['specimen id']] = 1
            items['sample'][samp_alias] = {
                'aliases': [samp_alias],
                'workup_type': row['workup type'],
                'specimen_type': row['specimen type'],
                'specimen_collection_date': row['date collected'],
                'specimen_collection_location': row['location collected'],
                'specimen_accession': row['specimen id'],
                'date_transported': row['date transported'],
                'transported_by': row['transport method'],
                'sent_by': row['sent by'],
                'date_received': row["date rec'd at ref lab"],
                'specimen_accepted': row['specimen accepted by ref lab'],
                'dna_concentration': row['dna concentration'],
                'specimen_notes': row['specimen notes'],
                'files': []
            }
            items['individual'][indiv_alias]['samples'] = [samp_alias]
            # create SampleProcessing item for that one sample if needed
            if row['report required'].lower() in ['yes', 'y']:
                items['sample_processing'][sp_alias] = {
                    'aliases': [sp_alias],
                    'analysis_type': row['workup type'],
                    'samples': [samp_alias]
                }
        else:
            print('WARNING: No specimen id present for patient {},'
                  ' sample will not be created.'.format(row['patient id']))
    # create SampleProcessing item for trio/group if needed
    for v in items['family'].values():
        if 'members' in v and len(v['members']) > 1:
            # create sample_processing item
            alias = 'test-project:{}-sampleproc'.format(v['family_id'])
            samples = [items['individual'][indiv].get('samples', [None])[0] for indiv in v['members']]
            samples = [s for s in samples if s]
            if len (samples) > 1:
                sp = {
                    'aliases': [alias],
                    'samples': samples
                }
                analysis_type = items['sample'][items['individual'][v['proband']]['samples'][0]]['workup_type']
                if sorted(v['members']) == sorted([v['proband'], v['mother'], v['father']]):
                    sp['analysis_type'] = analysis_type + '-Trio'
                else:
                    sp['analysis_type'] = analysis_type + '-Group'
                items['sample_processing'][alias] = sp
    # removed unused fields, add project and institution
    for val1 in items.values():
        for val2 in val1.values():
            remove_keys = [k for k, v in val2.items() if not v]
            for key in remove_keys:
                del val2[key]
            val2['project'] = project['@id']
            val2['institution'] = institution['@id']

    return items


def validate_and_post(testapp, json_data, dryrun=False):
    '''
    Still in progress, not necessarily functional yet. NOT YET TESTED.

    Function that:
    1. looks up each item in json
    2. if item in db, will validate and patch any different metadata
    3. if item not in db, will post item
    '''
    alias_dict = {}
    links = ['samples', 'members', 'mother', 'father', 'proband']
    for itemtype in POST_ORDER:
        profile = testapp.get('/profiles/{}.json'.format(itemtype))
        for alias in results[itemtype]:
            try:
                # check if already in db
                result = testapp.get(alias + '/?frame=object')
            except Exception as e:
                # post if not in db
                if 'HTTPNotFound' in str(e):
                    validation = testapp.post_json('/{}/?checkonly=True'.format(itemtype), results[itemtype][alias], status=201)
                    if not validation:  # modify to check for presence of validation errors
                        # do something to report validation errors
                        pass
                    elif not dryrun:  # post
                        response = testapp.post_json('/' + itemtype, results[itemtype][alias], status=201)
                        # do something to record response
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
                validation = testapp.patch_json(result['@id'] + '/?checkonly=True', to_patch, status=200)
                if not validation:  # modify to check for presence of validation errors
                    # do something to report validation errors
                    pass
                elif not dryrun:  # patch
                    response = testapp.patch_json('/' + itemtype, results[itemtype][alias], status=201)
                    # do something to record response


# This was just to see if i could post something using testapp in the python command line, currently works.
def test_function():
    app = get_app('development.ini', 'app')
    environ = {'HTTP_ACCEPT': 'application/json', 'REMOTE_USER': 'TEST'}
    testapp = TestApp(app, environ)
    response = testapp.post_json('/project', {'name': 'test', 'title': 'Test'}, status=201)
    print(response)


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
