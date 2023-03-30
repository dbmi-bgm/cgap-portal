from snovault import upgrade_step


@upgrade_step('workflow', '7', '8')  # workflows in CGAP started at version 7
def workflow_7_8(value, system):
    """ Upgrades existing workflows to match new structure for ec2 instance type
        change is from a single string to an array of strings
    """
    existing_instance_type = value.get('default_tibanna_config', {}).get('instance_type')
    if existing_instance_type:
        value['default_tibanna_config']['instance_type'] = [existing_instance_type]
