import pytest
import csv
from ..inheritance_mode import InheritanceMode, InheritanceModeError
from ..util import resolve_file_path


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
])
def test_compute_genotype_label(gt, sex, chrom, expected):
    assert InheritanceMode.compute_genotype_label(gt=gt, sex=sex, chrom=chrom) == expected


@pytest.mark.parametrize('gts, sexes, chrom, expected_labels', [
    (  # test case 1
        {
            'self': '1/1',
            'mother': '1/0',
            'father': '0/1'
        },
        {
            'self': 'M',
            'mother': 'F',
            'father': 'M'
        },
        '5',
        {
            'self': ['Homozygus alternate'],
            'mother': ['Heterozygous alt/alt -  multiallelic'],
            'father': ['Heterozygous']
        }
    ),
    (  # test case 2
        {
            'self': '1/1',
            'mother': '1/1',
            'father': '0/1'
        },
        {
            'self': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        {
            'self': ['Homozygus alternate'],
            'mother': ['Homozygus alternate'],
            'father': ['False']
        }
    ),
    (  # test case 3
        {
            'self': '0/1',
            'mother': '1/1',
            'father': '0/0'
        },
        {
            'self': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        {
            'self': ['Heterozygous'],
            'mother': ['Homozygus alternate'],
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
            'self': '1/1',
            'mother': '1/0',
            'father': '0/1'
        },
        {
            'self': ['Homozygus alternate'],
            'mother': ['Heterozygous alt/alt -  multiallelic'],
            'father': ['Heterozygous']
        },
        {
            'self': 'M',
            'mother': 'F',
            'father': 'M'
        },
        '5',
        .05,
        []
    ),
    (  # test case 2
        {
            'self': '1/1',
            'mother': '1/1',
            'father': '0/1'
        },
        {
            'self': ['Homozygus alternate'],
            'mother': ['Homozygus alternate'],
            'father': ['False']
        },
        {
            'self': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        .95,
        []
    ),
    (  # test case 3
        {
            'self': '0/1',
            'mother': '1/1',
            'father': '0/0'
        },
        {
            'self': ['Heterozygous'],
            'mother': ['Homozygus alternate'],
            'father': ['Hemizygous reference']
        },
        {
            'self': 'F',
            'mother': 'F',
            'father': 'M'
        },
        'X',
        .8,
        [InheritanceMode.INHMODE_LABEL_DE_NOVO_MEDIUM]
    )
])
def test_compute_inheritance_mode_trio(gts, gt_labels, sexes, chrom, novoPP, expected_inh):
    """ Tests basic inheritance mode cases """
    assert InheritanceMode.compute_inheritance_mode_trio(genotypes=gts, genotype_labels=gt_labels,
                                                         sexes=sexes, chrom=chrom, novoPP=novoPP) == expected_inh


@pytest.mark.parametrize('variant_sample, expected_new_fields', [
    (  # test case 1
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'self',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'M'
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
                {'labels': ['Homozygus alternate'], 'role': 'self'},
                {'labels': ['Heterozygous'], 'role': 'mother'},
                {'labels': ['Heterozygous'], 'role': 'father'}
            ],
            'inheritance_modes': ['de novo (strong)']
        }
    ),
    (  # test case 2
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'self',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'M'
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
                {'labels': ['Homozygus alternate'], 'role': 'self'},
                {'labels': ['Heterozygous'], 'role': 'mother'},
                {'labels': ['Heterozygous'], 'role': 'father'}
            ],
            'inheritance_modes': ['de novo (medium)']
        }
    ),
    (  # test case 3
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'self',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M'
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'F'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': '0/1',
                    'samplegeno_sex': 'M'
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
                {'labels': ['Homozygus alternate'], 'role': 'self'},
                {'labels': ['Heterozygous'], 'role': 'mother'},
                {'labels': ['Heterozygous'], 'role': 'father'}
            ],
            'inheritance_modes': ['Recessive']
        }
    ),
    (  # test case 4 (no mother, father)
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'self',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M'
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
                {'labels': ['Homozygus alternate'], 'role': 'self'},
            ],
            'inheritance_modes': []
        }
    ),
    (  # test case 5 - no mother, father with high novoPP (can this happen? should have no effect)
        {
            'samplegeno': [
                {
                    'samplegeno_role': 'self',
                    'samplegeno_numgt': '1/1',
                    'samplegeno_sex': 'M'
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
                {'labels': ['Homozygus alternate'], 'role': 'self'},
            ],
            'inheritance_modes': []
        }
    )
])
def test_compute_inheritance_modes(variant_sample, expected_new_fields):
    """ Tests end-to-end inheritance mode computation """
    assert InheritanceMode.compute_inheritance_modes(variant_sample) == expected_new_fields


def test_compute_inheritance_modes_csv_tests():
    """ A larger, more involved test that reads test data from a CSV and generates test cases """
    def get_answer(test):
        answer = [test['inheritance_modes'][2:-2]]
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
                    'samplegeno_role': 'self',
                    'samplegeno_numgt': test['genotype_self'],
                    'samplegeno_sex': infer_sex_of_self(test)
                },
                {
                    'samplegeno_role': 'mother',
                    'samplegeno_numgt': test['genotype_mother'],
                    'samplegeno_sex': 'F'
                },
                {
                    'samplegeno_role': 'father',
                    'samplegeno_numgt': test['genotype_father'],
                    'samplegeno_sex': 'M'
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
                assert entry in reference or entry in reference[0]
