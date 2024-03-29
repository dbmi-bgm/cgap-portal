import pytest
import csv
from ..inheritance_mode import InheritanceMode, InheritanceModeError
from ..util import resolve_file_path


pytestmark = [pytest.mark.setone, pytest.mark.working]


CSV_TESTS = resolve_file_path('tests/data/variant_workbook/inheritance_mode_test_data.csv')


def test_is_multiallelic_site_raises_error():
    """ Tests cases that should raise error. """
    with pytest.raises(InheritanceModeError):
        InheritanceMode.is_multiallelic_site(None)


@pytest.mark.parametrize('gts', [
    ['./.'],
    ['0/0'],
    ['0/1'],
    ['1/1'],
    ['1/0'],
    ['0/0', './.', '1/0']
])
def test_is_multiallelic_site_is_false(gts):
    """ Tests cases that should return False """
    assert InheritanceMode.is_multiallelic_site(gts) is False


@pytest.mark.parametrize('gts', [
    ['2/2'],
    ['2/0'],
    ['1/2'],
    ['0/2'],
    ['4/17'],
    ['0/0', '2/2']
])
def test_is_multiallelic_site_is_true(gts):
    """ Test cases that should return True """
    assert InheritanceMode.is_multiallelic_site(gts) is True


@pytest.mark.parametrize('gt, sex, chrom', [
    ('4/D', 'M', 'X'),
    ('1/1', 'F', 'D'),
    ('./.', 'R', '4')
])
def test_compute_genotype_label_raises_error(gt, sex, chrom):
    """ Tests error cases """
    with pytest.raises(InheritanceModeError):
        InheritanceMode.compute_genotype_label(gt=gt, sex=sex, chrom=chrom)


@pytest.mark.parametrize('gt, sex, chrom, expected', [
    ('./.', 'F', 'Y', InheritanceMode.GENOTYPE_LABEL_FEMALE_CHRY),
    ('./.', 'F', '3', InheritanceMode.GENOTYPE_LABEL_DOT),
    ('1/1', 'F', 'Y', InheritanceMode.GENOTYPE_LABEL_SEX_INCONSISTENT),
    ('0/0', 'F', 'Y', InheritanceMode.GENOTYPE_LABEL_FEMALE_CHRY),
    ('1/0', 'F', 'Y', InheritanceMode.GENOTYPE_LABEL_SEX_INCONSISTENT),
    ('0/1', 'F', 'Y', InheritanceMode.GENOTYPE_LABEL_SEX_INCONSISTENT),
    ('0/1', 'M', 'X', InheritanceMode.GENOTYPE_LABEL_SEX_INCONSISTENT),
    ('0/1', 'M', 'Y', InheritanceMode.GENOTYPE_LABEL_SEX_INCONSISTENT),
    ('0/0', 'M', 'Y', InheritanceMode.GENOTYPE_LABEL_0),
    ('0/0', 'M', 'X', InheritanceMode.GENOTYPE_LABEL_0),
    ('1/1', 'M', 'Y', InheritanceMode.GENOTYPE_LABEL_M),
    ('1/1', 'M', 'X', InheritanceMode.GENOTYPE_LABEL_M),
    ('0/0', 'M', '1', InheritanceMode.GENOTYPE_LABEL_00),
    ('0/1', 'M', '1', InheritanceMode.GENOTYPE_LABEL_0M),
    ('1/1', 'M', '1', InheritanceMode.GENOTYPE_LABEL_MM),
    ('2/1', 'M', '1', InheritanceMode.GENOTYPE_LABEL_MN),
    ('0/0', 'M', '5', InheritanceMode.GENOTYPE_LABEL_00),
    ('0/1', 'M', '3', InheritanceMode.GENOTYPE_LABEL_0M),
    ('1/1', 'M', '21', InheritanceMode.GENOTYPE_LABEL_MM),
    ('2/1', 'M', '9', InheritanceMode.GENOTYPE_LABEL_MN),
    ('0/1', 'U', 'Y', InheritanceMode.GENOTYPE_LABEL_SEX_AMBIGUOUS),
    ('0/1', 'U', 'X', InheritanceMode.GENOTYPE_LABEL_SEX_AMBIGUOUS),
    ('1/1', 'U', 'Y', InheritanceMode.GENOTYPE_LABEL_SEX_AMBIGUOUS),
    ('1/1', 'U', 'X', InheritanceMode.GENOTYPE_LABEL_SEX_AMBIGUOUS),
    ('0/1', 'U', '7', InheritanceMode.GENOTYPE_LABEL_0M),
    ('1/1', 'U', '7', InheritanceMode.GENOTYPE_LABEL_MM),
    ('2/1', 'U', '7', InheritanceMode.GENOTYPE_LABEL_MN)
])
def test_compute_genotype_label(gt, sex, chrom, expected):
    assert InheritanceMode.compute_genotype_label(gt=gt, sex=sex, chrom=chrom) == expected


