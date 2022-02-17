from copy import deepcopy
import csv
import datetime
import json
import re
import openpyxl

from dcicutils.lang_utils import n_of
from dcicutils.misc_utils import VirtualAppError, ignored
from webtest import AppError
from .util import s3_local_file, debuglog


GENERIC_FIELD_MAPPINGS = {  # for spreadsheet column names that are different from schema property names
    'individual': {
        'mother id': 'mother',
        'father id': 'father',
        'hpo terms': 'phenotypic_features',
        'mondo terms': 'disorders',
        'deceased': 'is_deceased',
        'termination of pregnancy': 'is_termination_of_pregnancy',
        'still birth': 'is_still_birth',
        'pregnancy': 'is_pregnancy',
        'spontaneous abortion': 'is_spontaneous_abortion',
        'infertile': 'is_infertile',
        'no children by choice': 'is_no_children_by_choice'
    },
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

YES_VALS = ['y', 'yes']

# SS at end refers to spreadsheet, to distinguish from prop names in schema if we need
# vars for those at any point.
SS_INDIVIDUAL_ID = 'individual id'
SS_FAMILY_ID = 'family id'
SS_SEX = 'sex'
SS_SPECIMEN_ID = 'specimen id'
SS_ANALYSIS_ID = 'analysis id'
SS_RELATION = 'relation to proband'
SS_REPORT_REQUIRED = 'report required'
SS_PROBAND = 'proband'

REQUIRED_COLS_FOR_CASE = [SS_ANALYSIS_ID, SS_SPECIMEN_ID]
REQUIRED_COLS_FOR_ACCESSIONING =  REQUIRED_COLS_FOR_CASE + [SS_INDIVIDUAL_ID, SS_SEX, SS_RELATION, SS_REPORT_REQUIRED]
REQUIRED_COLS_FOR_PEDIGREE = [SS_FAMILY_ID, SS_INDIVIDUAL_ID, SS_SEX, SS_PROBAND]

# half-siblings not currently supported, because pedigree info is needed to know
# which parent is shared. Can come back to this after pedigree processing is integrated.
SIBLING_LABEL = 'sibling'
SIBLINGS = ['sibling', 'brother', 'sister', 'full sibling', 'full brother', 'full sister']

RELATIONS = SIBLINGS + ['proband', 'mother', 'father']

POST_ORDER = [
    'file_fastq', 'file_processed', 'sample', 'individual',
    'family', 'sample_processing', 'report', 'case'
]


LINKTO_FIELDS = [  # linkTo properties that we will want to patch in second-round
    'samples', 'members', 'mother', 'father', 'proband', 'report',
    'individual', 'sample_processing', 'families', 'family', 'files'
]


ID_SOURCES = ['UDN']

HPO_TERM_ID_PATTERN = re.compile(r'^HP:[0-9]{7}$')
MONDO_TERM_ID_PATTERN = re.compile(r'^MONDO:[0-9]{7}$')


def submit_metadata_bundle(*, s3_client, bucket, key, project, institution, submission_type, vapp,  # <- Required keyword arguments
                           validate_only=False):  # <-- Optional keyword arguments (with defaults)
    """
    Handles processing of a submitted workbook.

    Args:
        s3_client: a boto3 s3 client object
        bucket: the name of the s3 bucket that contains the data to be processed
        key: the name of a key within the given bucket that contains the data to be processed
        project: a project identifier
        institution: an institution identifier
        vapp: a VirtualApp object
        validate_only: a bool. If True, only do validation, not posting; otherwise (if False), do posting, too.
    """
    with s3_local_file(s3_client, bucket=bucket, key=key) as filename:
        project_json = vapp.get(project).json
        institution_json = vapp.get(institution).json
        results = {
            'success': False,
            'validation_output': [],
            'result': {},
            'post_output': [],
            'upload_info': []
        }
        if filename.endswith('.xlsx'):
            rows = digest_xlsx(filename)
        elif filename.endswith('.csv') or filename.endswith('.tsv'):
            delim = ',' if filename.endswith('csv') else '\t'
            rows = digest_csv(filename, delim=delim)
        else:
            msg = ('Metadata bundle must be a file of type .xlsx, .csv, or .tsv. '
                   'Please submit a file of the proper type.')
            results['validation_output'].append(msg)
            return results
        json_data, json_success = xls_to_json(
            vapp=vapp, xls_data=rows, project=project_json, institution=institution_json,
            ingestion_id=key.split('/')[0], submission_type=submission_type)
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
        addl_fields - list of fields not present in GENERIC_FIELD_MAPPINGS. These fields will appear
            in the output dictionary as keys, with spaces replaced with underscores. E.g., a field
            'individual id' will appear in the output dict as 'individual_id'.
        item_type - the key in GENERIC_FIELD_MAPPINGS to look at for column name to schema property mappings.

    Example usage:
    output = map_fields(row_dict, {}, ['individual_id', 'sex', 'age', 'birth_year'], 'individual')

    """
    for field in addl_fields:
        metadata_dict[field] = use_abbrev(row.get(field.replace('_', ' ')))
    for map_field in GENERIC_FIELD_MAPPINGS[item_type]:
        if map_field in row:
            metadata_dict[GENERIC_FIELD_MAPPINGS[item_type][map_field]] = use_abbrev(row.get(map_field))
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


def digest_xlsx(xlsx_data):
    book = openpyxl.load_workbook(xlsx_data)
    sheet = book.worksheets[0]
    return row_generator(sheet)


def digest_csv(input_data, delim=','):
    with open(input_data) as csvfile:
        rows = list(csv.reader(csvfile, delimiter=delim))
    for row in rows:
        yield row


def replace_cell_contents(info_dict, field, **kwargs):
    existing = info_dict.get(field, '').lower()
    if existing in kwargs:
        info_dict[field] = kwargs[existing]


def remove_spaces_in_id(id_value):
    if not id_value:
        return None
    return id_value.replace(' ', '_')


def generate_individual_alias(project_name, individual_id):
    return '{}:individual-{}'.format(project_name, remove_spaces_in_id(individual_id))


def is_yes_value(str_value):
    """
    Determines whether the value of a field means 'yes'.
    """
    if not isinstance(str_value, str):
        return False
    if str_value.lower() in YES_VALS:
        return True
    return False


def string_to_array(str_value):
    """converts cell contents to list, splitting by commas"""
    return [item.strip() for item in str_value.split(',')]


def format_ontology_term_with_colon(str_value):
    """
    Used for ontology terms, to convert underscore-formatted term ids to
    colon-formatted term ids. Also converts term IDs to uppercase.
    Example input: 'hp_0000124'
    Example output: 'HP:0000124'
    """
    if not isinstance(str_value, str):
        raise ValueError('String value expected.')
    return str_value.upper().replace('_', ':')

class MetadataItem:
    """
    class for single DB-item-worth of json
    """

    def __init__(self, metadata, idx, itemtype):
        self.metadata = metadata
        self.row = idx
        self.alias = self.metadata.get('aliases', [''])[0]
        self.itemtype = itemtype
        self.metadata['row'] = self.row


class AccessionRow:
    """
    class used to hold metadata parsed from one row of spreadsheet at a time
    """

    def __init__(self, metadata, idx, family_alias, project, institution):
        self.project = project
        self.institution = institution
        self.metadata = metadata
        self.row = idx
        self.errors = []
        if not self.found_missing_values():
            self.indiv_alias = generate_individual_alias(project, metadata[SS_INDIVIDUAL_ID])
            self.fam_alias = family_alias
            self.sample_alias = '{}:sample-{}-{}'.format(
                project,
                remove_spaces_in_id(metadata[SS_SPECIMEN_ID]),
                remove_spaces_in_id(metadata[get_column_name(metadata, ['workup type', 'test requested'])])
            )
            if self.metadata.get('test number'):
                self.sample_alias = self.sample_alias + '-' + self.metadata['test number']
            self.analysis_alias = '{}:analysis-{}'.format(project, remove_spaces_in_id(metadata[SS_ANALYSIS_ID]))
            self.case_name = remove_spaces_in_id(metadata.get('unique analysis id'))
            self.individual = self.extract_individual_metadata()
            self.family = self.extract_family_metadata()
            self.sample, self.analysis = self.extract_sample_metadata()
            self.files_fastq = []
            self.files_processed = []
            self.extract_file_metadata()

    def found_missing_values(self):
        # makes sure no required values from spreadsheet are missing
        missing_required = [col for col in REQUIRED_COLS_FOR_ACCESSIONING
                            if col not in self.metadata or not self.metadata[col]]
        if missing_required:
            self.errors.append(
                'Row {} - missing required field(s) {}. This row cannot be processed.'
                .format(self.row, ', '.join(missing_required))
            )
        return len(self.errors) > 0

    def extract_individual_metadata(self):
        """
        Extracts 'individual' item metadata from each row,
        generating a MetadataItem object (assigned to self.individual in __init__).
        """
        info = {'aliases': [self.indiv_alias]}
        info = map_fields(self.metadata, info, ['individual_id', 'sex', 'age', 'birth_year'], 'individual')
        other_id_col = get_column_name(self.metadata, ['other id', 'other individual id'])
        if self.metadata.get(other_id_col):  # for 'other_id' sub-embedded object
            other_id = {'id': remove_spaces_in_id(self.metadata[other_id_col]), 'id_source': self.institution}
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
        return MetadataItem(info, self.row, 'individual')

    def extract_family_metadata(self):
        """
        Extracts 'family' item metadata from each row, generating a
        MetadataItem object (assigned to self.family in __init__)
        """
        info = {
            'aliases': [self.fam_alias],
            'family_id': self.metadata.get('family id'),
            'members': [self.indiv_alias],
            # 'row': self.row
        }
        if not info['family_id']:
            alias = self.project + ":" + self.fam_alias if ':' not in self.fam_alias else self.fam_alias
            info['family_id'] = alias[alias.index(':') + 1:]
        relation_found = False
        for relation in RELATIONS:
            if self.metadata.get(SS_RELATION, '').lower().startswith(relation):
                relation_found = True
                if relation in SIBLINGS:
                    info[SIBLING_LABEL] = [self.indiv_alias]
                else:
                    info[relation] = self.indiv_alias
                break
        if not relation_found:
            msg = 'Row {} - Invalid relation "{}" for individual {} - Relation should be one of: {}'.format(
                self.row, self.metadata.get(SS_RELATION), self.metadata.get(SS_INDIVIDUAL_ID),
                ', '.join(RELATIONS)
            )
            self.errors.append(msg)
        return MetadataItem(info, self.row, 'family')

    def extract_sample_metadata(self):
        """
        Extracts 'sample' item metadata from each row, generating MetadataItem objects
        (assigned to self.sample and self.analysis in __init__)
        """
        info = {'aliases': [self.sample_alias]}
        fields = [
            'workup_type', 'specimen_type', 'dna_concentration', 'date_transported', 'indication',
            'specimen_notes', 'research_protocol_name', 'sent_by', 'physician_id', 'bam_sample_id'
        ]
        info = map_fields(self.metadata, info, fields, 'sample')
        # handle enum values
        replace_cell_contents(info, 'specimen_accepted', y='Yes', n='No')
        # handle bam sample ID
        if not info.get('bam_sample_id'):
            info['bam_sample_id'] = self.sample_alias.split(':sample-')[-1]
        if info.get('specimen_type'):
            info['specimen_type'] = info['specimen_type'].lower().replace('_', ' ')
        # SEO
        if self.metadata.get('second specimen id'):
            other_id = {'id': self.metadata['second specimen id'], 'id_type': self.project}  # add proj info?
            if self.metadata.get('second specimen id type'):
                other_id['id_type'] = self.metadata['second specimen id type']
            info['other_specimen_ids'] = [other_id]
        req_info = map_fields(self.metadata, {}, ['date sent', 'date completed'], 'requisition')
        # handle requisition enum
        replace_cell_contents(req_info, 'accepted_rejected', y='Accepted', n='Rejected')
        # remove keys if no value
        info['requisition_acceptance'] = {k: v for k, v in req_info.items() if v}
        if self.individual:
            self.individual.metadata['samples'] = [self.sample_alias]
        # metadata for sample_processing item
        new_sp_item = {
            'aliases': [self.analysis_alias],
            'samples': [self.sample_alias],
            'families': [self.fam_alias]
        }
        return (MetadataItem(info, self.row, 'sample'),
                MetadataItem(new_sp_item, self.row, 'sample_processing'))

    @staticmethod
    def get_paired_end_value(index):
        """
        Returns the 'paired end' value for fastq pairs (1 or 2) given an index in a list.
        0 --> 1
        1 --> 2
        2 --> 1
        3 --> 2
        4 --> 1
        5 --> 2
        ..
        etc.
        """
        return int(2 - ((index + 1) % 2))

    def extract_file_metadata(self):
        """
        Extracts 'file' item metadata from each row, generating MetadataItem
        object(s). Objects are appended to self.files_fastq or self.files_processed,
        as appropriate, which are initialized as empty lists.
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
            # file relationships if paired
            if fmt == 'fastq':
                self.sample.metadata.setdefault('files', []).append(file_alias)
                if paired:
                    paired_end = str(AccessionRow.get_paired_end_value(i))
                    file_info['paired_end'] = paired_end
                    if paired_end == '2':
                        file_info['related_files'] = [
                            {'relationship_type': 'paired with',
                             'file': self.files_fastq[-1].alias}
                        ]
                self.files_fastq.append(MetadataItem(file_info, self.row, 'file_fastq'))
            else:
                if fmt == 'cram':
                    self.sample.metadata.setdefault('cram_files', []).append(file_alias)
                else:
                    self.sample.metadata.setdefault('processed_files', []).append(file_alias)
                self.files_processed.append(MetadataItem(file_info, self.row, 'file_processed'))


class AccessionMetadata:
    """
    class to hold info parsed from one spreadsheet.

    One row is parsed at a time and a AccessionRow object is generated; this is then
    compared with previous rows already added to AccessionMetadata object, and compared,
    and changes made if necessary. This is because some objects (like family and sample_processing)
    have metadata that occurs across multiple rows.
    """

    def __init__(self, rows, project, institution, ingestion_id, counter=1):
        self.rows = rows
        self.project = project.get('name')
        self.project_atid = project.get('@id')
        self.institution = institution.get('name')
        self.institution_atid = institution.get('@id')
        self.ingestion_id = ingestion_id
        self.counter = counter
        self.proband_rows = [row for row in rows if row.get(SS_RELATION).lower() == 'proband']
        self.family_dict = {
            row.get(SS_ANALYSIS_ID): '{}:family-{}'.format(
                self.project, row.get(SS_INDIVIDUAL_ID)
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
        self.analysis_types = self.get_analysis_types()
        self.case_info = {}
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
        as well as describing the grouping (Trio, Group, etc). This info needs to be extracted from the spreadsheet
        separately from most of the metadata since it depends info extracted from more than one row.

        An example analysis_relations dict as created by the method is shown below, with the corresponding
        analysis type returned by the second half of the method:
        analysis_relations = {
            '111': (['proband', 'mother', 'father'], ['WGS', 'WGS', 'WGS']),  # --> WGS-Trio
            '222': (['proband'], ['WES']),                                    # --> WES
            '333': (['proband', 'father', 'sibling'], ['WGS', 'WGS', 'WGS']), # --> WGS-Group
            '234': (['proband', 'mother'], ['WGS', 'WES']),                   # --> None
        }
        The last entry in the dict will get an analysis_type of None because the workup types are mixed which is
        not allowed.
        """
        analysis_relations = {}
        analysis_types = {}
        for row in self.rows:
            analysis_relations.setdefault(row.get(SS_ANALYSIS_ID), [[], []])
            analysis_relations[row.get(SS_ANALYSIS_ID)][0].append(row.get(SS_RELATION, '').lower())
            workup_col = get_column_name(row, ['test requested', 'workup type'])
            analysis_relations[row.get(SS_ANALYSIS_ID)][1].append(row.get(workup_col, '').upper())
            # dict now has format {analysis id: (relations list, workup types list)}
        for k, v in analysis_relations.items():
            workups = list(set(v[1]))
            relations = v[0]
            if len(workups) == 1 and '' not in workups:
                # if all samples in analysis have same workup type, determine if it is Trio or Group
                if len(relations) == 1:
                    [analysis_types[k]] = workups
                elif sorted(relations) == ['father', 'mother', 'proband']:
                    analysis_types[k] = f'{workups[0]}-Trio'
                else:
                    analysis_types[k] = f'{workups[0]}-Group'
            else:  # analysis type not determined if multiple workup types present in one analysis
                analysis_types[k] = None
        return analysis_types

    def add_metadata_single_item(self, item):
        """
        Looks at metadata from a AccessionRow object, one DB itemtype at a time
        and compares and adds it. If each item is not
        already represented in metadata for current AccessionMetadata instance,
        it is added; if it is represented, missing fields are added to item.
        Currently used for Individual and Sample items
        """
        previous = self.itemtype_dict[item.itemtype]
        prev = [p for p in previous.keys()]
        if item.alias not in prev:
            previous[item.alias] = item.metadata
        else:
            for key, value in item.metadata.items():
                if key not in previous[item.alias]:
                    previous[item.alias][key] = value
                # extend list field (e.g. combine samples in diff rows for Individual item)
                elif key != 'aliases' and isinstance(value, list):
                    previous[item.alias][key].extend(value)
                    # special handling for list of dict rather than list of string
                    if all(isinstance(item, dict) for item in previous[item.alias][key]):
                        vals = [item.values() for item in previous[item.alias][key]]
                        unique = [dict(t) for t in {tuple(d.items()) for d in previous[item.alias][key]}]
                        # error if fastq file (paired end 2) has conflicting 'paired with' relations
                        if key == 'related_files' and (all('paired with' in val for val in vals) and
                                                       len(unique) > 1):
                            msg = ('Fastq file {} appears multiple times in sheet'
                                   ' with inconsistent paired file. Please ensure fastq is'
                                   ' paired with correct file in all rows where it appears.'
                                   ''.format(item.metadata.get('filename', '')))
                            self.errors.append(msg)
                        else:
                            previous[item.alias][key] = unique
                    else:
                        previous[item.alias][key] = list(set(previous[item.alias][key]))

    def check_fastq_paired_info(self):
        """
        Makes sure fastq files appearing more than once have consistent paired with
        information. Specifically, checks that paired end 1 files have consistent
        pairing info.
        """
        paired_info = {}
        for val in self.files_fastq.values():
            if 'related_files' in val:
                for file_dict in val['related_files']:
                    if file_dict['file'] not in paired_info:
                        paired_info[file_dict['file']] = val['filename']
                    elif paired_info[file_dict['file']] != val['filename']:
                        msg = ('Fastq file {} appears multiple times in sheet'
                               ' with inconsistent paired file. Please ensure fastq is'
                               ' paired with correct file in all rows where it appears.'
                               ''.format(file_dict['file']))
                        self.errors.append(msg)
        return

    def add_family_metadata(self, idx, family, individual):
        """
        Looks at 'family' metadata from AccessionRow object. Adds family to AccessionMetadata
        instance if not already present. If present, family is compared and necessary changes added.
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
                        if relation in SIBLINGS:
                            if individual.alias not in self.families[family.alias][relation]:
                                self.families[family.alias][SIBLING_LABEL].extend(family.metadata[relation])
                        elif self.families[family.alias][relation] != individual.alias:
                            msg = ('Row {} - Multiple values for relation "{}" in family {}'
                                   ' found in spreadsheet'.format(idx, relation, family.metadata['family_id']))
                            self.errors.append(msg)
                    else:
                        self.families[family.alias][relation] = family.metadata[relation]
        else:
            self.families[family.alias] = family.metadata

    def add_sample_processing(self, sp_item, analysis_id):
        """
        Looks at 'sample_processing' metadata from AccessionRow object. Adds SP item to AccessionMetadata
        instance if not already present. If present, SP metadata is compared and necessary changes added.
        """
        sp_item.metadata['analysis_type'] = self.analysis_types.get(analysis_id)
        if analysis_id in self.analysis_types:
            sp_item.metadata['analysis_type'] = self.analysis_types.get(analysis_id)
            if not self.analysis_types[analysis_id]:
                msg = ('Row {} - Samples with analysis ID {} contain mis-matched or invalid workup type values. '
                       'Sample cannot be processed.'.format(sp_item.row, analysis_id))
                self.errors.append(msg)
        if sp_item.alias in self.sample_processings:
            for field in ['samples', 'families']:
                # the sp_item.metadata generated by a single row is expected to only have one
                # sample and family even though these props are arrays - extend the arrays in
                # sample_processings dict when necessary.
                if sp_item.metadata[field][0] not in self.sample_processings[sp_item.alias][field]:
                    self.sample_processings[sp_item.alias][field].extend(sp_item.metadata[field])
        else:
            self.sample_processings[sp_item.alias] = sp_item.metadata

    def create_case_metadata(self):
        """
        Cases can only be created after sample_processing items are done. Reports also
        created here, if spreadsheet row indicates it is required.
        """
        for k, v in self.sample_processings.items():
            analysis_id = k[k.index('analysis-')+9:]
            for sample in v['samples']:
                case_key = '{}-{}'.format(analysis_id, self.samples[sample].get('specimen_accession', ''))
                name = False
                case_name = case_key
                if case_key in self.case_info and self.case_info[case_key]['case id']:
                    name = True
                    case_name = self.case_info[case_key]['case id']
                case_alias = '{}:case-{}'.format(self.project, case_name)
                try:
                    indiv = [ikey for ikey, ival in self.individuals.items() if sample in ival.get('samples', [])][0]
                except IndexError:
                    indiv = ''
                case_info = {
                    'aliases': [case_alias],
                    'sample_processing': k,
                    'individual': indiv,
                    'ingestion_ids': [self.ingestion_id]
                }
                for fam in v.get('families', []):
                    if fam in self.families and indiv in self.families[fam]['members']:
                        case_info['family'] = fam
                        break
                if name:  # 'case_id' prop only added if explicitly present in spreadsheet
                    case_info['case_id'] = case_name
                # if report is True for that particular case, create report item
                if case_key in self.case_info and self.case_info[case_key]['report req']:
                    report_alias = case_alias.replace('case', 'report')
                    report_info = {'aliases': [report_alias]}
                    if indiv:
                        report_info['description'] = (
                            'Analysis Report for Individual ID {} (Analysis {})'
                            .format(self.individuals[indiv]['individual_id'], analysis_id)
                        )
                    else:
                        report_info['description'] = 'Analysis Report for Case {}'.format(case_name)
                    case_info['report'] = report_alias
                    self.reports[report_alias] = report_info
                self.cases[case_alias] = case_info

    def add_case_info(self, row_item):
        """
        Creates a dictionary linking analysis ID and specimen ID combination to the Case name
        indicated in the spreadsheet.
        """
        if all(field in row_item.metadata
               for field in REQUIRED_COLS_FOR_CASE):
            key = '{}-{}'.format(row_item.metadata[SS_ANALYSIS_ID], row_item.metadata[SS_SPECIMEN_ID])
            case_id_col = get_column_name(row_item.metadata, ['unique analysis id', 'case id'])
            self.case_info[key] = {
                'case id': remove_spaces_in_id(row_item.metadata.get(case_id_col)),
                'family': row_item.fam_alias,
                'report req': is_yes_value(row_item.metadata.get(SS_REPORT_REQUIRED, ''))
            }

    def add_individual_relations(self):
        """
        After family metadata has finished parsing/processing, mother and father fields are added to
        proband and sibling if relevant metadata are present.
        """
        for family in self.families.values():
            for parent in ['mother', 'father']:
                if family.get(parent):
                    if family.get('proband'):
                        self.individuals[family['proband']][parent] = family[parent]
                    for term in SIBLINGS:
                        if family.get(term):
                            for sibling in family[term]:
                                self.individuals[sibling][parent] = family[parent]
                    del family[parent]
            for term in SIBLINGS:
                if family.get(term):
                    del family[term]

    def process_rows(self):
        """
        Method for iterating over spreadsheet rows to process each one and compare it to previous rows.
        Case creation and family relations added after all rows have been processed.
        """
        self.get_analysis_types()
        for i, row in enumerate(self.rows):
            try:
                fam = self.family_dict[row.get('analysis id')]
            except KeyError:
                self.errors.append('Row {} - Family/Analysis does not include a proband.'
                                   ' Row cannot be processed.'.format(i + 1 + self.counter))
                continue
            try:
                processed_row = AccessionRow(row, i + 1 + self.counter, fam, self.project, self.institution)
                simple_add_items = [processed_row.individual, processed_row.sample]
                simple_add_items.extend(processed_row.files_fastq)
                simple_add_items.extend(processed_row.files_processed)
                for item in simple_add_items:
                    self.add_metadata_single_item(item)
                self.check_fastq_paired_info()
                self.add_family_metadata(processed_row.row, processed_row.family, processed_row.individual)
                self.add_sample_processing(processed_row.analysis, processed_row.metadata.get('analysis id'))
                self.add_case_info(processed_row)
                self.errors.extend(processed_row.errors)
            except AttributeError:
                self.errors.extend(processed_row.errors)
                continue
        self.add_individual_relations()
        self.create_case_metadata()

    def create_json_out(self):
        """
        Creates final json that can be used for subsequent validation function.
        """
        for key in self.itemtype_dict:
            self.json_out[key] = {}
            for alias, metadata in self.itemtype_dict[key].items():
                new_metadata = {k: v for k, v in metadata.items() if v}
                new_metadata['project'] = self.project_atid
                new_metadata['institution'] = self.institution_atid
                self.json_out[key][alias] = new_metadata
            # self.json_out[key] = self.itemtype_dict[key]
            self.json_out['errors'] = self.errors


class PedigreeRow:

    def __init__(self, metadata, idx, project, institution):
        self.project = project
        self.institution = institution
        self.row = idx
        self.metadata = metadata
        self.errors = []
        if not self.found_missing_values():
            self.indiv_alias = generate_individual_alias(project, metadata[SS_INDIVIDUAL_ID])
            self.individual = self.extract_individual_metadata()
            self.proband = self.is_proband()

    def found_missing_values(self):
        # makes sure no required values from spreadsheet are missing
        missing_required = [col for col in REQUIRED_COLS_FOR_PEDIGREE
                            if col not in self.metadata or not self.metadata[col]]
        if missing_required:
            self.errors.append(
                'Row {} - missing required field(s) {}. This row cannot be processed.'
                .format(self.row, ', '.join(missing_required))
            )
        return len(self.errors) > 0

    def format_atid(self, term):
        """turns HPO or MONDO term IDs into the corresponding @id in the database."""
        term_id = format_ontology_term_with_colon(term) if term else ''
        if HPO_TERM_ID_PATTERN.match(term_id):
            return f'/phenotypes/{term_id}/'
        elif MONDO_TERM_ID_PATTERN.match(term_id):
            return f'/disorders/{term_id}/'
        else:
            msg = (f'Row {self.row} - term {term!r} does not match the format for'
                   ' an HPO or MONDO ontology term. Please edit and resubmit.')
            self.errors.append(msg)
            return term

    def reformat_phenotypic_features(self, feature_list):
        if not feature_list:
            return []
        return [{'phenotypic_feature': self.format_atid(feature)} for feature in feature_list if feature]

    def extract_individual_metadata(self):
        info = {'aliases': [self.indiv_alias]}
        simple_fields = [
            'family_id', 'individual_id', 'sex', 'age', 'age_units', 'clinic_notes',
            'ancestry', 'quantity', 'life_status', 'cause_of_death', 'age_at_death',
            'age_at_death_units', 'gestational_age', 'cause_of_infertility'
        ]
        info = map_fields(self.metadata, info, simple_fields, 'individual')
        for field in info:
            if field.startswith('is_'):
                info[field] = is_yes_value(info[field])
        for field in ['mother', 'father']:  # turn mother and father IDs into item aliases
            if info.get(field):
                info[field] = generate_individual_alias(self.project, info[field])
        info['proband'] = self.is_proband()
        if info.get('age') and not info.get('age_units'):
            info['age_units'] = 'year'
        if info.get('ancestry'):
            info['ancestry'] = string_to_array(info['ancestry'])
        if info.get('phenotypic_features'):
            info['phenotypic_features'] = string_to_array(info['phenotypic_features'])
        if info.get('disorders'):
            info['disorders'] = [self.format_atid(item.strip()) for item in info['disorders'].split(',')]
        info['phenotypic_features'] = self.reformat_phenotypic_features(info.get('phenotypic_features', []))
        for col in ['age', 'birth_year', 'age_at_death', 'gestational_age', 'quantity']:
            if info.get(col) and isinstance(info[col], str) and info[col].isnumeric():
                info[col] = int(info[col])
        return MetadataItem(info, self.row, 'individual')

    def is_proband(self):
        return is_yes_value(self.metadata['proband'])
        # if self.metadata['proband'].lower().startswith('y'):
        #     return True
        # return False


class PedigreeMetadata:

    def __init__(self, vapp, rows, project, institution, ingestion_id, counter=1):
        self.virtualapp = vapp
        self.rows = rows
        self.project = project.get('name')
        self.project_atid = project.get('@id')
        self.institution = institution.get('name')
        self.institution_atid = institution.get('@id')
        self.ingestion_id = ingestion_id
        self.counter = counter
        self.metadata = []
        self.individuals = {}
        self.families = {}
        self.errors = []
        self.json_out = {}
        self.process_rows()
        self.create_json_out()

    def add_individual_metadata(self, item):
        """
        Looks at metadata from a PedigreeRow object, one DB itemtype at a time
        and compares and adds it. If each item is not
        already represented in metadata for current AccessionMetadata instance,
        it is added; if it is represented, missing fields are added to item.
        """
        previous = self.individuals
        prev = [p for p in previous.keys()]
        if item.alias not in prev:
            previous[item.alias] = item.metadata
        else:
            for key in item.metadata:
                if key not in previous[item.alias]:
                    previous[item.alias][key] = item.metadata[key]

    def add_family_metadata(self):
        """
        Creates family metadata based on family_id for each individual in sheet.

        In some scenarios we will have multiple Family items in the DB for the same family,
        if the proband needs to be changed (e.g. the family has 2 affected siblings). In these cases
        we want to update the family history for both families, so we will look up the family ID and patch
        all families with the ID.
        """
        family_metadata = {}
        for alias, item in self.individuals.items():
            family_metadata.setdefault(
                item['family_id'],
                {'family_id': item['family_id'], 'members': [], 'ingestion_ids': [self.ingestion_id]}
            )
            family_metadata[item['family_id']]['members'].append(alias)
            if item.get('proband', False):
                if 'proband' not in family_metadata[item['family_id']]:
                    family_metadata[item['family_id']]['proband'] = alias
                    family_metadata[item['family_id']]['aliases'] = [
                        self.project + ':family-' + item['individual_id']
                    ]
                else:
                    msg = (f'More than one proband indicated for family {item["family_id"]}.'
                           ' Please indicate a single proband in the spreadsheet and resubmit.')
                    self.errors.append(msg)
            del item['family_id']
        final_family_dict = {}
        for key, value in family_metadata.items():
            try:
                family_matches = self.virtualapp.get(f'/search/?type=Family&family_id={key}')
            except Exception:
                # if family not in DB, create a new one
                # first make sure a proband is indicated for a family if its not already in DB
                if not value.get('proband'):
                    msg = f'No proband indicated for family {value["family_id"]}. Please edit and resubmit.'
                    self.errors.append(msg)
                else:
                    final_family_dict[value['aliases'][0]] = value
            else:
                for match in family_matches.json['@graph']:
                    final_family_dict[match['@id']] = value
                    if value.get('proband'):
                        phenotypes = list(set([item['phenotypic_feature'] for item in
                                      self.individuals[value['proband']].get('phenotypic_features', [])]))
                        # Add other family member phenotypes if proband phenotypes < 4
                        if len(phenotypes) < 4:
                            for member in value['members']:
                                if member != value['proband']:
                                    member_phenotypes = [item['phenotypic_feature'] for item in
                                                         self.individuals[member].get('phenotypic_features', [])]
                                    phenotypes.extend(member_phenotypes)
                                    phenotypes = list(set(phenotypes))
                                    if len(phenotypes) >= 4:
                                        break
                        if phenotypes:
                            final_family_dict[match['@id']]['family_phenotypic_features'] = phenotypes[:4]
                        del final_family_dict[match['@id']]['proband']
                        del final_family_dict[match['@id']]['aliases']
        return final_family_dict

    def check_individuals(self):
        """
        Make sure that every value in mother ID or father ID columns are also in sheet in same family.
        If a mother or father ID does not have a line in the sheet, just create minimal metadata for it
        and add it to the family.
        """
        parent_dict = {'mother': 'F', 'father': 'M'}
        for fam_alias, fam_metadata in self.families.items():
            for member in fam_metadata['members']:
                individual = self.individuals[member]
                for parent in ['mother', 'father']:
                    if individual.get(parent):
                        if individual[parent] not in fam_metadata['members']:
                            info = {
                                'individual_id': individual[parent],
                                'sex': parent_dict[parent]
                            }
                            self.individuals[individual[parent]] = info
                            fam_metadata['members'].append(individual[parent])

    def process_rows(self):
        """
        Method for iterating over spreadsheet rows to process each one and compare it to previous rows.
        """
        for i, row in enumerate(self.rows):
            try:
                processed_row = PedigreeRow(row, i + 1 + self.counter, self.project, self.institution)
                self.errors.extend(processed_row.errors)
                self.add_individual_metadata(processed_row.individual)
            except AttributeError as e:
                continue
        self.families = self.add_family_metadata()
        self.check_individuals()

    def create_json_out(self):
        """
        Creates final json that can be used for subsequent validation function.
        """
        itemtype_dict = {
            'family': self.families,
            'individual': self.individuals
        }
        for key in itemtype_dict:
            self.json_out[key] = {}
            for alias, metadata in itemtype_dict[key].items():
                new_metadata = {k: v for k, v in metadata.items() if v}
                new_metadata['project'] = self.project_atid
                new_metadata['institution'] = self.institution_atid
                if key == 'individual' and 'proband' in new_metadata:
                    del new_metadata['proband']
                self.json_out[key][alias] = new_metadata
            self.json_out['errors'] = self.errors


class SpreadsheetProcessing:
    """
    class that holds relevant information for processing of a single spreadsheet.
    After initial processing of header and rows, will create an instance of relevant
    'Metadata' class to hold all metadata extracted from spreadsheet.
    """

    REQUIRED_COLUMNS = []
    METADATA_CLASS = None
    SKIP = 0  # handles number of args required to instantiate relevant Metadata class

    def __init__(self, vapp, xls_data, project, institution, ingestion_id, submission_type='accessioning'):
        self.virtualapp = vapp
        self.input = xls_data
        self.project = project
        self.institution = institution
        self.ingestion_id = ingestion_id
        self.submission_type = submission_type
        self.output = {}
        self.errors = []
        self.keys = []
        self.counter = 0
        self.rows = []
        self.passing = False
        if self.header_found():
            self.create_row_dict()
        if self.rows:
            self.extract_metadata()

    def header_found(self):
        """
        The header we are looking for may not always be the first row - some iterations of the
        submission spreadsheet had super-headings to group columns into categories.
        """
        while self.input:
            try:
                keys = next(self.input)
                self.keys = [key.lower().strip().rstrip('*: ') for key in keys]
                self.counter += 1
                if 'individual id' in self.keys:
                    return True
            except StopIteration:
                break
        msg = 'Column headers not detected in spreadsheet! "Individual ID*" column must be present in header.'
        self.errors.append(msg)
        return False

    def create_row_dict(self):
        """
        Turns each row into a dictionary of form {column heading1: row value1, ...}
        """
        missing = [col for col in self.REQUIRED_COLUMNS if col not in self.keys]
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
        current_args = [self.virtualapp, self.rows, self.project,
                        self.institution, self.ingestion_id, self.counter]
        result = self.METADATA_CLASS(*current_args[self.SKIP:])
        self.output = result.json_out
        self.errors.extend(result.errors)
        self.passing = True


class AccessionProcessing(SpreadsheetProcessing):
    """
    class that holds relevant information for processing of a single accessioning spreadsheet.
    After initial processing of header and rows, will create an instance of AccessionMetadata
    to hold all metadata extracted from spreadsheet.
    """
    REQUIRED_COLUMNS = REQUIRED_COLS_FOR_ACCESSIONING
    METADATA_CLASS = AccessionMetadata
    SKIP = 1  # vapp arg not needed for instantiation of this class (only PedigreeMetadata)


class PedigreeProcessing(SpreadsheetProcessing):
    """
    class that holds relevant information for processing of a single pedigree/family history spreadsheet.
    After initial processing of header and rows, will create an instance of PedigreeMetadata
    to hold all metadata extracted from spreadsheet.
    """
    REQUIRED_COLUMNS = REQUIRED_COLS_FOR_PEDIGREE
    METADATA_CLASS = PedigreeMetadata


def xls_to_json(vapp, xls_data, project, institution, ingestion_id, submission_type):
    """
    Wrapper for SpreadsheetProcessing that returns expected values:
    result.output - metadata to be submitted in json
    result.passing - whether submission "passes" this part of the code and can move
        on to the next step.
    """
    if submission_type == 'accessioning':
        result = AccessionProcessing(vapp, xls_data=xls_data, project=project, institution=institution,
                                     ingestion_id=ingestion_id, submission_type=submission_type)
    elif submission_type == 'family_history':
        result = PedigreeProcessing(vapp, xls_data=xls_data, project=project, institution=institution,
                                     ingestion_id=ingestion_id, submission_type=submission_type)
    else:
        raise ValueError(f'{submission_type} is not a valid submission_type argument,'
                         ' expected values are "accessioning" or "family_history"')
    result.output['errors'] = result.errors
    return result.output, result.passing


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
            ignored(validation)  # should it be? why did we assign it? -kmp 18-Sep-2020
        except (AppError, VirtualAppError) as e:
            return parse_exception(e, aliases)
        else:
            return
    elif method == 'patch':
        try:
            validation = virtualapp.patch_json(atid + '?check_only=true', data, status=200)
            ignored(validation)  # should it be? why did we assign it? -kmp 18-Sep-2020
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
                if error.startswith('Schema: '):
                    error = error[8:]
                if error.index('- ') > 0:
                    field_name = error[:error.index(' - ')]
                    field = None
                    if field_name in GENERIC_FIELD_MAPPINGS['sample'].values():
                        field = [key for key, val in GENERIC_FIELD_MAPPINGS['sample'].items() if val == field_name][0]
                    elif field_name == 'requisition_acceptance.accepted_rejected':
                        field = 'Req Accepted Y\\N'
                    error = map_enum_options(field_name, error)
                    if not field:
                        field = field_name.replace('_', ' ')
                    error = 'field: ' + error.replace(field_name, field)
                    if 'phenotypic feature' in field:
                        if 'family phenotypic features' in field:
                            # family phenotypic features error is redundant to individual phenotypes
                            # from POV of user, so remove
                            continue
                        if '/phenotypes/' in error:  # find term name instead of @id
                            hpo_idx = error.index('/phenotypes/') + 12
                            hpo_term = error[hpo_idx:error.index('/', hpo_idx)]
                        else:
                            hpo_term = error.split("\'")[1]
                        if error.endswith('not found'):
                            error = ('HPO terms - HPO term {} not found in database.'
                                    ' Please check HPO ID and resubmit.'.format(hpo_term))
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
            if (db_item.get('status') in ['uploading', 'upload failed', 'to be uploaded by workflow']
                    or json_item['filename'].split('/')[-1] != db_item.get('filename')):
                to_patch['filename'] = json_item['filename']
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
            if field != 'aliases':
                if profile['properties'][field].get('items', {}).get('linkTo'):
                    val = [aliases[v] if v in aliases else v for v in json_item[field]]
                elif profile['properties'][field].get('items', {}).get('type') == 'object':
                    val = [  # handle sub-embedded object with or without linkTo
                        dict([(k, aliases[v]) if v in aliases else (k, v) for k, v in dict_item.items()])
                        for dict_item in json_item[field]
                    ]
                elif profile['properties'][field].get('items', {}).get('type') == 'string':
                    val = [v for v in json_item[field]]
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
    output = []
    if list(json_data.keys()) == ['errors']:
        output.append('Errors found in spreadsheet columns. Please fix spreadsheet before submitting.')
        return {}, output, False
    alias_dict = {}
    errors = json_data['errors']
    all_aliases = [k for itype in json_data for k in json_data[itype]]
    json_data_final = {'post': {}, 'patch': {}}
    validation_results = {}
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
                        json_data_final['post'].setdefault(itemtype, [])
                        json_data_final['post'][itemtype].append(json_data[itemtype][alias])
                        validation_results[itemtype]['validated'] += 1
                else:
                    # patch if item exists in db
                    patch_data = compare_fields(profile, alias_dict, data, db_results[alias])
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
                        if patch_data:
                            json_data_final['patch'].setdefault(itemtype, {})
                            json_data_final['patch'][itemtype][db_results[alias]['@id']] = patch_data
                        elif itemtype not in ['case', 'report', 'sample_processing', 'file_fastq']:
                            if itemtype == 'family' and ':' not in alias:
                                item_name = data.get('family_id')
                            else:
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
    item_names = {'individual': 'individual_id', 'family': 'family_id', 'sample': 'bam_sample_id'}
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
                        if patch_info:
                            json_data_final['patch'][k][atid] = patch_info
                        if k in item_names:
                            output.append('Success - {} {} posted'.format(k, item[item_names[k]]))
                        if fname:
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
                output.append('{}: {} created (with POST); {} failed creation'.format(itype,
                                      n_of(final_status[itype]['posted'], 'item'),
                                      n_of(final_status[itype]['not posted'], 'item')))
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
                    if fname:
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
            output.append('{}: attributes of {} updated (with PATCH);'
                          ' {} failed updating'.format(
                                    k, n_of(final_status[k]['patched'], 'item'),
                                    n_of(final_status[k]['not patched'], 'item')))
    return output, no_errors, files


def cell_value(cell):
    """Get cell value from excel. [From Submit4DN]"""
    # This should be always returning text format
    ctype = cell.data_type
    value = cell.value
    if ctype == openpyxl.cell.cell.TYPE_ERROR:  # pragma: no cover
        raise ValueError('Cell %s contains a cell error' % str(cell.coordinate))
    elif ctype == openpyxl.cell.cell.TYPE_BOOL:
        return str(value).upper().strip()
    elif ctype in (openpyxl.cell.cell.TYPE_NUMERIC, openpyxl.cell.cell.TYPE_NULL):
        if isinstance(value, float):
            if value.is_integer():
                value = int(value)
        if not value:
            value = ''
        return str(value).strip()
    elif isinstance(value, openpyxl.cell.cell.TIME_TYPES):
        if isinstance(value, datetime.datetime):
            if value.time() == datetime.time(0, 0, 0):
                return value.date().isoformat()
            else:  # pragma: no cover
                return value.isoformat()
        else:
            return value.isoformat()
    elif ctype in (openpyxl.cell.cell.TYPE_STRING, openpyxl.cell.cell.TYPE_INLINE):
        return value.strip()
    raise ValueError(
        'Cell %s is not an acceptable cell type' % str(cell.coordinate)
    )  # pragma: no cover


def row_generator(sheet):
    """Generator that gets rows from excel sheet [From Submit4DN]"""
    for row in sheet.rows:
        yield [cell_value(cell) for cell in row]
