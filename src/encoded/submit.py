# import ast
from copy import deepcopy
import csv
import datetime
import json
import xlrd

from dcicutils.qa_utils import ignored
from dcicutils.misc_utils import VirtualAppError
from webtest.app import AppError
from .util import s3_local_file, debuglog


GENERIC_FIELD_MAPPING = {  # for spreadsheet column names that are different from schema property names
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
        'physician/provider': 'ordering_physician',
        'test requested': 'workup_type'
    },
    'requisition': {
        'req accepted y/n': 'accepted_rejected',
        'reason rejected': 'rejection_reason',
        'corrective action taken': 'corrective_action',
        'corrective action taken by': 'action_taken_by',
        'correction notes': 'notes'
    }
}


ABBREVS = {
    'male': 'M',
    'female': 'F',
    'unknown': 'U',
    'yes': 'Y',
    'no': 'N',
    'p': 'proband',
    'mth': 'mother',
    'fth': 'father',
    'sf': 'sibling'
}


RELATIONS = ['proband', 'mother', 'father', 'sibling', 'brother', 'sister']

REQUIRED_COLUMNS = ['individual id', 'relation to proband', 'report required', 'analysis id', 'specimen id']

POST_ORDER = [
    'file_fastq', 'file_processed', 'sample', 'individual',
    'family', 'sample_processing', 'report', 'case'
]


LINKTO_FIELDS = [  # linkTo properties that we will want to patch in second-round
    'samples', 'members', 'mother', 'father', 'proband', 'report',
    'individual', 'sample_processing', 'families', 'files'
]


ID_SOURCES = [ 'UDN' ]


def submit_metadata_bundle(*, s3_client, bucket, key, project, institution, vapp,  # <- Required keyword arguments
                           validate_only=False):  # <-- Optional keyword arguments (with defaults)
    """
    Handles processing of a submitted workbook.

    Args:
        data_stream: an open stream to xls workbook data
        project: a project identifier
        institution: an institution identifier
        vapp: a VirtualApp object
        log: a logging object capable of .info, .warning, .error, or .debug messages
    """
    with s3_local_file(s3_client, bucket=bucket, key=key) as filename:
        project_json = vapp.get(project).json
        institution_json = vapp.get(institution).json
        results = {
            'success': False,
            'validation_output': [],
            'final_json': {},
            'post_output': [],
            'upload_info': []
        }
        if filename.endswith('.xls') or filename.endswith('.xlsx'):
            rows = digest_xls(filename)
        elif filename.endswith('.csv') or filename.endswith('.tsv'):
            delim = ',' if filename.endswith('csv') else '\t'
            rows = digest_csv(filename, delim=delim)
        else:
            msg = ('Metadata bundle must be a file of type .xls, .xlsx, .csv, or .tsv.'
                   'Please submit a file of the proper type.')
            results['validation_output'].append(msg)
            return results
        json_data, json_success = xls_to_json(rows, project=project_json.get('name'), institution=institution_json.get('name'))
        if not json_success:
            results['validation_output'] = json_data['errors']
            return results
        processing_result, validation_log_lines, validate_success = validate_all_items(vapp, json_data)
        results['result'] = processing_result
        results['validation_output'] = validation_log_lines
        if not validate_success:
            return results
        results['success'] = validate_success
        if validate_only:
            return results
        result_lines, post_success, upload_info = post_and_patch_all_items(vapp, json_data_final=processing_result)
        results['post_output'] = result_lines
        results['success'] = post_success
        results['upload_info'] = upload_info
        return results


def map_fields(row, metadata_dict, addl_fields, item_type):
    """
    function for grabbing metadata from spreadsheet row (in dictionary form) based on
    mapping column headers to schema properties.

    Args:
        row - dictionary of format {column name1: value1, column name 2: value 2}
        metadata_dict - the dictionary (json) to be filled with metadata parsed in this function.
            Can be empty.
        addl_fields - list of fields not present in GENERIC_FIELD_MAPPING. These fields will appear
            in the output dictionary as keys, with spaces replaced with underscores. E.g., a field
            'individual id' will appear in the output dict as 'individual_id'.
        item_type - the key in GENERIC_FIELD_MAPPING to look at for column name to schema property mappings.

    Example usage:
    output = map_fields(row_dict, {}, ['individual_id', 'sex', 'age', 'birth_year'], 'individual')

    """
    for field in addl_fields:
        metadata_dict[field] = use_abbrev(row.get(field.replace('_', ' ')))
    for map_field in GENERIC_FIELD_MAPPING[item_type]:
        if map_field in row:
            metadata_dict[GENERIC_FIELD_MAPPING[item_type][map_field]] = use_abbrev(row.get(map_field))
    return metadata_dict


def use_abbrev(value):
    if value and value.lower() in ABBREVS:
        return ABBREVS[value.lower()]
    else:
        return value


def get_column_name(row, columns):
    """
    For cases where there is a variation on a particular column name.
    Final column in list must be the default name.
    """
    for col in columns:
        if row.get(col):
            return col
    return columns[-1]


def digest_xls(xls_data):
    book = xlrd.open_workbook(xls_data)
    sheet, = book.sheets()
    return row_generator(sheet)


def digest_csv(input_data, delim=','):
    with open(input_data) as csvfile:
        rows = list(csv.reader(csvfile, delimiter=delim))
    for row in rows:
        yield(row)


class MetadataItem:

    def __init__(self, metadata, idx, itemtype):
        self.metadata = metadata
        self.row = idx
        self.alias = self.metadata.get('aliases', [''])[0]
        self.itemtype = itemtype
        self.metadata['row'] = self.row