@pytest.mark.parametrize('gts, sexes, chrom, expected_labels', [
    (  # test case 1
        {
            'proband': '1/1',
            'mother': '1/0',
            'father': '0/1'
        },
        {
            'proband': 'M',
            'mother': 'F',
            'father': 'M'
        },
        '5',
        {
            'proband': ['Homozygous alternate'],
            'mother': ['Heterozygous alt/alt -  multiallelic'],
            'father': ['Heterozygous']
        }
    ),
    (  # test case 2
        {
            'proband': '1/1',
            'mother': '1/1',
            'father': '0/1'
        },
        {
            'proband': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        {
            'proband': ['Homozygous alternate'],
            'mother': ['Homozygous alternate'],
            'father': ['False']
        }
    ),
    (  # test case 3
        {
            'proband': '0/1',
            'mother': '1/1',
            'father': '0/0'
        },
        {
            'proband': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        {
            'proband': ['Heterozygous'],
            'mother': ['Homozygous alternate'],
            'father': ['Hemizygous reference']
        }
    )
])
def test_compute_family_genotype_labels(gts, sexes, chrom, expected_labels):
    """ Tests a few family genotype labels - there are a lot of ways this can go, so look
        to automate testing somehow from a collection of examples. """
    actual_labels = InheritanceMode.compute_family_genotype_labels(gts, sexes, chrom)
    for key, value in actual_labels.items():
        assert expected_labels[key] == value
    for key, value in expected_labels.items():
        assert actual_labels[key] == value


@pytest.mark.parametrize('gts, gt_labels, sexes, chrom, novoPP, expected_inh', [
    (  # test case 1
        {
            'proband': '1/1',
            'mother': '1/0',
            'father': '0/1'
        },
        {
            'proband': ['Homozygous alternate'],
            'mother': ['Heterozygous alt/alt -  multiallelic'],
            'father': ['Heterozygous']
        },
        {
            'proband': 'M',
            'mother': 'F',
            'father': 'M'
        },
        '5',
        .05,
        []
    ),
    (  # test case 2
        {
            'proband': '1/1',
            'mother': '1/1',
            'father': '0/1'
        },
        {
            'proband': ['Homozygous alternate'],
            'mother': ['Homozygous alternate'],
            'father': ['False']
        },
        {
            'proband': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        .95,
        []
    ),
    (  # test case 3
        {
            'proband': '0/1',
            'mother': '1/1',
            'father': '0/0'
        },
        {
            'proband': ['Heterozygous'],
            'mother': ['Homozygous alternate'],
            'father': ['Hemizygous reference']
        },
        {
            'proband': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        .8,
        [InheritanceMode.INHMODE_LABEL_DE_NOVO_MEDIUM]
    ),
    (  # test case 4 - proband U
        {
            'proband': '0/1',
            'mother': '1/1',
            'father': '0/0'
        },
        {
            'proband': ['Ambiguous'],
            'mother': ['Homozygous alternate'],
            'father': ['Hemizygous reference']
        },
        {
            'proband': 'U',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        .8,
        []
    )
])
def test_compute_inheritance_mode_trio(gts, gt_labels, sexes, chrom, novoPP, expected_inh):
    """ Tests basic inheritance mode cases """
    assert InheritanceMode.compute_inheritance_mode_trio(genotypes=gts, genotype_labels=gt_labels,
                                                         sexes=sexes, chrom=chrom, novoPP=novoPP) == expected_inh

@pytest.mark.parametrize("genotypes, sexes, chrom, result",
    [
        (  # test case 1 - autosomal de novo
            {
                "proband": "0/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "F",
                "mother": "F",
                "father": "M"
            },
            "1",
            [InheritanceMode.INHMODE_LABEL_SV_DE_NOVO]
        ),
        (  # test case 2 - autosomal de novo
            {
                "proband": "1/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "F",
                "mother": "F",
                "father": "M"
            },
            "2",
            [InheritanceMode.INHMODE_LABEL_SV_DE_NOVO]
        ),
        (  # test case 3 - X-linked female de novo
            {
                "proband": "0/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "F",
                "mother": "F",
                "father": "M"
            },
            "X",
            [InheritanceMode.INHMODE_LABEL_SV_DE_NOVO]
        ),
        (  # test case 4 - X-linked female de novo
            {
                "proband": "1/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "F",
                "mother": "F",
                "father": "M"
            },
            "X",
            [InheritanceMode.INHMODE_LABEL_SV_DE_NOVO]
        ),
        (  # test case 5 - X-linked male de novo
            {
                "proband": "1/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "M",
                "mother": "F",
                "father": "M"
            },
            "X",
            [InheritanceMode.INHMODE_LABEL_SV_DE_NOVO]
        ),
        (  # test case 6 - Y-linked male de novo
            {
                "proband": "1/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "M",
                "mother": "F",
                "father": "M"
            },
            "Y",
            [InheritanceMode.INHMODE_LABEL_SV_DE_NOVO]
        ),
        (  # test case 7 - X-linked male 0/1
            {
                "proband": "0/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "M",
                "mother": "F",
                "father": "M"
            },
            "X",
            []
        ),
        (  # test case 8 - Y-linked male 0/1
            {
                "proband": "0/1",
                "mother": "0/0",
                "father": "0/0"
            },
            {
                "proband": "M",
                "mother": "F",
                "father": "M"
            },
            "Y",
            []
        ),
    ]
)
def test_compute_inheritance_mode_trio_structural_variant(
    genotypes, sexes, chrom, result
):
    """
    Test for SV-specific inheritance mode calculations.
    """
    genotype_labels = InheritanceMode.compute_family_genotype_labels(
        genotypes, sexes, chrom
    )
    assert InheritanceMode.compute_inheritance_mode_trio(
        genotypes=genotypes,
        genotype_labels=genotype_labels,
        sexes=sexes,
        chrom=chrom,
        novoPP=-1,
        structural_variant=True,
    ) == result

@pytest.mark.parametrize('variant_sample, expected_new_fields', [
    (  # test case 1
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_1'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F',
                    'samplegeno_sampleid': 'sample_id_2'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_3'
                },
            ],
            'novoPP': .95,
            'cmphet': None,
            'variant': {
                'CHROM': 1
            }
        },
        {
            'genotype_labels': [
                {'labels': ['Homozygous alternate'], 'role': 'proband', 'sample_id': 'sample_id_1'},
                {'labels': ['Heterozygous'], 'role': 'mother', 'sample_id': 'sample_id_2'},
                {'labels': ['Heterozygous'], 'role': 'father', 'sample_id': 'sample_id_3'}
            ],
            'inheritance_modes': ['de novo (strong)']
        }
    ),
    (  # test case 2
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_1'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F',
                    'samplegeno_sampleid': 'sample_id_2'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_3'
                },
            ],
            'novoPP': .5,
            'cmphet': None,
            'variant': {
                'CHROM': 1
            }
        },
        {
            'genotype_labels': [
                {'labels': ['Homozygous alternate'], 'role': 'proband', 'sample_id': 'sample_id_1'},
                {'labels': ['Heterozygous'], 'role': 'mother', 'sample_id': 'sample_id_2'},
                {'labels': ['Heterozygous'], 'role': 'father', 'sample_id': 'sample_id_3'}
            ],
            'inheritance_modes': ['de novo (medium)']
        }
    ),
    (  # test case 3
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_1'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F',
                    'samplegeno_sampleid': 'sample_id_2'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_3'
                },
            ],
            'novoPP': .05,
            'cmphet': None,
            'variant': {
                'CHROM': 1
            }
        },
        {
            'genotype_labels': [
                {'labels': ['Homozygous alternate'], 'role': 'proband', 'sample_id': 'sample_id_1'},
                {'labels': ['Heterozygous'], 'role': 'mother', 'sample_id': 'sample_id_2'},
                {'labels': ['Heterozygous'], 'role': 'father', 'sample_id': 'sample_id_3'}
            ],
            'inheritance_modes': ['Homozygous recessive']
        }
    ),
    (  # test case 4 (no mother, father)
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_1'
                },
            ],
            'novoPP': .05,
            'cmphet': None,
            'variant': {
                'CHROM': 1
            }
        },
        {
            'genotype_labels': [
                {'labels': ['Homozygous alternate'], 'role': 'proband', 'sample_id': 'sample_id_1'},
            ],
            'inheritance_modes': []
        }
    ),
    (  # test case 5 - no mother, father with high novoPP (can this happen? should have no effect)
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_1'
                },
            ],
            'novoPP': .95,
            'cmphet': None,
            'variant': {
                'CHROM': 1
            }
        },
        {
            'genotype_labels': [
                {'labels': ['Homozygous alternate'], 'role': 'proband', 'sample_id': 'sample_id_1'},
            ],
            'inheritance_modes': []
        }
    ),
    (  # test case 6 - proband U, sex chromosome
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'U',
                    'samplegeno_sampleid': 'sample_id_1'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F',
                    'samplegeno_sampleid': 'sample_id_2'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/0',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_3'
                },
            ],
            'novoPP': .5,
            'cmphet': None,
            'variant': {
                'CHROM': 'X'
            }
        },
        {
            'genotype_labels': [
                {'labels': ['Ambiguous'], 'role': 'proband', 'sample_id': 'sample_id_1'},
                {'labels': ['Heterozygous'], 'role': 'mother', 'sample_id': 'sample_id_2'},
                {'labels': ['Hemizygous reference'], 'role': 'father', 'sample_id': 'sample_id_3'}
            ],
            'inheritance_modes': ['Ambiguous due to missing sex determination']
        }
    ),
    (  # test case 7 - proband U, autosome 
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'U',
                    'samplegeno_sampleid': 'sample_id_1'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F',
                    'samplegeno_sampleid': 'sample_id_2'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_3'
                },
            ],
            'novoPP': .5,
            'cmphet': None,
            'variant': {
                'CHROM': 1
            }
        },
        {
            'genotype_labels': [
                {'labels': ['Homozygous alternate'], 'role': 'proband', 'sample_id': 'sample_id_1'},
                {'labels': ['Heterozygous'], 'role': 'mother', 'sample_id': 'sample_id_2'},
                {'labels': ['Heterozygous'], 'role': 'father', 'sample_id': 'sample_id_3'}
            ],
            'inheritance_modes': ['de novo (medium)']
        }
    )
])
def test_compute_inheritance_modes_snv(variant_sample, expected_new_fields):
    """ Tests end-to-end inheritance mode computation """
    assert InheritanceMode.compute_inheritance_modes(variant_sample) == expected_new_fields

