from pyramid.paster import get_app
from pyramid.response import Response
from pyramid.view import view_config
from snovault.util import debug_log
# from webtest import TestApp
from dcicutils.misc_utils import VirtualApp, VirtualAppError
from dcicutils import ff_utils
from webtest.app import AppError
import ast
import datetime
import json
import xlrd


GENERIC_FIELD_MAPPING = {
    'individual': {},
    'family': {},
    'sample': {
        'date collected': 'specimen_collection_date',
        'location stored': 'specimen_storage_location',
        'specimen id': 'specimen_accession',
        'transport method': 'transported_by',
        'sequencing ref lab': 'sequencing_lab',
        "date rec'd at ref lab": 'date_received',
        'specimen accepted by ref lab': 'specimen_accepted',
        'sample id by ref lab': 'sequence_id',
        'req type': 'requisition_type',
        "date req rec'd": 'date_requisition_received',
        'physician/provider': 'ordering_physician'
    },
    'requisition': {
        'req accepted y/n': 'accepted_rejected',
        'reason rejected': 'rejection_reason',
        'corrective action taken': 'corrective_action',
        'corrective action taken by': 'action_taken_by',
        'correction notes': 'notes'
    }
}

# BGM_FIELD_MAPPING = {
#     'bcgg-id': 'patient id',
#     'bcgg-f-id': 'family id',
#     "date req rec'd": 'date requisition received'
# }


POST_ORDER = [
    'file_fastq', 'file_processed', 'sample', 'individual',
    'family', 'sample_processing', 'report', 'case'
]


LINKS = [
    'samples', 'members', 'mother', 'father', 'proband', 'report',
    'individual', 'sample_processing', 'families'
]


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


def map_fields(row, metadata_dict, addl_fields, item_type):
    for map_field in GENERIC_FIELD_MAPPING[item_type]:
        if map_field in row:
            metadata_dict[GENERIC_FIELD_MAPPING[item_type][map_field]] = row.get(map_field)
    for field in addl_fields:
        metadata_dict[field] = row.get(field.replace('_', ' '))
    return metadata_dict


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
        row_dict = {keys[i].lower().rstrip('*'): item for i, item in enumerate(r)}
        rows.append(row_dict)

    items = {
        'individual': {}, 'family': {}, 'sample': {}, 'sample_processing': {},
        'file_fastq': {}, 'file_processed': {}, 'case': {}, 'report': {},
        'reports': []
    }
    file_errors = []
    specimen_ids = {}
    family_dict = create_families(rows)
    a_types = get_analysis_types(rows)
    for row in rows:
        indiv_alias = '{}:individual-{}'.format(project['name'], row['individual id'])
        fam_alias = '{}:{}'.format(project['name'], family_dict[row['analysis id']])
        # sp_alias = '{}:sampleproc-{}'.format(project['name'], row['specimen id'])
        # create items for Individual
        items = fetch_individual_metadata(row, items, indiv_alias, institution['name'])
        # create/edit items for Family
        items = fetch_family_metadata(row, items, indiv_alias, fam_alias)
        # create item for Sample if there is a specimen
        if row.get('specimen id'):
            samp_alias = '{}:sample-{}'.format(project['name'], row['specimen id'])
            if row['specimen id'] in specimen_ids:
                samp_alias = samp_alias + '-' + specimen_ids[row['specimen id']]
                specimen_ids[row['specimen id']] += 1
            else:
                specimen_ids[row['specimen id']] = 1
            analysis_alias = '{}:analysis-{}'.format(project['name'], row['analysis id'])
            items = fetch_sample_metadata(row, items, indiv_alias, samp_alias, analysis_alias,
                                          fam_alias, project['name'], a_types)
            if row.get('files'):
                file_items = fetch_file_metadata(row['files'].split(','), project['name'])
                file_errors.extend(file_items['errors'])
                items['file_fastq'].update(file_items['file_fastq'])
                items['file_processed'].update(file_items['file_processed'])
        else:
            print('WARNING: No specimen id present for patient {},'
                  ' sample will not be created.'.format(row['individual id']))
    # create SampleProcessing item for trio/group if needed
    # items = create_sample_processing_groups(items, sp_alias)
    items = add_relations(items)
    items = create_case_items(items, project['name'])
    # removed unused fields, add project and institution
    for val1 in items.values():
        for val2 in val1.values():
            remove_keys = [k for k, v in val2.items() if not v]
            for key in remove_keys:
                del val2[key]
            val2['project'] = project['@id']
            val2['institution'] = institution['@id']
    items['file_errors'] = file_errors
    return items