class SubmissionRow:

    def __init__(self, row, idx, family_alias, project, institution):
        self.project = project
        self.institution = institution
        self.metadata = row
        self.row = idx
        self.errors = []
        self.check_missing_values()
        if not self.errors:
            self.indiv_alias = '{}:individual-{}'.format(project, row['individual id'])
            self.fam_alias = family_alias
            self.sample_alias = '{}:sample-{}'.format(project, row['specimen id'])
            self.analysis_alias = '{}:analysis-{}'.format(project, row['analysis id'])
            self.case_name = row.get('unique analysis id')
            self.individual = {}
            self.family = {}
            self.sample = {}
            self.analysis = {}
            self.files_fastq = []
            self.files_processed = []
            self.report = {}
            self.report_required = False
            self.extract_individual_metadata()
            self.extract_family_metadata()
            self.extract_sample_metadata()
            self.extract_file_metadata()

    def check_missing_values(self):
        missing_required = [col for col in REQUIRED_COLUMNS if col not in self.metadata
                            or not self.metadata[col]]
        if missing_required:
            self.errors.append(
                'Row {} - missing required field(s) {}. This row cannot be processed.'
                ''.format(self.row, ', '.join(missing_required))
            )

    def extract_individual_metadata(self):
        """
        Extracts 'individual' item metadata from each row
        """
        info = {'aliases': [self.indiv_alias]}
        info = map_fields(self.metadata, info, ['individual_id', 'sex', 'age', 'birth_year'], 'individual')
        other_id_col = get_column_name(self.metadata, ['other id', 'other individual id'])
        if self.metadata.get(other_id_col):  # for 'other_id' sub-embedded object
            other_id = {'id': self.metadata[other_id_col], 'id_source': self.institution}
            if self.metadata.get('other individual id type'):
                other_id['id_source'] = self.metadata['other individual id source']
            else:
                for id_source in ID_SOURCES:
                    if self.metadata[other_id_col].upper().startswith(id_source):
                        other_id['id_source'] = id_source
            info['institutional_id'] = other_id
        for col in ['age', 'birth_year']:
            if info.get(col) and isinstance(info[col], str) and info[col].isnumeric():
                info[col] = int(info[col])
        self.individual = MetadataItem(info, self.row, 'individual')

    def extract_family_metadata(self):
        """
        Extracts 'family' item metadata from each row
        """
        info = {
            'aliases': [self.fam_alias],
            'family_id': self.metadata.get('family id'),
            'members': [self.indiv_alias],
            # 'row': self.row
        }
        if not info['family_id']:
            info['family_id'] = fam_alias[fam_alias.index(':') + 1:]
        valid_relations = ['proband', 'mother', 'father', 'brother', 'sister', 'sibling']
        relation_found = False
        for relation in valid_relations:
            if self.metadata.get('relation to proband', '').lower().startswith(relation):
                relation_found = True
                info[relation] = self.indiv_alias
                break
        if not relation_found:
            msg = 'Row {} - Invalid relation "{}" for individual {} - Relation should be one of: {}'.format(
                self.row, self.metadata.get('relation to proband'), self.metadata.get('individual id'),
                ', '.join(valid_relations)
            )
            self.errors.append(msg)
        self.family = MetadataItem(info, self.row, 'family')

    def extract_sample_metadata(self):
        """
        Extracts 'sample' item metadata from each row
        """
        info = {'aliases': [self.sample_alias], 'files': []}
        fields = [
            'workup_type', 'specimen_type', 'dna_concentration', 'date_transported', 'indication',
            'specimen_notes', 'research_protocol_name', 'sent_by', 'physician_id'
        ]
        info = map_fields(self.metadata, info, fields, 'sample')
        # handle enum values
        if info.get('specimen_accepted', '').lower() == 'y':
            info['specimen_accepted'] = 'Yes'
        elif info.get('specimen_accepted', '').lower() == 'n':
            info['specimen_accepted'] = 'No'
        # SEO
        if self.metadata.get('second specimen id'):
            other_id = {'id': self.metadata['second specimen id'], 'id_type': self.project}  # add proj info?
            if self.metadata.get('second specimen id type'):
                other_id['id_type'] = self.metadata['second specimen id type']
            info['other_specimen_ids'] = [other_id]
        req_info = map_fields(self.metadata, {}, ['date sent', 'date completed'], 'requisition')
        # handle requisition enum
        if req_info.get('accepted_rejected', '').lower() in ['y', 'n']:
            if req_info['accepted_rejected'].lower() == 'y':
                req_info['accepted_rejected'] = 'Accepted'
            else:
                req_info['accepted_rejected'] = "Rejected"
        # remove keys if no value
        info['requisition_acceptance'] = {k: v for k, v in req_info.items() if v}
        self.sample = MetadataItem({k: v for k, v in info.items() if v}, self.row, 'sample')
        if self.individual:
            self.individual.metadata['samples'] = [self.sample_alias]
        new_sp_item = {
            'aliases': [self.analysis_alias],
            'samples': [self.sample_alias],
            'families': [self.fam_alias]
        }
        self.analysis = MetadataItem(new_sp_item, self.row, 'sample_processing')
        if self.metadata.get('report required').lower().startswith('y'):
            self.report_required = True

    def extract_file_metadata(self):
        """
        Extracts 'file' item metadata from each row
        """
        valid_extensions = {
            '.fastq.gz': ('fastq', 'reads'),
            '.fq.gz': ('fastq', 'reads'),
            '.cram': ('cram', 'alignments'),
            '.vcf.gz': ('vcf_gz', 'raw VCF')
        }
        files = {'file_fastq': {}, 'file_processed': {}, 'errors': []}
        filenames = [f.strip() for f in self.metadata.get('files', '').split(',') if f.strip()]
        paired = True if len(filenames) % 2 == 0 else False
        for i, filename in enumerate(filenames):
            extension = [ext for ext in valid_extensions if filename.endswith(ext)]
            if not extension:
                if [ext for ext in ['.fastq', '.fq', '.vcf'] if filename.endswith(ext)]:
                    self.errors.append('File must be compressed - please gzip file {}'.format(filename))
                else:
                    self.errors.append('File extension on {} not supported - expecting one of: '
                                  '.fastq.gz, .fq.gz, .cram, .vcf.gz'.format(filename))
                continue
            file_alias = '{}:{}'.format(self.project, filename.strip().split('/')[-1])
            fmt = valid_extensions[extension[0]][0]
            file_info = {
                'aliases': [file_alias],
                # 'row': self.row,
                'file_format': '/file-formats/{}/'.format(fmt),
                'file_type': valid_extensions[extension[0]][1],
                'filename': filename.strip()
            }
            if fmt == 'fastq':
                if paired:
                    paired_end = str(int(2-((i+1)%2)))
                    file_info['paired end'] = paired_end
                    if paired_end == '2':
                        file_info['related_files'] = [
                            {'relationship_type': 'paired with',
                             'file': self.files_fastq[-1].alias}
                        ]
                self.files_fastq.append(MetadataItem(file_info, self.row, 'file_fastq'))
            else:
                self.files_processed.append(MetadataItem(file_info, self.row, 'file_processed'))


