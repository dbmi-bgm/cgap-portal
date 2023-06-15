import inspect
import re
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional
from unittest import mock

from webtest.app import TestApp


def pluralize(name):
    name = name.replace("_", "-")
    # deal with a few special cases explicitly
    specials = ["file", "quality-metric", "summary-statistic", "workflow-run", "note"]
    for sp in specials:
        if name.startswith(sp) and re.search("-(set|flag|format|type)", name) is None:
            return name.replace(sp, sp + "s")
        elif name.startswith(sp) and re.search("setting", name):
            return name.replace(sp, sp + "s")
    # otherwise just add 's/es/ies'
    if name.endswith("ly"):
        return name[:-1] + "ies"
    if name.endswith("sis"):
        return name[:-2] + "es"
    if name.endswith("s"):
        return name + "es"
    return name + "s"


def make_atid(uuid, item_type="sample-processing"):
    return f"/{pluralize(item_type)}/{uuid}/"


@contextmanager
def patch_context(
    to_patch: object,
    return_value: Optional[Any] = None,
    **kwargs,
) -> Iterator[mock.MagicMock]:
    if isinstance(to_patch, property):
        to_patch = to_patch.fget
    target = f"{to_patch.__module__}.{to_patch.__qualname__}"
    with mock.patch(target, **kwargs) as mocked_item:
        if return_value is not None:
            mocked_item.return_value = return_value
        yield mocked_item


def get_identifier(
    testapp: TestApp, identifier: str, frame: str = "object"
) -> Dict[str, Any]:
    identifier_path = get_identifier_path(identifier, frame=frame)
    response = testapp.get(identifier_path, status=[200, 301])
    if response.status_code == 200:
        result = response.json
    elif response.status_code == 301:
        result = response.follow().json
    return result


def get_identifier_path(identifier: str, frame: Optional[str] = None) -> str:
    if frame:
        identifier = f"{identifier}?frame={frame}"
    if identifier.startswith("/"):
        return identifier
    return f"/{identifier}"