def create_families(rows):
    proband_rows = [row for row in rows if row.get('relation to proband').lower() == 'proband']
    fams = {row.get('analysis id'): 'family-{}'.format(row.get('individual id')) for row in proband_rows}
    return fams


def get_analysis_types(rows):
    analysis_relations = {}
    analysis_types = {}
    for row in rows:
        analysis_relations.setdefault(row.get('analysis id'), [[], []])
        analysis_relations[row.get('analysis id')][0].append(row.get('relation to proband', '').lower())
        analysis_relations[row.get('analysis id')][1].append(row.get('workup type', '').upper())
    for k, v in analysis_relations.items():
        if len(list(set(v[1]))) == 1:
            if len(v[0]) == 1:
                analysis_types[k] = v[1][0]
            elif sorted(v[0]) == ['father', 'mother', 'proband']:
                analysis_types[k] = v[1][0] + '-Trio'
            else:
                analysis_types[k] = v[1][0] + '-Group'
        else:
            analysis_types[k] = None
    return analysis_types


def fetch_individual_metadata(row, items, indiv_alias, inst_name):
    new_items = items.copy()
    info = {'aliases': [indiv_alias]}
    info = map_fields(row, info, ['individual_id', 'sex', 'age', 'birth_year'], 'individual')
    if row.get('other individual id'):
        other_id = {'id': row['other individual id'], 'id_source': inst_name}
        if row.get('other individual id type'):
            other_id['id_source'] = row['other individual id source']
        info['institutional_id'] = other_id
    info['age'] = int(info['age']) if info.get('age') else None
    info['birth_year'] = int(info['birth year']) if info.get('birth year') else None
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
    if fam_alias not in new_items['family']:
        new_items['family'][fam_alias] = info
    if indiv_alias not in new_items['family'][fam_alias]['members']:
        new_items['family'][fam_alias]['members'].append(indiv_alias)
    for relation in ['proband', 'mother', 'father', 'brother', 'sister', 'sibling']:
        if row.get('relation to proband', '').lower() == relation and relation not in new_items['family'][fam_alias]:
            new_items['family'][fam_alias][relation] = indiv_alias
    return new_items


def fetch_sample_metadata(row, items, indiv_alias, samp_alias, analysis_alias, fam_alias, proj_name, analysis_type_dict):
    new_items = items.copy()
    info = {'aliases': [samp_alias], 'files': []}  # TODO: implement creation of file db items
    fields = [
        'workup_type', 'specimen_type', 'dna_concentration', 'date_transported',
        'specimen_notes', 'research_protocol_name', 'sent_by', 'physician_id', 'indication'
    ]
    info = map_fields(row, info, fields, 'sample')
    if info.get('specimen_accepted', '').lower() == 'y':
        info['specimen_accepted'] = 'Yes'
    elif info.get('specimen_accepted', '').lower() == 'n':
        info['specimen_accepted'] = 'No'
    if row.get('second specimen id'):
        other_id = {'id': row['second specimen id'], 'id_type': proj_name}  # add proj info?
        if row.get('second specimen id type'):
            other_id['id_type'] = row['second specimen id type']
        info['other_specimen_ids'] = [other_id]
    req_info = map_fields(row, {}, ['date sent', 'date completed'], 'requisition')
    if req_info.get('accepted_rejected', '').lower() in ['yes', 'no', 'y', 'n']:
        if req_info['accepted_rejected'].lower().startswith('y'):
            req_info['accepted_rejected'] = 'Accepted'
        else:
            req_info['accepted_rejected'] = "Rejected"
    info['requisition_acceptance'] = {k: v for k, v in req_info.items() if v}
    new_items['sample'][samp_alias] = {k: v for k, v in info.items() if v}
    if indiv_alias in new_items['individual']:
        new_items['individual'][indiv_alias]['samples'] = [samp_alias]
    new_sp_item = {
        # not trivial to add analysis_type here, turn into calculated property
        'aliases': [analysis_alias],
        'samples': [],
        'families': []
    }
    if row.get('analysis id') in analysis_type_dict:
        new_sp_item['analysis_type'] = analysis_type_dict[row.get('analysis id')]
    new_items['sample_processing'].setdefault(analysis_alias, new_sp_item)
    new_items['sample_processing'][analysis_alias]['samples'].append(samp_alias)
    if row.get('report required').lower().startswith('y'):
        new_items['reports'].append(samp_alias)
    if fam_alias not in new_items['sample_processing'][analysis_alias]['families']:
        new_items['sample_processing'][analysis_alias]['families'].append(fam_alias)
    return new_items


