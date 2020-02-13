from snovault import (
    upgrade_step,
)


@upgrade_step('sample', '1', '2')
def sample_1_2(value, system):
    if value.get('individual'):
        del value['individual']