@pytest.mark.parametrize("structural_variant_sample, chromosome, result",
    [
        (
            {
                "samplegeno": [
                    {
                        "samplegeno_role": "proband",
                        "samplegeno_sex": "F",
                        "samplegeno_numgt": "0/1",
                        "samplegeno_sampleid": "Sample1",
                        "samplegeno_quality": 100,
                        "samplegeno_likelihood": "100,0,100"
                    },
                    {
                        "samplegeno_role": "mother",
                        "samplegeno_sex": "F",
                        "samplegeno_numgt": "0/0",
                        "samplegeno_sampleid": "Sample2",
                        "samplegeno_quality": 100,
                        "samplegeno_likelihood": "100,0,100"
                    },
                    {
                        "samplegeno_role": "father",
                        "samplegeno_sex": "M",
                        "samplegeno_numgt": "0/0",
                        "samplegeno_sampleid": "Sample3",
                        "samplegeno_quality": 100,
                        "samplegeno_likelihood": "100,0,100"
                    },
                ]
            },
            "2",
            {
                "genotype_labels": [
                    {
                        "labels": ["Heterozygous"],
                        "role": "proband",
                        "sample_id": "Sample1",
                    },
                    {
                        "labels": ["Homozygous reference"],
                        "role": "mother",
                        "sample_id": "Sample2",
                    },
                    {
                        "labels": ["Homozygous reference"],
                        "role": "father",
                        "sample_id": "Sample3",
                    },
                ],
                "inheritance_modes": [InheritanceMode.INHMODE_LABEL_SV_DE_NOVO]
            }
        )
    ]
)
def test_compute_inheritance_modes_structural_variant(
    structural_variant_sample, chromosome, result
):
    """
    Test inheritance mode calculation as run during ingestion with
    StructuralVariantBuilder.

    Tests of SV-specific inheritance or genotype labels not included
    here.
    """
    assert InheritanceMode.compute_inheritance_modes(
        structural_variant_sample, chrom=chromosome, structural_variant=True
    ) == result


