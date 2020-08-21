import pytest
from ..inheritance_mode import InheritanceMode, InheritanceModeError


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