class SubmissionMetadata:

    def __init__(self, rows, project, institution, counter=1):
        self.rows = rows
        self.project = project.get('name')
        self.project_atid = project.get('@id')
        self.institution = institution.get('name')
        self.institution_atid = institution.get('@id')
        self.counter = counter
        self.proband_rows = [row for row in rows if row.get('relation to proband').lower() == 'proband']
        self.family_dict = {
            row.get('analysis id'): '{}:family-{}'.format(
                self.project, row.get('individual id')
            ) for row in self.proband_rows
        }
        self.metadata = []
        self.individuals = {}
        self.families = {}
        self.samples = {}
        self.sample_processings = {}
        self.reports = {}
        self.cases = {}
        self.files_fastq = {}
        self.files_processed = {}
        self.reports_req = []
        self.errors = []
        self.analysis_types = {}
        self.case_names = {}
        self.json_out = {}
        self.itemtype_dict = {
            'individual': self.individuals,
            'family': self.families,
            'sample': self.samples,
            'sample_processing': self.sample_processings,
            'file_fastq': self.files_fastq,
            'file_processed': self.files_processed,
            'case': self.cases,
            'report': self.reports
        }
        self.process_rows()
        self.create_json_out()

    def get_analysis_types(self):
        """
        'analysis_type' is a property of sample_processing items, denoting the workup type (WGS, WES, etc)
        as well as describing the grouping (Trio, Quad, etc). This info needs to be extracted from the spreadsheet
        separately from most of the metadata since it depends info extracted from more than one row.
        """
        analysis_relations = {}
        analysis_types = {}
        for row in self.rows:
            analysis_relations.setdefault(row.get('analysis id'), [[], []])
            analysis_relations[row.get('analysis id')][0].append(row.get('relation to proband', '').lower())
            workup_col = get_column_name(row, ['test requested', 'workup type'])
            analysis_relations[row.get('analysis id')][1].append(row.get(workup_col, '').upper())
        for k, v in analysis_relations.items():
            workup = list(set(v[1]))
            if len(workup) == 1 and '' not in workup:
                if len(v[0]) == 1:
                    analysis_types[k] = v[1][0]
                elif sorted(v[0]) == ['father', 'mother', 'proband']:
                    analysis_types[k] = v[1][0] + '-Trio'
                else:
                    analysis_types[k] = v[1][0] + '-Group'
            else:
                analysis_types[k] = None
        self.analysis_types = analysis_types

    #def extract_individual_metadata(idx, row, items, indiv_alias, inst_name):
    def add_metadata_single_item(self, item):
        """
        Extracts 'individual' item metadata from each row
        """
        previous = self.itemtype_dict[item.itemtype]
        prev = [p for p in previous.keys()]
        if item.alias not in prev:
            previous[item.alias] = item.metadata
        else:
            for key in item.metadata:
                if key not in previous[item.alias]:
                    previous[item.alias][key] = item.metadata[key]

    #def extract_family_metadata(idx, row, items, indiv_alias, fam_alias):
    def add_family_metadata(self, idx, family, individual):
        """
        Extracts 'family' item metadata from each row
        """
        if family.alias in self.families:
            # consolidate members
            for member in family.metadata.get('members', []):
                if member not in self.families[family.alias]['members']:
                    self.families[family.alias]['members'].append(member)
            # deal with relations
            for relation in RELATIONS:
                if family.metadata.get(relation):
                    if relation in self.families[family.alias]:
                        if self.families[family.alias][relation] != individual.alias:
                            msg = ('Row {} - Multiple values for relation "{}" in family {}'
                                   ' found in spreadsheet'.format(idx, relation, family.metadata['family_id']))

                    else:
                        self.families[family.alias][relation] = family.metadata[relation]
        else:
            self.families[family.alias] = family.metadata

    def add_sample_processing(self, sp_item, analysis_id):
        # also add analysis types
        sp_item.metadata['analysis_type'] = self.analysis_types.get(analysis_id)
        if analysis_id in self.analysis_types:
            sp_item.metadata['analysis_type'] = self.analysis_types.get(analysis_id)
            if not self.analysis_types[analysis_id]:
                msg = ('Row {} - Samples with analysis ID {} contain mis-matched or invalid workup type values. '
                       'Sample cannot be processed.'.format(sp_item.row, analysis_id))
                self.errors.append(msg)
        if sp_item.alias in self.sample_processings:
            for field in ['samples', 'families']:
                if sp_item.metadata[field][0] not in self.sample_processings[sp_item.alias][field]:
                    self.sample_processings[sp_item.alias][field].extend(sp_item.metadata[field])
        else:
            self.sample_processings[sp_item.alias] = sp_item.metadata

    def create_case_metadata(self):
        for k, v in self.sample_processings.items():
            analysis_id = k[k.index('analysis-')+9:]
            for sample in v['samples']:
                case_id = '{}-{}'.format(analysis_id, self.samples[sample].get('specimen_accession', ''))
                name = False
                if case_id in self.case_names:
                    name = True
                    case_id = self.case_names[case_id]
                case_alias = '{}:case-{}'.format(self.project, case_id)
                try:
                    indiv = [ikey for ikey, ival in self.individuals.items() if sample in ival.get('samples', [])][0]
                except IndexError:
                    indiv = ''
                case_info = {'aliases': [case_alias],'sample_processing': k,'individual': indiv}
                for fam in v.get('families', []):
                    if fam in self.families and indiv in self.families[fam]['members']:
                        case_info['family'] = fam
                        break
                if name:
                    case_info['case_id'] = case_id
                if sample in self.reports_req:
                    report_alias = case_alias.replace('case', 'report')
                    report_info = {'aliases': [report_alias]}
                    if indiv:
                        report_info['description'] = ('Analysis Report for Individual ID {}'
                                                      ' (Analysis {})'.format(self.individuals[indiv]['individual_id'], analysis_id)
                                                        )
                    else:
                        report_info['description'] = 'Analysis Report for Case ID {}'.format(case_id)
                    case_info['report'] = report_alias
                    self.reports[report_alias] = report_info
                self.cases[case_alias] = case_info

    def add_case_info(self, row_item):
        if all(field in row_item.metadata for field in ['analysis id', 'unique analysis id', 'specimen id']):
            key = '{}-{}'.format(row['analysis id'], row['specimen id'])
            self.case_names[key] = (row_item.metadata['unique analysis id'], row_item.family_alias)

    def add_individual_relations(self):
        for family in self.families.values():
            for parent in ['mother', 'father']:
                if family.get(parent):
                    self.individuals[family['proband']][parent] = family[parent]
                    for sibling in ['sibling', 'brother', 'sister']:
                        if family.get(sibling):
                            self.individuals[family[sibling]][parent] = family[parent]
                    del family[parent]

    def process_rows(self):
        self.get_analysis_types()
        for i, row in enumerate(self.rows):
            try:
                fam = self.family_dict[row.get('analysis id')]
            except KeyError:
                self.errors.append('Row {} - Family/Analysis does not include a proband.'
                                   ' Row cannot be processed.'.format(i))
                continue
            try:
                processed_row = SubmissionRow(row, i + self.counter, fam, self.project, self.institution)
                simple_add_items = [processed_row.individual, processed_row.sample]
                simple_add_items.extend(processed_row.files_fastq)
                simple_add_items.extend(processed_row.files_processed)
                for item in simple_add_items:
                    self.add_metadata_single_item(item)
                self.add_family_metadata(processed_row.row, processed_row.family, processed_row.individual)
                self.add_sample_processing(processed_row.analysis, processed_row.metadata.get('analysis id'))
                if processed_row.report_required:
                    self.reports_req.append(processed_row.sample_alias)
                self.add_case_info(processed_row)
                self.errors.extend(processed_row.errors)
            except AttributeError:
                self.errors.extend(processed_row.errors)
                continue
        self.add_individual_relations()
        self.create_case_metadata()

    def create_json_out(self):
        for key in self.itemtype_dict:
            for metadata in self.itemtype_dict[key].values():
                metadata['project'] = self.project_atid
                metadata['institution'] = self.institution_atid
            self.json_out[key] = self.itemtype_dict[key]


