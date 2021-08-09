from snovault import (
    upgrade_step,
)

def common_note_1_2_upgrade(value, system):
    """
    1. Updates field name from `approved_date` to `date_approved`
       Most date fields in our DB start with date_ so this is an attempt to continue convention.
    2. Adds "+00:00" if not present (prior version of app saved this field incorrectly)
    """
    if "approved_date" in value:
        value["date_approved"] = value["approved_date"]
        del value["approved_date"]
        if not value["date_approved"].endswith("+00:00"):
            value["date_approved"] += "+00:00"



@upgrade_step('note_discovery', '1', '2')
def note_discovery_1_2(value, system):
    common_note_1_2_upgrade(value, system)

@upgrade_step('note_interpretation', '1', '2')
def note_interpretation_1_2(value, system):
    common_note_1_2_upgrade(value, system)

@upgrade_step('note_standard', '1', '2')
def note_standard_1_2(value, system):
    common_note_1_2_upgrade(value, system)
