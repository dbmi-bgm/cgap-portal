from snovault import upgrade_step


PROPERTIES_1_2_TO_DELETE = ["families", "sample_processes"]


@upgrade_step("cohort", "1", "2")
def cohort_1_2(value, system):
    """Upgrade cohort to schema v2, deleting properties removed from
    schema.
    """
    for property_to_delete in PROPERTIES_1_2_TO_DELETE:
        property_value = value.get(property_to_delete)
        if property_value is not None:
            del value[property_to_delete]
