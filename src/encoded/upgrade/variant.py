from snovault import (
    upgrade_step,
)


@upgrade_step('variant', '1', '2')
def variant_1_2(value, system):
    """ Upgrades variant from schema version 1 to 2, deleting the 4 relevant fields. """

    if 'csq_rs_dbsnp151' in value:
        del value['csq_rs_dbsnp151']

    if 'csq_hg19_chr' in value:
        del value['csq_hg19_chr']

    if 'csq_hg19_pos' in value:
        del value['csq_hg19_pos']

    if 'csq_clinvar_clnhgvs' in value:
        del value['csq_clinvar_clnhgvs']
