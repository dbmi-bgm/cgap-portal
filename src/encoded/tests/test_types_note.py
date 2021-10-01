import pytest


note1_uuid = "ab5e1c89-4c88-4a3e-a306-d37a12defd8b"
note2_uuid = "de5e1c12-4c88-4a3e-a306-d37a12defa6b"
variant_with_note = "f6aef055-4c88-4a3e-a306-d37a71535d8b"


@pytest.fixture
def new_interpretation():
    return {
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
        "note_text": "This variant is reported in the ClinVar database as associated with Syndrome X.",
        "acmg_guidelines": ["PVS1", "PM2"],
        "acmg_rules_invoked": [
            {"acmg_rule_name": "PM3", "rule_strength": "Strong"},
            {"acmg_rule_name": "PM6"},
            {"acmg_rule_name": "PP1", "rule_strength": "Moderate"},
            {"acmg_rule_name": "PP2", "rule_strength": "Default"}
        ],
        "conclusion": "For this reason, the variant has been classified as likely pathogenic.",
        "classification": "Likely pathogenic"
    }


@pytest.fixture
def new_discovery_note():
    return {
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
        "note_text": "This variant is a candidate for association with Syndrome X.",
        "variant_candidacy": "Moderate candidate"
    }


@pytest.fixture
def new_standard_note():
    return {
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
        "note_text": "Random notes about an item.",
        "associated_items": [
            {"item_type": "Variant", "item_identifier": variant_with_note}
        ]
    }


@pytest.fixture
def gene1_es(es_testapp):
    item = {
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
        "gene_symbol": "GENEID1",
        "ensgid": "ENSG00000000001"
    }
    return es_testapp.post_json('/gene', item).json['@graph'][0]


@pytest.fixture
def test_report(es_testapp):
    data = {
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
        "description": "This is a report for a case."
    }
    return es_testapp.post_json('/report', data, status=201).json['@graph'][0]


def post_note(testapp, item, note_type='note_interpretation', expected_status=201):
    """ helper function for posting notes in tests """
    return testapp.post_json('/' + note_type, item, status=expected_status)


def test_note_interpretation_note_link(workbook, es_testapp):
    """ test previous_note linkTo works on workbook insert notes """
    resp1 = es_testapp.get(f'/notes-interpretation/{note1_uuid}/', status=200).json
    resp2 = es_testapp.get(f'/notes-interpretation/{note2_uuid}/', status=200).json
    assert resp1['previous_note']['@id'] == resp2['@id']

def test_add_note_interpretation_success(workbook, es_testapp, new_interpretation):
    """ test NoteInterpretation item posts successfully """
    post_note(es_testapp, new_interpretation)

def test_add_note_interpretation_fail(workbook, es_testapp, new_interpretation):
    """ test NoteInterpretation item fails to post when schema isn't followed """
    new_interpretation['classification'] = 'likely pathogenic'  # wrong case for enum
    post_note(es_testapp, new_interpretation, expected_status=422)

def test_patch_note_interpretation_success(workbook, es_testapp, new_interpretation):
    """ test NoteIntepretation item is patched successfully when associated_items SOEA is added """
    resp = post_note(es_testapp, new_interpretation).json['@graph'][0]
    patch_info = {
        'associated_items': [{"item_type": "Variant", "item_identifier": variant_with_note}]
    }
    es_testapp.patch_json('/' + resp['@id'], patch_info, status=200)

def test_patch_note_interpretation_fail(workbook, es_testapp, new_interpretation):
    """ test NoteInterpretation item fails to patch with incorrectly formatted prop """
    resp = post_note(es_testapp, new_interpretation).json['@graph'][0]
    patch_info = {
        'associated_items': {"item_type": "Variant", "item_identifier": variant_with_note}  # wrong type
    }
    es_testapp.patch_json('/' + resp['@id'], patch_info, status=422)

def test_note_interpretation_acmg_rules_modified(workbook, es_testapp, new_interpretation):
    """
    Tests the acmg_rules_with_modifier calculated property.
    Tests that
    - each rule in acmg_rules_invoked is added to calc prop with correct modifier (or none)
    - none of the deprecated acmg_guidelines get added
    """
    resp = post_note(es_testapp, new_interpretation).json['@graph'][0]
    rules_with_strength = resp.get('acmg_rules_with_modifier')
    assert rules_with_strength
    assert sorted(rules_with_strength) == ["PM3_Strong", "PM6", "PP1_Moderate", "PP2"]