class SpreadsheetProcessing:

    def __init__(self, row, project, institution):
        self.input = row
        self.project = project
        self.institution = institution
        self.output = {}
        self.errors = []
        self.keys = []
        self.header = False
        self.counter = 0
        self.rows = []
        self.passing = False
        self.get_header()
        if self.header:
            self.create_row_dict()
        if self.rows:
            self.extract_metadata()

    def get_header(self):
        while self.input:
            try:
                keys = next(self.input)
                self.keys = [key.lower().strip().rstrip('*: ') for key in keys]
                self.counter += 1
                if 'individual id' in self.keys:
                    self.header = True
                    break
            except StopIteration:
                break
        if not self.header:
            msg = 'Column headers not detected in spreadsheet! "Individual ID*" column must be present in header.'
            self.errors.append(msg)

    def create_row_dict(self):
        missing = [col for col in REQUIRED_COLUMNS if col not in self.keys]
        if missing:
            msg = 'Column(s) "{}" not found in spreadsheet! Spreadsheet cannot be processed.'.format('", "'.join(missing))
            self.errors.append(msg)
        else:
            for values in self.input:
                r = [val for val in values]
                if 'y/n' in ''.join(r).lower() or ''.join(r) == '':  # skip comments/description/blank row if present
                    self.counter += 1
                    continue
                row_dict = {self.keys[i]: item for i, item in enumerate(r)}
                self.rows.append(row_dict)

    def extract_metadata(self):
        result = SubmissionMetadata(self.rows, self.project, self.institution, self.counter)
        self.output = result.json_out
        self.errors.extend(result.errors)
        self.passing = True


def xls_to_json(row, project, institution):
    result = SpreadsheetProcessing(row, project, institution)
    result.output['errors'] = result.errors
    return result.output, result.passing


