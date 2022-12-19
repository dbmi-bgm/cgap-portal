import re


def pluralize(name):
    name = name.replace('_', '-')
    # deal with a few special cases explicitly
    specials = ['file', 'quality-metric', 'summary-statistic', 'workflow-run', 'note']
    for sp in specials:
        if name.startswith(sp) and re.search('-(set|flag|format|type)', name) is None:
            return name.replace(sp, sp + 's')
        elif name.startswith(sp) and re.search('setting', name):
            return name.replace(sp, sp + 's')
    # otherwise just add 's/es/ies'
    if name.endswith('ly'):
        return name[:-1] + 'ies'
    if name.endswith('sis'):
        return name[:-2] + 'es'
    if name.endswith('s'):
        return name + 'es'
    return name + 's'


def make_atid(uuid, item_type="sample-processing"):
    return f"/{pluralize(item_type)}/{uuid}/"