# TODO: finish implementing this function
def fetch_file_metadata(filenames, proj_name):
    valid_extensions = {
        '.fastq.gz': ('fastq', 'reads'),
        '.fq.gz': ('fastq', 'reads'),
        '.cram': ('cram', 'alignments'),
        '.vcf.gz': ('vcf_gz', 'raw VCF')
    }
    files = {'file_fastq': {}, 'file_processed': {}, 'errors': []}
    for filename in filenames:
        extension = [ext for ext in valid_extensions if filename.endswith(ext)]
        if not extension:
            if [ext for ext in ['.fastq', '.fq', '.vcf'] if filename.endswith(ext)]:
                files['errors'].append('File must be compressed - please gzip file {}'.format(filename))
            else:
                files['errors'].append('File extension on {} not supported - expecting one of: '
                              '.fastq.gz, .fq.gz, .cram, .vcf.gz'.format(filename))
            continue
        file_alias = '{}:{}'.format(proj_name, filename.lstrip(' '))
        fmt = valid_extensions[extension[0]][0]
        file_info = {
            'aliases': [file_alias],
            'file_format': '/file-formats/{}/'.format(fmt),
            'file_type': valid_extensions[extension[0]][1],
            'filename': filename  # causes problems without functional file upload
        }
        if fmt == 'fastq':
            files['file_fastq'][file_alias] = file_info
        else:
            files['file_processed'][file_alias] = file_info
    return files


def create_case_items(items, proj_name):
    new_items = items.copy()
    for k, v in items['sample_processing'].items():
        analysis_id = k[k.index('analysis-')+9:]
        for sample in v['samples']:
            case_id = '{}-{}'.format(analysis_id, items['sample'][sample]['specimen_accession'])
            if len(v['samples']) == 1:
                case_id += '-single'
            elif len(v['samples']) > 1:
                case_id += '-group'
            case_alias = '{}:case-{}'.format(proj_name, case_id)
            indiv = [ikey for ikey, ival in items['individual'].items() if sample in ival.get('samples', [])][0]
            case_info = {
                'aliases': [case_alias],
                # 'case_id': case_id,
                'sample_processing': k,
                'individual': indiv
            }
            if sample in items['reports']:
                report_alias = case_alias.replace('case', 'report')
                new_items['report'][report_alias] = {
                    'aliases': [report_alias],
                    'description': 'Analysis Report for Individual ID {}'.format(items['individual'][indiv]['individual_id'])
                }
                case_info['report'] = report_alias
            new_items['case'][case_alias] = case_info
    del new_items['reports']
    return new_items


def add_relations(items):
    new_items = items.copy()
    for alias, fam in items['family'].items():
        parents = False
        for relation in ['mother', 'father']:
            if fam.get(relation):
                if fam.get('proband'):
                    new_items['individual'][fam['proband']][relation] = fam[relation]
                    parents = True
                del new_items['family'][alias][relation]
        for relation in ['brother', 'sister', 'sibling']:
            if fam.get(relation):
                if parents:
                    for parent in ['mother', 'father']:
                        if new_items['individual'][fam['proband']].get(parent):
                            new_items['individual'][fam[relation]][parent] = new_items['individual'][fam['proband']][parent]
                del new_items['family'][alias][relation]
    return new_items


def compare_with_db(virtualapp, alias):
    try:  # check if already in db
        result = virtualapp.get('/' + alias + '/?frame=object')
        if result.status_code == 301:
            msg = json.loads(result.body).get('message', '')
            result = virtualapp.get(msg[msg.index('/'):msg.index(';')])
    except Exception as e:  # if not in db
        if 'HTTPNotFound' in str(e):
            return None
    else:
        return result.json