# def xls_to_json(row, project, institution):
#     """
#     Converts excel file (or csv/tsv table) to json for submission.
#
#     Args:
#         row - generator yielding rows of spreadsheet
#         project - dict (json) of project metadata submitter is submitting for
#         institution - dict (json) of institution metadata that submitter is submitting for
#
#     Output:
#         1. items - dictionary of db items the submitter wants to submit, of the format
#            {itemtype1: [{alias1: {metadata}, {alias2: {metadata}], itemtype2: [...], ...}
#            Also has an extra key 'errors' whose value is a list of errors found during processing,
#            to be combined with validation errors later in submission processing.
#         2. boolean indicating whether submission can move to next phase or not. False will be
#             returned if there are major errors in spreadsheet preventing rows from being
#             processed properly.
#
#     Basically, this function parses the column headers of the spreadsheet, turns each row into
#     a dictionary of {column header: cell value} pairs, then gathers the metadata it can find for each
#     db item type in each row. Minor spreadsheet errors are added to the output dictionary.
#     """
#     header = False
#     counter = 0
#     # debuglog("top_header:", top_header)  # Temporary instrumentation for debugging to go away soon. -kmp 25-Jul-2020
#     while True:
#         try:
#             keys = next(row)
#             keys = [key.lower().strip().rstrip('*: ') for key in keys]
#             counter += 1
#             if 'individual id' in keys:
#                 header = True
#                 break
#         except StopIteration:
#             break
#     if not header:
#         msg = 'Column headers not detected in spreadsheet! "Individual ID*" column must be present in header.'
#         return {'errors': [msg]}, False
#     # debuglog("keys:", keys)  # Temporary instrumentation for debugging to go away soon. -kmp 25-Jul-2020
#     rows = []
#     required = ['individual id', 'relation to proband', 'report required', 'analysis id', 'specimen id']
#     missing = [col for col in required if col not in keys]
#     if missing:
#         msg = 'Column(s) "{}" not found in spreadsheet! Spreadsheet cannot be processed.'.format('", "'.join(missing))
#         return {'errors': [msg]}, False
#
#     for values in row:
#         r = [val for val in values]
#         if 'y/n' in ''.join(r).lower() or ''.join(r) == '':  # skip comments/description/blank row if present
#             counter += 1
#             continue
#         row_dict = {keys[i]: item for i, item in enumerate(r)}
#         rows.append(row_dict)
#
#     items = {
#         'individual': {}, 'family': {}, 'sample': {}, 'sample_processing': {},
#         'file_fastq': {}, 'file_processed': {}, 'case': {}, 'report': {},
#         'reports': [], 'errors': []
#     }
#     file_errors = []
#     family_dict = init_families(rows)
#     a_types = get_analysis_types(rows)
#     case_names = {}
#     for i, row in enumerate(rows):
#         debuglog("row:", repr(row))  # Temporary instrumentation for debugging to go away soon. -kmp 25-Jul-2020
#         row_num = i + counter + 1
#         missing_required = [col for col in required if col not in row or not row[col]]
#         if missing_required:
#             items['errors'].append(
#                 'Row {} - missing required field(s) {}. This row cannot be processed.'
#                 ''.format(row_num, ', '.join(missing_required))
#             )
#         indiv_alias = '{}:individual-{}'.format(project['name'], row['individual id'])
#         if not family_dict.get(row['analysis id']):
#             msg = ('Row {} - Proband for this analysis could not be found. '
#                    'This row cannot be processed.'.format(i))
#             items['errors'].append(msg)
#             continue
#         fam_alias = '{}:{}'.format(project['name'], family_dict[row['analysis id']])
#         # create items for Individual
#         items = extract_individual_metadata(row_num, row, items, indiv_alias, institution['name'])
#         # create/edit items for Family
#         items = extract_family_metadata(row_num, row, items, indiv_alias, fam_alias)
#         # create item for Sample if there is a specimen
#         if row.get('specimen id'):
#             samp_alias = '{}:sample-{}'.format(project['name'], row['specimen id'])
#             if row.get('run no.'):
#                 samp_alias = samp_alias + '-' + row['run no.']
#             analysis_alias = '{}:analysis-{}'.format(project['name'], row['analysis id'])
#             items = extract_sample_metadata(row_num, row, items, indiv_alias, samp_alias, analysis_alias,
#                                           fam_alias, project['name'], a_types, case_names)
#             if row.get('files'):
#                 file_items = extract_file_metadata(row_num, row['files'].split(','), project['name'])
#                 file_errors.extend(file_items['errors'])
#                 items['file_fastq'].update(file_items['file_fastq'])
#                 items['file_processed'].update(file_items['file_processed'])
#     items = add_relations(items)
#     items = create_case_item_metadata(items, project['name'], case_names)
#     # removed unused fields, add project and institution
#     for val1 in items.values():
#         if isinstance(val1, dict):
#             for val2 in val1.values():
#                 remove_keys = [k for k, v in val2.items() if not v]
#                 for key in remove_keys:
#                     del val2[key]
#                 val2['project'] = project['@id']
#                 val2['institution'] = institution['@id']
#     items['errors'].extend(file_errors)
#     items['errors'] = list(set(items['errors']))
#     return items, True  # most errors passed to next step in order to combine with validation errors
#
#
# def init_families(rows):
#     """
#     Initializes metadata dicts for 'family' items. Requires multiple rows so must be done separately from
#     row-by-row parsing.
#     """
#     proband_rows = [row for row in rows if row.get('relation to proband').lower() == 'proband']
#     fams = {row.get('analysis id'): 'family-{}'.format(row.get('individual id')) for row in proband_rows}
#     return fams
#
#
# def get_analysis_types(rows):
#     """
#     'analysis_type' is a property of sample_processing items, denoting the workup type (WGS, WES, etc)
#     as well as describing the grouping (Trio, Quad, etc). This info needs to be extracted from the spreadsheet
#     separately from most of the metadata since it depends info extracted from more than one row.
#     """
#     analysis_relations = {}
#     analysis_types = {}
#     for row in rows:
#         analysis_relations.setdefault(row.get('analysis id'), [[], []])
#         analysis_relations[row.get('analysis id')][0].append(row.get('relation to proband', '').lower())
#         workup_col = get_column_name(row, ['test requested', 'workup type'])
#         analysis_relations[row.get('analysis id')][1].append(row.get(workup_col, '').upper())
#     for k, v in analysis_relations.items():
#         workup = list(set(v[1]))
#         if len(workup) == 1 and '' not in workup:
#             if len(v[0]) == 1:
#                 analysis_types[k] = v[1][0]
#             elif sorted(v[0]) == ['father', 'mother', 'proband']:
#                 analysis_types[k] = v[1][0] + '-Trio'
#             else:
#                 analysis_types[k] = v[1][0] + '-Group'
#         else:
#             analysis_types[k] = None
#     return analysis_types
#
#
# def extract_individual_metadata(idx, row, items, indiv_alias, inst_name):
#     """
#     Extracts 'individual' item metadata from each row
#     """
#     new_items = items.copy()
#     info = {'aliases': [indiv_alias]}
#     info = map_fields(row, info, ['individual_id', 'sex', 'age', 'birth_year'], 'individual')
#     other_id_col = get_column_name(row, ['other id', 'other individual id'])
#     if row.get(other_id_col):
#         other_id = {'id': row[other_id_col], 'id_source': inst_name}
#         if row.get('other individual id type'):
#             other_id['id_source'] = row['other individual id source']
#         else:
#             for id_source in ID_SOURCES:
#                 if row[other_id_col].upper().startswith(id_source):
#                     other_id['id_source'] = id_source
#         info['institutional_id'] = other_id
#     for col in ['age', 'birth_year']:
#         if info.get(col) and isinstance(info[col], str) and info[col].isnumeric():
#             info[col] = int(info[col])
#     if indiv_alias not in new_items['individual']:
#         new_items['individual'][indiv_alias] = {k: v for k, v in info.items() if v}
#         new_items['individual'][indiv_alias]['row'] = idx
#     else:
#         for key in info:
#             if key not in new_items['individual'][indiv_alias]:
#                 new_items['individual'][indiv_alias][key] = info[key]
#     return new_items
#
#
# def extract_family_metadata(idx, row, items, indiv_alias, fam_alias):
#     """
#     Extracts 'family' item metadata from each row
#     """
#     new_items = items.copy()
#     info = {
#         'aliases': [fam_alias],
#         'family_id': row.get('family id'),
#         'members': [indiv_alias],
#         'row': idx
#     }
#     if not info['family_id']:
#         info['family_id'] = fam_alias[fam_alias.index(':') + 1:]
#     if fam_alias not in new_items['family']:
#         new_items['family'][fam_alias] = info
#     if indiv_alias not in new_items['family'][fam_alias]['members']:
#         new_items['family'][fam_alias]['members'].append(indiv_alias)
#     valid_relations = ['proband', 'mother', 'father', 'brother', 'sister', 'sibling']
#     relation_found = False
#     for relation in valid_relations:
#         if row.get('relation to proband', '').lower().startswith(relation):
#             if relation not in new_items['family'][fam_alias]:
#                 new_items['family'][fam_alias][relation] = indiv_alias
#             relation_found = True
#             break
#     if not relation_found:
#         msg = 'Row {} - Invalid relation "{}" for individual {} - Relation should be one of: {}'.format(
#             idx, row.get('relation to proband'), row.get('individual id'), ', '.join(valid_relations)
#         )
#         new_items['errors'].append(msg)
#     return new_items
#
#
# def extract_sample_metadata(idx, row, items, indiv_alias, samp_alias, analysis_alias,
#                           fam_alias, proj_name, analysis_type_dict, case_name_dict):
#     """
#     Extracts 'sample' item metadata from each row
#     """
#     new_items = items.copy()
#     info = {'aliases': [samp_alias], 'files': []}  # TODO: implement creation of file db items
#     fields = [
#         'workup_type', 'specimen_type', 'dna_concentration', 'date_transported', 'indication',
#         'specimen_notes', 'research_protocol_name', 'sent_by', 'physician_id'
#     ]
#     info = map_fields(row, info, fields, 'sample')
#     info['row'] = idx
#     if info.get('specimen_accepted', '').lower() == 'y':
#         info['specimen_accepted'] = 'Yes'
#     elif info.get('specimen_accepted', '').lower() == 'n':
#         info['specimen_accepted'] = 'No'
#     if row.get('second specimen id'):
#         other_id = {'id': row['second specimen id'], 'id_type': proj_name}  # add proj info?
#         if row.get('second specimen id type'):
#             other_id['id_type'] = row['second specimen id type']
#         info['other_specimen_ids'] = [other_id]
#     req_info = map_fields(row, {}, ['date sent', 'date completed'], 'requisition')
#     if req_info.get('accepted_rejected', '').lower() in ['y', 'n']:
#         if req_info['accepted_rejected'].lower() == 'y':
#             req_info['accepted_rejected'] = 'Accepted'
#         else:
#             req_info['accepted_rejected'] = "Rejected"
#     info['requisition_acceptance'] = {k: v for k, v in req_info.items() if v}
#     new_items['sample'][samp_alias] = {k: v for k, v in info.items() if v}
#     if indiv_alias in new_items['individual']:
#         new_items['individual'][indiv_alias]['samples'] = [samp_alias]
#     new_sp_item = {
#         'aliases': [analysis_alias],
#         'samples': [],
#         'families': []
#     }
#     if row.get('analysis id') in analysis_type_dict:
#         new_sp_item['analysis_type'] = analysis_type_dict[row.get('analysis id')]
#         if not analysis_type_dict[row.get('analysis id')]:
#             msg = ('Row {} - Samples with analysis ID {} contain mis-matched or invalid workup type values. '
#                    'Sample cannot be processed.'.format(idx, row.get('analysis id')))
#             new_items['errors'].append(msg)
#         case_col = get_column_name(row, ['unique analysis id', 'optional case id (unique in all rows)'])
#         if row.get(case_col):
#             case_name_dict['{}-{}'.format(row.get('analysis id'), row.get('specimen id'))] = row[case_col]
#     new_items['sample_processing'].setdefault(analysis_alias, new_sp_item)
#     new_items['sample_processing'][analysis_alias]['samples'].append(samp_alias)
#     if row.get('report required').lower().startswith('y'):
#         new_items['reports'].append(samp_alias)
#     if fam_alias not in new_items['sample_processing'][analysis_alias]['families']:
#         new_items['sample_processing'][analysis_alias]['families'].append(fam_alias)
#     return new_items
#
#
# def extract_file_metadata(idx, filenames, proj_name):
#     """
#     Extracts 'file' item metadata from each row
#     """
#     valid_extensions = {
#         '.fastq.gz': ('fastq', 'reads'),
#         '.fq.gz': ('fastq', 'reads'),
#         '.cram': ('cram', 'alignments'),
#         '.vcf.gz': ('vcf_gz', 'raw VCF')
#     }
#     files = {'file_fastq': {}, 'file_processed': {}, 'errors': []}
#     for filename in filenames:
#         extension = [ext for ext in valid_extensions if filename.endswith(ext)]
#         if not extension:
#             if [ext for ext in ['.fastq', '.fq', '.vcf'] if filename.endswith(ext)]:
#                 files['errors'].append('File must be compressed - please gzip file {}'.format(filename))
#             else:
#                 files['errors'].append('File extension on {} not supported - expecting one of: '
#                               '.fastq.gz, .fq.gz, .cram, .vcf.gz'.format(filename))
#             continue
#         file_alias = '{}:{}'.format(proj_name, filename.strip().split('/')[-1])
#         fmt = valid_extensions[extension[0]][0]
#         file_info = {
#             'aliases': [file_alias],
#             'row': idx,
#             'file_format': '/file-formats/{}/'.format(fmt),
#             'file_type': valid_extensions[extension[0]][1],
#             'filename': filename.strip()
#         }
#         if fmt == 'fastq':
#             files['file_fastq'][file_alias] = file_info
#         else:
#             files['file_processed'][file_alias] = file_info
#     return files
#
#
# def create_case_item_metadata(items, proj_name, case_name_dict):
#     """
#     Creation of case metadata, which can only be done after all rows are processed
#     so that sample_processing metadata exists.
#     """
#     new_items = items.copy()
#     for k, v in items['sample_processing'].items():
#         analysis_id = k[k.index('analysis-')+9:]
#         for sample in v['samples']:
#             case_id = '{}-{}'.format(analysis_id, items['sample'][sample]['specimen_accession'])
#             name = False
#             if case_id in case_name_dict:
#                 name = True
#                 case_id = case_name_dict[case_id]
#             case_alias = '{}:case-{}'.format(proj_name, case_id)
#             try:
#                 indiv = [ikey for ikey, ival in items['individual'].items() if sample in ival.get('samples', [])][0]
#             except IndexError:
#                 indiv = ''
#             case_info = {
#                 'aliases': [case_alias],
#                 'sample_processing': k,
#                 'individual': indiv
#             }
#             if name:
#                 case_info['case_id'] = case_id
#             if sample in items['reports']:
#                 report_alias = case_alias.replace('case', 'report')
#                 new_items['report'][report_alias] = {'aliases': [report_alias]}
#                 report_info = {'aliases': [report_alias]}
#                 if indiv:
#                     report_info['description'] = 'Analysis Report for Individual ID {} (Analysis {})'.format(
#                         items['individual'][indiv]['individual_id'], analysis_id
#                     )
#                 else:
#                     report_info['description'] = 'Analysis Report for Case ID {}'.format(case_id)
#                 case_info['report'] = report_alias
#             new_items['case'][case_alias] = case_info
#     del new_items['reports']
#     return new_items
#
#
# def add_relations(items):
#     """
#     This function adds relations info to 'individual' metadata for proband.
#     This is done separately from row by row processing because information needed from spreadsheet
#     is on multiple rows.
#     """
#     new_items = items.copy()
#     for alias, fam in items['family'].items():
#         parents = False
#         for relation in ['mother', 'father']:
#             if fam.get(relation):
#                 if fam.get('proband'):
#                     new_items['individual'][fam['proband']][relation] = fam[relation]
#                     parents = True
#                 del new_items['family'][alias][relation]
#         for relation in ['brother', 'sister', 'sibling']:
#             if fam.get(relation):
#                 if parents:
#                     for parent in ['mother', 'father']:
#                         if new_items['individual'][fam['proband']].get(parent):
#                             new_items['individual'][fam[relation]][parent] = new_items['individual'][fam['proband']][parent]
#                 del new_items['family'][alias][relation]
#     return new_items
#

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
    data = deepcopy(item)
    if data.get('filename'):
        del data['filename']
    if method == 'post':
        try:
            validation = virtualapp.post_json('/{}/?check_only=true'.format(itemtype), data)
        except (AppError, VirtualAppError) as e:
            return parse_exception(e, aliases)
        else:
            return
    elif method == 'patch':
        try:
            validation = virtualapp.patch_json(atid + '?check_only=true', data, status=200)
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
        resp_dict = json.loads(resp_text.replace('\\"', "\'").replace('\\', ''))
    except Exception:  # pragma: no cover
        raise e
    if resp_dict.get('description') == 'Failed validation':
        keep = []
        resp_list = [error['name'] + ' - ' + error['description'] for error in resp_dict['errors']]
        for error in resp_list:
            # if error is caused by linkTo to item not submitted yet but in aliases list,
            # remove that error
            if 'not found' in error and error.split("'")[1] in aliases:
                continue
            else:
                error = error.lstrip('Schema: ')
                if error.index('- ') > 0:
                    field_name = error[:error.index(' - ')]
                    field = None
                    if field_name in GENERIC_FIELD_MAPPING['sample'].values():
                        field = [key for key, val in GENERIC_FIELD_MAPPING['sample'].items() if val == field_name][0]
                    elif field_name == 'requisition_acceptance.accepted_rejected':
                        field = 'Req Accepted Y\\N'
                    error = map_enum_options(field_name, error)
                    if not field:
                        field = field_name.replace('_', ' ')

                    error = 'field: ' + error.replace(field_name, field)
                    keep.append(error)
                elif 'Additional properties are not allowed' in error:
                    keep.append(error[2:])
        return keep
    else:
        raise e


