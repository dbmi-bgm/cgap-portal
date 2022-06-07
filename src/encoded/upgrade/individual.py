from snovault import upgrade_step


@upgrade_step("individual", "1", "2")
def individual_1_2(value, system):
    """Upgrade Individual disorders from array of strings to array of
    objects.
    """
    disorders = value.get("disorders", [])
    if disorders:
        updated_disorders = []
        for disorder in disorders:
            updated_disorders.append({"disorder": disorder})
        value["disorders"] = updated_disorders
