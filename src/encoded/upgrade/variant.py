from snovault import (
    upgrade_step,
)


@upgrade_step('variant', '1', '2')
def variant_update_1_2(value, system):
    """ Upgrades variant from schema version 1 to 2, deleting csq_rs_dbsnp151 """

    # If we are on schema version >1, no update needed
    if int(value.get('schema_version', '1')) >= 2:
        return

    if 'csq_rs_dbsnp151' in value:
        del value['csq_rs_dbsnp151']
