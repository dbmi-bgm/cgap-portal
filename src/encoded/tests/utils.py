import re
from contextlib import contextmanager
from typing import Any, Iterator, Optional
from unittest import mock


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


@contextmanager
def patch_context(
    object_to_patch: object,
    attribute_to_patch: str,
    return_value: Optional[Any] = None,
    **kwargs,
) -> Iterator[mock.MagicMock]:
    with mock.patch.object(object_to_patch, attribute_to_patch, **kwargs) as mocked_item:
        if return_value is not None:
            mocked_item.return_value = return_value
        yield mocked_item
