import pytest
from pkg_resources import resource_listdir
from snovault.schema_utils import load_schema
from snovault.util import crawl_schema
import re

pytestmark = [pytest.mark.setone, pytest.mark.working, pytest.mark.schema]

SCHEMA_FILES = [
    f for f in resource_listdir('encoded', 'schemas')
    if f.endswith('.json') and 'embeds' not in f
]


@pytest.fixture
def pattern_fields():
    ''' This fixture returns a dictionary keyed by schema fields that use the 'pattern' attribute.
        The value is a dict of 2 lists:
            'good' is list of values that should pass the pattern regex
            'bad'  is list of values that should fail the pattern regex
        This fixture is used in test_load_schema
        More fields can be added if more pattern attributes are added to fields
    '''
    return {
        'schema_version': {  # "^\\d+(\\.\\d+)*$"
            'good': ['1', '20', '3.2', '30.11'],
            'bad': ['.9', 'A', '1a', '1.b', 'A.1']
        },
        'aliases': {  # "^[^\\s\\\\\\/]+:[^\\s\\\\\\/]+$"
            'good': ['test-lab:asdf', 'test:lab999', 'test:test:test'],
            'bad': ['test', 'one : big', 'test:la/b', 'one:bi gone']
        },
        'filename': {  # "^[\\w+=,.@-]*$"
            'good': ['test_file', 'test-file', 'test@fi+le', 'test,=file', 'file-17.fastq.gz'],
            'bad': ['file w a space', 'file/w/slashes', 'test%file', 'test!file', ' testfile', 'testfile ']
        },
        'ensgid': {  # "^ENSG[0-9]{11}$"
            'good': ['ENSG11111111111'],
            'bad': ['ensg11111111111', 'AENSG1111111111', '1111ENSG1111111', 'ENSG11111111', ' ENSG11111111111', 'ENSG11111111111 ']
        },
        'ucsc_id': {  # "^uc[0-9]{3}[a-z]{3}\\.[0-9]$"
            'good': ['uc031tlb.1', 'uc001aak.4', 'uc010nxu.2'],
            'bad': ['UC031tlb.1', 'ww001aak.4', 'uc010ucnxu.2', 'uc 010nxu.2', 'uc010nxu_2']
        },
        'refseq_accession': {  # "^(A|N|W|X|Y)(C|G|M|P|R|T|W)_[0-9]+"
            'good': ['NR_046018', 'XR_001737835' 'NG_004148', 'NM_001005484'],
            'bad': ['MN_001005484', 'xr_001737835', 'NR046018', 'NZ_046018', 'NR_046018P', 'NR_0 46018', ' NR_046018']
        },
        'ccds_id': {  # "^CCDS[0-9]+"
            'good': ['CCDS30547', 'CCDS2', 'CCDS3'],
            'bad': [' CCDS30547', 'CCDS30547 ', 'CCCDS30547', 'ccds30547', 'CCDS30547D', 'CCDS30547.1', 'CCDS:30547', 'CCDS 30547']
        },
        'mgd_id': {  # "^MGI:[0-9]+"
            'good': ['MGI:3031137', 'MGI:2446220', 'MGI:1931051'],
            'bad': ['MGI3031137', ' MGI:3031137', 'MGI:3031137 ', 'mgi3031137', 'MGI 3031137', 'MGI:3031137:', 'MGI:3031137M', 'MGI 3031137']
        },
        'omim_id': {  # "^[0-9]+$"
            'good': ['103320', '6', '00612090'],
            'bad': [' 1003320', '103320 ', '103 320', '103a320', '103320.1', '103_320', 'v103320']
        },
        'orphanet': {  # "^[0-9]+$"
            'good': ['103320', '6', '00612090'],
            'bad': [' 1003320', '103320 ', '103 320', '103a320', '103320.1', '103_320', 'v103320']
        },
        'ClinGen': {  # "^[0-9]+$"
            'good': ['103320', '6', '00612090'],
            'bad': [' 1003320', '103320 ', '103 320', '103a320', '103320.1', '103_320', 'v103320']
        },
        'clingendis.disease_id': {  # "^MONDO_[0-9]+$"
            'good': ['MONDO_103320', 'MONDO_6', 'MONDO_00612090'],
            'bad': [' MONDO_1003320', 'MONDO_103320 ', 'MONDO:103320', 'MONDO_103a320', 'MONDO_103320.1', 'MONDO_103_320', 'MONDO_v103320']
        },
        'transcript.enstid': {  # ^ENST[0-9]{11}$"
            'good': ['ENST11111111111'],
            'bad': ['enst11111111111', 'AENST111111111', '1111ENST1111111', 'ENST11111111', ' ENST11111111111', 'ENST11111111111 ']
        },
        'transcript.enspid': {  # ^ENSP[0-9]{11}$"
            'good': ['ENSP11111111111'],
            'bad': ['ensp11111111111', 'AENSP1111111111', '1111ENSP1111111', 'ENSP11111111', ' ENSP11111111111', 'ENSP11111111111 ']
        }
    }


@pytest.fixture(scope='module')
def master_mixins():
    mixins = load_schema('encoded:schemas/mixins.json')
    mixin_keys = [
        'schema_version',
        'uuid',
        'accession',
        'aliases',
        'status',
        'submitted',
        'modified',
        'attribution',
        'notes',
        'documents',
        'attachment',
        'dbxrefs',
        'alternative_ids',
        'static_embeds',
        'tags',
        'facets_common',
        'supplementary_files'
    ]
    for key in mixin_keys:
        assert(mixins[key])


def camel_case(name):
    return ''.join(x for x in name.title() if not x == '_')