def map_enum_options(fieldname, error_message):
    if fieldname == 'requisition_acceptance.accepted_rejected':
        error_message = error_message.replace("['Accepted', 'Rejected']", "['Y', 'N']")
    elif fieldname == 'specimen_accepted':
        error_message = error_message.replace("['Yes', 'No']", "['Y', 'N']")
    return error_message


def compare_fields(profile, aliases, json_item, db_item):
    to_patch = {}
    for field in json_item:
        if field == 'filename':
            if (db_item.get('status') in ['uploading', 'upload failed', 'to be uploaded by workflow'] or
                        json_item['filename'].split('/')[-1] != db_item.get('filename')):
                to_patch['filename'] = json_item['filename']
                to_patch['status'] = 'uploading'
            continue
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
    """
    Function that:
    1. looks up each item in json
    2. if item in db, will validate and patch any different metadata
    3. if item not in db, will post item
    """
    if list(json_data.keys()) == ['errors']:
        output.append('Errors found in spreadsheet columns. Please fix spreadsheet before submitting.')
        return {}, output, False
    alias_dict = {}
    errors = json_data['errors']
    all_aliases = [k for itype in json_data for k in json_data[itype]]
    json_data_final = {'post': {}, 'patch': {}}
    validation_results = {}
    output = []
    for itemtype in POST_ORDER:  # don't pre-validate case and report
        db_results = {}
        if itemtype in json_data:
            profile = virtualapp.get('/profiles/{}.json'.format(itemtype)).json
            validation_results[itemtype] = {'validated': 0, 'errors': 0}
            for alias in json_data[itemtype]:
                # first collect all atids before comparing and validating items
                db_result = compare_with_db(virtualapp, alias)
                if db_result:
                    alias_dict[alias] = db_result['@id']
                    db_results[alias] = db_result
            for alias in json_data[itemtype]:
                data = json_data[itemtype][alias].copy()
                row = data.get('row')
                if row:
                    del data['row']
                fname = json_data[itemtype][alias].get('filename')
                if not db_results.get(alias):
                    error = validate_item(virtualapp, data, 'post', itemtype, all_aliases)
                    if error:  # check an report presence of validation errors
                        if itemtype not in ['case', 'report']:
                            for e in error:
                                if row:
                                    errors.append('Row {} - Error found: {}'.format(row, e))
                                else:
                                    errors.append('{} {} - Error found: {}'.format(itemtype, alias, e))
                            validation_results[itemtype]['errors'] += 1
                    else:
                        if fname:
                            if fname in ''.join(json_data['errors']):
                                validation_results[itemtype]['errors'] += 1
                            else:
                                json_data[itemtype][alias]['status'] = 'uploading'
                        json_data_final['post'].setdefault(itemtype, [])
                        json_data_final['post'][itemtype].append(json_data[itemtype][alias])
                        validation_results[itemtype]['validated'] += 1
                else:
                    # patch if item exists in db
                    patch_data = compare_fields(profile, alias_dict, data, db_results[alias])
                    if itemtype in ['file_fastq', 'file_processed']:
                        if 'filename' in patch_data:
                            patch_data['status'] = 'uploading'
                    error = validate_item(virtualapp, patch_data, 'patch', itemtype,
                                          all_aliases, atid=db_results[alias]['@id'])
                    if error:  # report validation errors
                        if itemtype not in ['case', 'report']:
                            for e in error:
                                if row:
                                    errors.append('Row {} {} - Error found: {}'.format(row, itemtype, e))
                                else:
                                    errors.append('{} {} - Error found: {}'.format(itemtype, alias, e))
                            validation_results[itemtype]['errors'] += 1
                    elif fname and fname in ''.join(json_data['errors']):
                        validation_results[itemtype]['errors'] += 1
                    else:  # patch
                        json_data_final['patch'].setdefault(itemtype, {})
                        if patch_data:
                            json_data_final['patch'][itemtype][db_results[alias]['@id']] = patch_data
                        elif itemtype not in ['case', 'report', 'sample_processing', 'file_fastq']:
                            item_name = alias[alias.index(':')+1:]
                            if item_name.startswith(itemtype + '-'):
                                item_name = item_name[item_name.index('-') + 1:]
                            if itemtype == 'family':
                                item_name = 'family for ' + item_name
                            else:
                                item_name = itemtype + ' ' + item_name
                            output.append('{} - Item already in database, no changes needed'.format(item_name))
                        # record response
                        validation_results[itemtype]['validated'] += 1
    output.extend([error for error in errors])
    for itemtype in validation_results:
        output.append('{} items: {} validated; {} errors'.format(
            itemtype, validation_results[itemtype]['validated'], validation_results[itemtype]['errors']
        ))
    if errors:
        output.append('Errors found in items. Please fix spreadsheet before submitting.')
        return {}, output, False
    else:
        json_data_final['aliases'] = alias_dict
        output.append('All items validated.')
        return json_data_final, output, True