def validate_item(virtualapp, item, method, itemtype, aliases, atid=None):
    if method == 'post':
        try:
            validation = virtualapp.post_json('/{}/?check_only=true'.format(itemtype), item)
        except (AppError, VirtualAppError) as e:
            return parse_exception(e, aliases)
        else:
            return
    elif method == 'patch':
        try:
            validation = virtualapp.patch_json(atid + '?check_only=true', item, status=200)
        except (AppError, VirtualAppError) as e:
            return parse_exception(e, aliases)
        else:
            return
    else:
        raise ValueError("Unrecognized method -- must be 'post' or 'patch'")


def parse_exception(e, aliases):
    """ff_utils functions raise an exception when the expected code is not returned.
    This response is a pre-formatted text, and this function will get the resonse json
    out of it. [Adapted from Submit4DN]"""
    try:
        # try parsing the exception
        if isinstance(e, VirtualAppError):
            text = e.raw_exception.args[0]
        else:
            text = e.args[0]
        resp_text = text[text.index('{'):-1]
        resp_dict = json.loads(resp_text.replace('\\', ''))
    except Exception:  # pragma: no cover
        raise e
    if resp_dict.get('description') == 'Failed validation':
        keep = []
        resp_list = [error['description'] for error in resp_dict['errors']]
        for error in resp_list:
            # if error is caused by linkTo to item not submitted yet but in aliases list,
            # remove that error
            if 'not found' in error and error.split("'")[1] in aliases:
                continue
            else:
                keep.append(error)
        return keep
    else:
        raise e


def compare_fields(profile, aliases, json_item, db_item):
    to_patch = {}
    for field in json_item:
        # if not an array, patch field gets overwritten (if different from db)
        if profile['properties'][field]['type'] != 'array':
            val = json_item[field]
            if profile['properties'][field]['type'] == 'string' and val in aliases:
                val = aliases[val]
            if val != db_item.get(field):
                to_patch[field] = val
        else:
            # if array, patch field vals get added to what's in db
            if field != 'aliases' and profile['properties'][field].get('items', {}).get('linkTo'):
                val = [aliases[v] if v in aliases else v for v in json_item[field]]
            else:
                val = [v for v in json_item[field]]
            # if sorted(val) != sorted(db_item.get(field, [])):
                # if len(val) == 1 and val not in db_item.get(field, []):
                #     continue
            if all(v in db_item.get(field, []) for v in val):
                continue
            new_val = [item for item in db_item.get(field, [])]
            new_val.extend(val)
            try:
                to_patch[field] = list(set(new_val))
            except TypeError:  # above doesn't handle list of dictionaries
                to_patch[field] = [dict(t) for t in {tuple(d.items()) for d in new_val}]
    return to_patch


def validate_all_items(virtualapp, json_data):
    '''
    Still in progress, not necessarily functional yet. NOT YET TESTED.

    Function that:
    1. looks up each item in json
    2. if item in db, will validate and patch any different metadata
    3. if item not in db, will post item

    Current status:
    Still testing validation/data organization parts - patch/post part hasn't been fully
    written or tested.
    '''
    alias_dict = {}
    errors = json_data['file_errors']
    all_aliases = [k for itype in json_data for k in json_data[itype]]
    json_data_final = {'post': {}, 'patch': {}}
    validation_results = {}
    output = []
    for itemtype in POST_ORDER:  # don't pre-validate case and report
        if itemtype in json_data:
            profile = virtualapp.get('/profiles/{}.json'.format(itemtype)).json
            validation_results[itemtype] = {'validated': 0, 'errors': 0}
            db_results = {}
        for alias in json_data[itemtype]:
            # first collect all atids before comparing and validating items
            db_result = compare_with_db(virtualapp, alias)
            if db_result:
                alias_dict[alias] = db_result['@id']
                db_results[alias] = db_result
        for alias in json_data[itemtype]:
            if 'filename' in json_data[itemtype][alias]:  # until we have functional file upload
                del json_data[itemtype][alias]['filename']
            if not db_results.get(alias):
                error = validate_item(virtualapp, json_data[itemtype][alias], 'post', itemtype, all_aliases)
                if error:  # modify to check for presence of validation errors
                    # do something to report validation errors
                    if itemtype not in ['case', 'report']:
                        for e in error:
                            errors.append('{} {} - Error found: {}'.format(itemtype, alias, e))
                        validation_results[itemtype]['errors'] += 1
                elif json_data[itemtype][alias].get('filename') and \
                        json_data[itemtype][alias]['filename'] in ''.join(json_data['file_errors']):
                    validation_results[itemtype]['errors'] += 1
                else:
                    json_data_final['post'].setdefault(itemtype, [])
                    json_data_final['post'][itemtype].append(json_data[itemtype][alias])
                    validation_results[itemtype]['validated'] += 1
            else:
                # patch if item exists in db
                # alias_dict[alias] = results[alias]['@id']
                patch_data = compare_fields(profile, alias_dict, json_data[itemtype][alias], db_results[alias])
                error = validate_item(virtualapp, patch_data, 'patch', itemtype,
                                      all_aliases, atid=db_results[alias]['@id'])
                if error:  # do something to report validation errors
                    if itemtype not in ['case', 'report']:
                        for e in error:
                            errors.append('{} {} - Error found: {}'.format(itemtype, alias, e))
                        validation_results[itemtype]['errors'] += 1
                elif json_data[itemtype][alias].get('filename') and \
                        json_data[itemtype][alias]['filename'] in ''.join(json_data['file_errors']):
                    validation_results[itemtype]['errors'] += 1
                else:  # patch
                    json_data_final['patch'].setdefault(itemtype, {})
                    if patch_data:
                        json_data_final['patch'][itemtype][db_results[alias]['@id']] = patch_data
                    elif itemtype not in ['case', 'report']:
                        output.append('{} {} - Item already in database, no changes needed'.format(itemtype, alias))
                    # do something to record response
                    validation_results[itemtype]['validated'] += 1
    output.extend([error for error in errors])
    for itemtype in validation_results:
        output.append('{} items: {} validated; {} errors'.format(
            itemtype, validation_results[itemtype]['validated'], validation_results[itemtype]['errors']
        ))
    if errors:
        output.append('Validation errors found in items. Please fix spreadsheet before submitting.')
        return ({}, output)
    else:
        json_data_final['aliases'] = alias_dict
        output.append('All items validated.')
        return (json_data_final, output)