def test_compute_inheritance_modes_csv_tests():
    """ A larger, more involved test that reads test data from a CSV and generates test cases """
    def get_answer(test):
        answer = [test['inheritance_modes'][2:-2]]
        answer = [x.lower() for x in answer]
        return answer

    def infer_sex_of_self(test):
        return 'F' if 'female' in test['condition'] else 'M'

    def infer_chrom(test):
        if 'autosome' in test['condition']:
            return '1'
        elif 'X' in test['condition']:
            return 'X'
        else:
            return 'Y'

    def infer_novo(test):
        if 'novocaller high' in test['condition']:
            return .95
        elif 'novocaller medium' in test['condition']:
            return 0.5
        elif 'novoPP=0' in test['condition']:
            return 0
        elif 'novoPP=None' in test['condition']:
            return -1  # distinct
        else:
            return .001

    def build_variant_sample(test):
        """ Builds a variant_sample given a row """
        return {
            'samplegeno': [
                {
                    'samplegeno_role': 'proband',
                    'samplegeno_numgt': test['genotype_self'],
                    'samplegeno_sex': infer_sex_of_self(test),
                    'samplegeno_sampleid': 'sample_id_1'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': test['genotype_mother'],
                    'samplegeno_sex': 'F',
                    'samplegeno_sampleid': 'sample_id_2'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': test['genotype_father'],
                    'samplegeno_sex': 'M',
                    'samplegeno_sampleid': 'sample_id_3'
                },
            ],
            'variant': {
                'CHROM': infer_chrom(test)
            },
            'novoPP': infer_novo(test)
        }

    # run the tests
    with open(CSV_TESTS) as reader:
        tests = csv.DictReader(reader)
        for idx, test in enumerate(tests):
            vs = build_variant_sample(test)
            reference = get_answer(test)
            actual = InheritanceMode.compute_inheritance_modes(vs)['inheritance_modes']
            for entry in actual:
                entry = entry.lower()
                assert entry in reference or entry in reference[0]  # structure varies
