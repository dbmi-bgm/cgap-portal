import json
import mock
import pytest
import webtest

from datetime import datetime, timedelta
from dcicutils.misc_utils import Retry, ignored
from dcicutils.qa_utils import notice_pytest_fixtures, local_attrs
from pyramid.httpexceptions import HTTPBadRequest
from snovault import TYPES, COLLECTIONS
from snovault.elasticsearch import create_mapping
from snovault.elasticsearch.indexer_utils import get_namespaced_index
from snovault.schema_utils import load_schema
from snovault.util import add_default_embeds
from webtest import AppError
from ..search.lucene_builder import LuceneBuilder
from ..search.search_utils import find_nested_path

pytestmark = [pytest.mark.working, pytest.mark.schema, pytest.mark.search, pytest.mark.workbook]


### IMPORTANT
# uses the inserts in ./data/workbook_inserts
# design your tests accordingly


def check_spreadsheet_rows(result_rows, colname_to_index):

    # Check presence of columns in the doc
    assert result_rows[0][1] == "Chrom (hg38)"
    assert result_rows[0][2] == "Pos (hg38)"
    assert result_rows[0][16] == "Canonical transcript ID"
    assert result_rows[0][17] == "Canonical transcript location"
    assert result_rows[0][25] == "Variant Quality"

    # Add all test cases to here
    expected_data = [
        {
            "Chrom (hg38)": "1",
            "Pos (hg38)": "2030666",
            "Chrom (hg19)": "1",
            "Pos (hg19)": "1962105",
            "Canonical transcript ID": "ENST00000378585",
            "Canonical transcript location": "Exon 9/9 (3′ UTR)",
            "Variant Quality": "688.12",
            "Genotype Quality": "99",
            "gnomADv3 popmax population": "East Asian",
            "LOEUF": "0.245"
        },
        {
            "Chrom (hg38)": "16",
            "Pos (hg38)": "23630011",
            "Canonical transcript ID": "ENST00000261584",
            "Canonical transcript location": "Exon 5/13",
            "Variant Quality": "261.94",
            "Genotype Quality": "24",
            "gnomADv3 popmax population": "",
            "LOEUF": "1.006"
        }
    ]

    curr_row_idx = 2 # Result row at index=1 is column descriptions.
    for ed in expected_data:
        for name, value in ed.items():
            assert result_rows[curr_row_idx][colname_to_index[name]] == value
        curr_row_idx += 1


def test_filtering_tab(workbook, html_es_testapp):

    compound_filterset_request_body = {
        "search_type":"VariantSample",
        "global_flags":"CALL_INFO=SAM10254-S1&file=GAPFI3EBH4X2&additional_facet=proband_only_inheritance_modes&sort=date_created",
        "intersect": False,
        "filter_blocks":[
            {
                "query":"associated_genotype_labels.proband_genotype_label=Heterozygous&associated_genelists=Breast+Cancer+%2828%29&variant.genes.genes_most_severe_consequence.impact=MODERATE&variant.genes.genes_most_severe_consequence.impact=HIGH",
                "flags_applied":[
                    
                ]
            },
            {
                "query":"GQ.from=60&GQ.to=99&associated_genotype_labels.proband_genotype_label=Heterozygous&associated_genelists=Familial+Cancer+%28148%29&variant.csq_clinvar_clnsig=Uncertain_significance&variant.csq_clinvar_clnsig=Pathogenic&variant.csq_gnomadg_af.from=0&variant.csq_gnomadg_af.to=0.001&variant.genes.genes_most_severe_consequence.impact=MODERATE&variant.genes.genes_most_severe_consequence.impact=HIGH",
                "flags_applied":[
                    
                ]
            },
            {
                "query":"variant.csq_gnomade2_af.from=0&variant.csq_gnomade2_af.to=0.001&variant.csq_gnomadg_af.from=0&variant.csq_gnomadg_af.to=0.001",
                "flags_applied":[
                    
                ]
            }
        ]
    }

    res = html_es_testapp.post(
        '/variant-sample-search-spreadsheet/',
        {
            "compound_search_request": json.dumps(compound_filterset_request_body)
        },
        content_type="application/x-www-form-urlencoded"
    )

    assert 'text/tsv' in res.content_type

    # All values are of type string when parsed below.
    result_rows = [ row.rstrip(' \r').split('\t') for row in res.body.decode('utf-8').split('\n') ]
    colname_to_index = { col_name: col_idx for col_idx, col_name in enumerate(result_rows[0]) }

    check_spreadsheet_rows(result_rows, colname_to_index)
    



def test_interpretation_tab(workbook, html_es_testapp):

    res = html_es_testapp.get(
        '/variant-sample-lists/292250e7-5cb7-4543-85b2-80cd318287b2/@@spreadsheet/suggested-filename-to-use.csv',
    )

    # Should infer from suggested filename ending in .tsv
    assert 'text/csv' in res.content_type

    # All values are of type string when parsed below.
    result_rows = [ row.rstrip(' \r').split('\t') for row in res.body.decode('utf-8').split('\n') ]
    colname_to_index = { col_name: col_idx for col_idx, col_name in enumerate(result_rows[0]) }

    check_spreadsheet_rows(result_rows, colname_to_index)