def pluralize(name):
    name = name.replace('_', '-')
    # deal with a few special cases explicitly
    specials = ['file', 'quality-metric', 'summary-statistic', 'workflow-run']
    for sp in specials:
        if name.startswith(sp) and re.search('-(set|flag|format|type)', name) is None:
            return name.replace(sp, sp + 's')
        elif name.startswith(sp) and re.search('setting', name):
            return name.replace(sp, sp + 's')
    # otherwise just add 's/es/ies'
    if name.endswith('ly'):
        return name[:-1] + 'ies'
    if name.endswith('s'):
        return name + 'es'
    return name + 's'


# XXX: Mismatch with image.json?
@pytest.mark.parametrize('schema', [k for k in SCHEMA_FILES if k != 'image.json'])
def test_load_schema(schema, master_mixins, registry, pattern_fields, testapp):
    from snovault import TYPES
    from snovault import COLLECTIONS

    abstract = [
        'microscope_setting.json',
        'experiment.json',
        'file.json',
        'individual.json',
        'quality_metric.json',
        'treatment.json',
        'workflow_run.json',
        'user_content.json',
        'evidence.json'
    ]

    loaded_schema = load_schema('encoded:schemas/%s' % schema)
    assert(loaded_schema)

    typename = schema.replace('.json', '')
    collection_names = [camel_case(typename), pluralize(typename)]

    # see if there is a pattern field and if so test the regex (uses fixture)
    schema_props = loaded_schema.get('properties')
    for field, test_values in pattern_fields.items():
        if schema_props and field in schema_props:
            pattern = schema_props.get(field).get('pattern')  # will sometimes be None if mixed in from elsewhere
            if pattern is None:
                continue
            if not test_values:
                continue
            regex = re.compile(pattern)
            good_vals = test_values.get('good', [])
            bad_vals = test_values.get('bad', [])
            assert all([regex.search(tv) for tv in good_vals if good_vals])
            assert not any([regex.search(bv) for bv in bad_vals if bad_vals])

    # check the mixin properties for each schema
    if not schema == ('mixins.json'):
        verify_mixins(loaded_schema, master_mixins)

    if schema not in ['namespaces.json', 'mixins.json']:
        # check that schema.id is same as /profiles/schema
        idtag = loaded_schema['id']
        idtag = idtag.replace('/profiles/', '')
        # special case for access_key.json
        if schema == 'access_key.json':
            idtag = idtag.replace('_admin', '')
        assert schema == idtag

        # check for pluralized and camel cased in collection_names
        val = None
        for name in collection_names:
            assert name in registry[COLLECTIONS]
            if val is not None:
                assert registry[COLLECTIONS][name] == val
            else:
                val = registry[COLLECTIONS][name]

        if schema not in abstract:
            # check schema w/o json extension is in registry[TYPES]
            assert typename in registry[TYPES].by_item_type
            assert typename in registry[COLLECTIONS]
            assert registry[COLLECTIONS][typename] == val

            shared_properties = [
                'uuid',
                'schema_version',
                'aliases',
                'date_created',
                'submitted_by',
                'last_modified',
                'status'
            ]
            no_alias_or_attribution = [
                'user.json', 'project.json', 'institution.json', 'organism.json',
                'page.json',
                'static_section.json', 'badge.json', 'tracking_item.json',
                'file_format.json', 'experiment_type.json', 'higlass_view_config.json'
            ]
            for prop in shared_properties:
                if schema == 'experiment.json':
                    # currently experiment is abstract and has no mixin properties
                    continue
                if schema == 'access_key.json' and prop not in ['uuid', 'schema_version']:
                    continue
                if schema in no_alias_or_attribution and prop in ['aliases', 'institution', 'project']:
                    continue
                verify_property(loaded_schema, prop)


def verify_property(loaded_schema, property):
    assert(loaded_schema['properties'][property])


def verify_mixins(loaded_schema, master_mixins):
    '''
    test to ensure that we didn't accidently overwrite mixins somehow
    '''
    for mixin in loaded_schema.get('mixinProperties', []):
        # get the mixin name from {'$ref':'mixins.json#/schema_version'}
        mixin_file_name, mixin_name = mixin['$ref'].split('/')
        if mixin_file_name != "mixins.json":
            # skip any mixins not in main mixins.json
            continue
        mixin_schema = master_mixins[mixin_name]

        # each field in the mixin should be present in the parent schema with same properties
        for mixin_field_name, mixin_field in mixin_schema.items():
            schema_field = loaded_schema['properties'][mixin_field_name]
            for key in mixin_field.keys():
                assert mixin_field[key] == schema_field[key]


def test_linkTo_saves_uuid(root, submitter, institution):
    item = root['users'][submitter['uuid']]
    assert item.properties['submits_for'] == [institution['uuid']]


def test_mixinProperties():
    from snovault.schema_utils import load_schema
    schema = load_schema('encoded:schemas/access_key.json')
    assert schema['properties']['uuid']['type'] == 'string'


def test_dependencies(testapp):
    collection_url = '/testing-dependencies/'
    testapp.post_json(collection_url, {'dep1': 'dep1', 'dep2': 'dep2'}, status=201)
    testapp.post_json(collection_url, {'dep1': 'dep1'}, status=422)
    testapp.post_json(collection_url, {'dep2': 'dep2'}, status=422)
    testapp.post_json(collection_url, {'dep1': 'dep1', 'dep2': 'disallowed'}, status=422)


def test_changelogs(testapp, registry):
    from snovault import TYPES
    for typeinfo in registry[TYPES].by_item_type.values():
        changelog = typeinfo.schema.get('changelog')
        if changelog is not None:
            res = testapp.get(changelog)
            assert res.status_int == 200, changelog
            assert res.content_type == 'text/markdown'
