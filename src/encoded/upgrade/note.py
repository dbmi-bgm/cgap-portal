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


def common_note_2_3_upgrade(value, system):
    """
    Checks if "status" is "current", and if so, then sets "is_saved_to_project" to true.
    We will likely use "status" :  "shared" and similar things in future, so adding explicit field.
    """
    if value.get("status") == "current":
        value["is_saved_to_project"] = True



@upgrade_step('note_discovery', '1', '2')
def note_discovery_1_2(value, system):
    common_note_1_2_upgrade(value, system)

@upgrade_step('note_interpretation', '1', '2')
def note_interpretation_1_2(value, system):
    common_note_1_2_upgrade(value, system)

@upgrade_step('note_standard', '1', '2')
def note_standard_1_2(value, system):
    common_note_1_2_upgrade(value, system)



@upgrade_step('note_discovery', '2', '3')
def note_discovery_2_3(value, system):
    common_note_2_3_upgrade(value, system)

@upgrade_step('note_interpretation', '2', '3')
def note_interpretation_2_3(value, system):
    common_note_2_3_upgrade(value, system)

@upgrade_step('note_standard', '2', '3')
def note_standard_2_3(value, system):
    common_note_2_3_upgrade(value, system)