def test_add_note_discovery_success(workbook, es_testapp, new_discovery_note):
    """ test NoteDiscovery item posts successfully """
    post_note(es_testapp, new_discovery_note, note_type='note_discovery')

def test_add_note_discovery_fail(workbook, es_testapp, new_discovery_note):
    """ test NoteDiscovery item fails to post when schema isn't followed """
    new_discovery_note['gene_candidacy'] = 'Tier 1'  # wrong value for enum
    post_note(es_testapp, new_discovery_note, note_type='note_discovery', expected_status=422)

def test_patch_note_discovery_success(workbook, es_testapp, new_discovery_note):
    """ test NoteDiscovery item is patched successfully when associated_items SOEA is added """
    resp = post_note(es_testapp, new_discovery_note, note_type='note_discovery').json['@graph'][0]
    patch_info = {
        'associated_items': [{"item_type": "Variant", "item_identifier": variant_with_note}]
    }
    es_testapp.patch_json('/' + resp['@id'], patch_info, status=200)

def test_patch_note_discovery_fail(workbook, es_testapp, new_discovery_note):
    """ test NoteDiscovery item fails to patch with incorrectly formatted prop """
    resp = post_note(es_testapp, new_discovery_note, note_type='note_discovery').json['@graph'][0]
    patch_info = {
        'associated_items': {"item_type": "Variant", "item_identifier": variant_with_note}  # wrong prop type
    }
    es_testapp.patch_json('/' + resp['@id'], patch_info, status=422)

def test_add_standard_note_success(workbook, es_testapp, new_standard_note):
    """ test NoteStandard item posts successfully """
    post_note(es_testapp, new_standard_note, note_type='note_standard')

def test_add_standard_note_fail(workbook, es_testapp, new_standard_note):
    """ test NoteStandard item post fails when extra prop added """
    new_standard_note['classification'] = 'benign'  # not a standard note property
    post_note(es_testapp, new_standard_note, note_type='note_standard', expected_status=422)

def test_patch_standard_note_success(workbook, es_testapp, new_standard_note):
    """ test NoteStandard item patches successfully """
    resp = post_note(es_testapp, new_standard_note, note_type='note_standard').json['@graph'][0]
    patch_info = {"note_text": "Some different text"}
    es_testapp.patch_json('/' + resp['@id'], patch_info, status=200)

def test_patch_standard_note_fail(workbook, es_testapp, new_standard_note):
    """ test NoteStandard item patch fails with extra property """
    resp = post_note(es_testapp, new_standard_note, note_type='note_standard').json['@graph'][0]
    patch_info = {"conclusion": "For these reasons we made a conclusion."}  # not a std note property
    es_testapp.patch_json('/' + resp['@id'], patch_info, status=422)

def test_link_standard_note_to_report(workbook, es_testapp, new_standard_note, test_report):
    """ test NoteStandard linkTo on Report item works """
    note = post_note(es_testapp, new_standard_note, note_type='note_standard').json['@graph'][0]
    patch = {'extra_notes': [note['@id']]}
    resp = es_testapp.patch_json('/' + test_report['@id'], patch, status=200).json['@graph'][0]
    assert resp['extra_notes'] == [note['@id']]

def test_add_note_to_gene(workbook, es_testapp, gene1_es):
    """ test linking note to gene """
    note_info = es_testapp.get(f'/notes-interpretation/{note1_uuid}/', status=200).json
    patch = {'interpretations': [note1_uuid]}
    resp = es_testapp.patch_json('/' + gene1_es['@id'], patch, status=200).json['@graph'][0]
    assert resp['interpretations'] == [note_info['@id']]

def test_add_note_to_variant_sample(workbook, es_testapp, test_variant_sample):
    """ test linking note to variant sample item """
    note_info = es_testapp.get(f'/notes-interpretation/{note1_uuid}/', status=200).json
    vs = es_testapp.post_json('/variant_sample', test_variant_sample, status=201).json['@graph'][0]
    patch = {'interpretation': note1_uuid}
    vs_patch = es_testapp.patch_json('/' + vs['@id'], patch, status=200).json['@graph'][0]
    assert vs_patch['interpretation'] == note_info['@id']
