import pytest
pytestmark = [pytest.mark.working, pytest.mark.schema]


def test_calculated_variant_consequence_display_title(testapp, project, institution):
    var_conseq_info = {
        'SO:0001893': ['transcript_ablation', 'Transcript ablation'],
        'SO:0001626': ['incomplete_terminal_codon_variant', 'Incomplete terminal codon variant'],
    }
    for vcid, vcnames in var_conseq_info.items():
        vc = {
            'project': project['@id'],
            'institution': institution['@id'],
            'var_conseq_id': vcid,
            'var_conseq_name': vcnames[0]
        }
        res = testapp.post_json('/variant_consequence', vc, status=201).json['@graph'][0]
        assert res.get('display_title') == vcnames[1]