def post_and_patch_all_items(virtualapp, json_data_final):
    output = []
    if not json_data_final:
        return output
    item_names = {'individual': 'individual_id', 'family': 'family_id', 'sample': 'specimen_accession'}
    final_status = {}
    if json_data_final.get('post'):
        for k, v in json_data_final['post'].items():
            final_status[k] = {'posted': 0, 'not posted': 0, 'patched': 0, 'not patched': 0}
            for item in v:
                patch_info = {}
                # if 'filename' in item:  # until we have functional file upload
                #     del item['filename']
                for field in LINKS:
                    if field in item:
                        patch_info[field] = item[field]
                        del item[field]
                try:
                    response = virtualapp.post_json('/' + k, item, status=201)
                    if response.json['status'] == 'success':
                        final_status[k]['posted'] += 1
                        atid = response.json['@graph'][0]['@id']
                        json_data_final['aliases'][item['aliases'][0]] = atid
                        json_data_final['patch'].setdefault(k, {})
                        json_data_final['patch'][k][atid] = patch_info
                        if k in item_names:
                            output.append('Success - {} {} posted'.format(k, item[item_names[k]]))
                    else:
                        final_status[k]['not posted'] += 1
                except Exception as e:
                    final_status[k]['not posted'] += 1
                    output.append(str(e))
        for itype in final_status:
            if final_status[itype]['posted'] > 0 or final_status[itype]['not posted'] > 0:
                output.append('{}: {} items posted successfully; {} items not posted'.format(
                    itype, final_status[itype]['posted'], final_status[itype]['not posted']
                ))
    for k, v in json_data_final['patch'].items():
        final_status.setdefault(k, {'patched': 0, 'not patched': 0})
        for item_id, patch_data in v.items():
            # if 'filename' in patch_data:  # until we have functional file upload
            #     del patch_data['filename']
            try:
                response = virtualapp.patch_json('/' + item_id, patch_data, status=200)
                if response.json['status'] == 'success':
                    # if k in item_names:
                    #     output.append('Success - {} {} patched'.format(k, patch_data[item_names[k]]))
                    final_status[k]['patched'] += 1
                else:
                    final_status[k]['not patched'] += 1
            except Exception as e:
                final_status[k]['not patched'] += 1
                output.append(str(e))
        if final_status[k]['patched'] > 0 or final_status[k]['not patched'] > 0:
            output.append('{}: {} items patched successfully; {} items not patched'.format(
                k, final_status[k]['patched'], final_status[k]['not patched']
            ))
    return output


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
