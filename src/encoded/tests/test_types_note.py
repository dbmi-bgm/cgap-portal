import pytest
from .workbook_fixtures import app, workbook


note1_uuid = "ab5e1c89-4c88-4a3e-a306-d37a12defd8b"
note2_uuid = "de5e1c12-4c88-4a3e-a306-d37a12defa6b"
variant_with_note = "f6aef055-4c88-4a3e-a306-d37a71535d8b"


@pytest.fixture
def new_interpretation():
    return {
        "project": "hms-dbmi",
        "institution": "hms-dbmi",
        "note_text": "This variant is reported in the ClinVar database as associated with Syndrome X.",
        "conclusion": "For this reason, the variant has been classified as likely pathogenic.",
        "classification": "likely pathogenic"
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


def post_note(testapp, item, note_type='note_interpretation', expected_status=201):
    """ helper function for posting notes in tests """
    return testapp.post_json('/' + note_type, item, status=expected_status)


def test_note_interpretation_note_link(workbook, testapp):
    """ test previous_note linkTo works on workbook insert notes """
    resp1 = testapp.get(f'/notes-interpretation/{note1_uuid}/', status=200).json
    resp2 = testapp.get(f'/notes-interpretation/{note2_uuid}/', status=200).json
    assert resp1['previous_note']['@id'] == resp2['@id']

def test_add_note_interpretation_success(workbook, testapp, new_interpretation):
    """ test NoteInterpretation item posts successfully """
    resp = post_note(testapp, new_interpretation)

def test_add_note_interpretation_fail(workbook, testapp, new_interpretation):
    """ test NoteInterpretation item fails to post when schema isn't followed """
    new_interpretation['classification'] = 'Likely Pathogenic'  # wrong case for enum
    resp = post_note(testapp, new_interpretation, expected_status=422)

def test_patch_note_interpretation_success(workbook, testapp, new_interpretation):
    """ test NoteIntepretation item is patched successfully when associated_items SOEA is added """
    resp = post_note(testapp, new_interpretation).json['@graph'][0]
    patch_info = {
        'associated_items': [{"item_type": "Variant", "item_identifier": variant_with_note}]
    }
    resp = testapp.patch_json('/' + resp['@id'], patch_info, status=200)

def test_patch_note_interpretation_fail(workbook, testapp, new_interpretation):
    """ test NoteInterpretation item fails to patch with incorrectly formatted prop """
    resp = post_note(testapp, new_interpretation).json['@graph'][0]
    patch_info = {
        'associated_items': {"item_type": "Variant", "item_identifier": variant_with_note}  # wrong type
    }
    resp = testapp.patch_json('/' + resp['@id'], patch_info, status=422)

def test_add_standard_note_success(workbook, testapp, new_standard_note):
    """ test NoteStandard item posts successfully """
    resp = post_note(testapp, new_standard_note, note_type='note_standard')

def test_add_standard_note_fail(workbook, testapp, new_standard_note):
    """ test NoteStandard item post fails when extra prop added """
    new_standard_note['classification'] = 'benign'  # not a standard note property
    resp = post_note(testapp, new_standard_note, note_type='note_standard', expected_status=422)

def test_patch_standard_note_success(workbook, testapp, new_standard_note):
    """ test NoteStandard item patches successfully """
    resp = post_note(testapp, new_standard_note, note_type='note_standard').json['@graph'][0]
    patch_info = {"note_text": "Some different text"}
    resp = testapp.patch_json('/' + resp['@id'], patch_info, status=200)

def test_patch_standard_note_fail(workbook, testapp, new_standard_note):
    """ test NoteStandard item patch fails with extra property """
    resp = post_note(testapp, new_standard_note, note_type='note_standard').json['@graph'][0]
    patch_info = {"conclusion": "For these reasons we made a conclusion."}  # not a std note property
    resp = testapp.patch_json('/' + resp['@id'], patch_info, status=422)

def test_link_standard_note_to_report(workbook, testapp, new_standard_note, test_report):
    """ test NoteStandard linkTo on Report item works """
    note = post_note(testapp, new_standard_note, note_type='note_standard').json['@graph'][0]
    patch = {'extra_notes': [note['@id']]}
    resp = testapp.patch_json('/' + test_report['@id'], patch, status=200).json['@graph'][0]
    assert resp['extra_notes'] == [note['@id']]

def test_add_note_to_gene(workbook, testapp, gene1):
    """ test linking note to gene """
    note_info = testapp.get(f'/notes-interpretation/{note1_uuid}/', status=200).json
    patch = {'interpretations': [note1_uuid]}
    resp = testapp.patch_json('/' + gene1['@id'], patch, status=200).json['@graph'][0]
    gene_get = testapp.get('/' + resp['@id']).json
    assert resp['interpretations'] == [note_info['@id']]

def test_add_note_to_variant_sample(workbook, testapp, test_variant_sample):
    """ test linking note to variant sample item """
    note_info = testapp.get(f'/notes-interpretation/{note1_uuid}/', status=200).json
    vs = testapp.post_json('/variant_sample', test_variant_sample, status=201).json['@graph'][0]
    patch = {'interpretations': [note1_uuid]}
    vs_patch = testapp.patch_json('/' + vs['@id'], patch, status=200).json['@graph'][0]
    assert vs_patch['interpretations'] == [note_info['@id']]