def post_and_patch_all_items(virtualapp, json_data_final):
    output = []
    files = []
    if not json_data_final:
        return output, 'not run', []
    item_names = {'individual': 'individual_id', 'family': 'family_id', 'sample': 'specimen_accession'}
    final_status = {}
    no_errors = True
    if json_data_final.get('post'):
        for k, v in json_data_final['post'].items():
            final_status[k] = {'posted': 0, 'not posted': 0, 'patched': 0, 'not patched': 0}
            for item in v:
                patch_info = {}
                row = item.get('row')
                if row:
                    del item['row']
                fname = item.get('filename')
                if fname:
                    del item['filename']
                for field in LINKTO_FIELDS:
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
                        if fname and item.get('status') == 'uploading':
                            files.append({
                                'uuid': response.json['@graph'][0]['uuid'],
                                'filename': fname
                            })
                    else:
                        final_status[k]['not posted'] += 1
                        no_errors = False
                except Exception as e:
                    final_status[k]['not posted'] += 1
                    output.append(str(e))
                    no_errors = False
        for itype in final_status:
            if final_status[itype]['posted'] > 0 or final_status[itype]['not posted'] > 0:
                output.append('{}: {} items posted successfully; {} items not posted'.format(
                    itype, final_status[itype]['posted'], final_status[itype]['not posted']
                ))
    for k, v in json_data_final['patch'].items():
        final_status.setdefault(k, {'patched': 0, 'not patched': 0})
        for item_id, patch_data in v.items():
            fname = patch_data.get('filename')
            if fname:
                del patch_data['filename']
            try:
                response = virtualapp.patch_json('/' + item_id, patch_data, status=200)
                if response.json['status'] == 'success':
                    final_status[k]['patched'] += 1
                    if fname and patch_data.get('status') == 'uploading':
                        files.append({
                            'uuid': response.json['@graph'][0]['uuid'],
                            'filename': fname
                        })
                else:
                    final_status[k]['not patched'] += 1
                    no_errors = False
            except Exception as e:
                final_status[k]['not patched'] += 1
                output.append(str(e))
                no_errors = False
        if final_status[k]['patched'] > 0 or final_status[k]['not patched'] > 0:
            output.append('{}: {} items patched successfully; {} items not patched'.format(
                k, final_status[k]['patched'], final_status[k]['not patched']
            ))
    return output, no_errors, files


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
    """Generator that gets rows from excel sheet [From Submit4DN]"""
    datemode = sheet.book.datemode
    for index in range(sheet.nrows):
        yield [cell_value(cell, datemode) for cell in sheet.row(index)]
