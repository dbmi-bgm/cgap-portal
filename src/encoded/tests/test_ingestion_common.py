import pytest

from ..ingestion.common import get_parameter
from ..ingestion.exceptions import MissingParameter, BadParameter


def test_get_parameter():

    parameters = {
        "foo": "bar",
        "enabled": "true",
        "alpha": "42",
        "beta": 42,
    }
    parameters_original = parameters.copy()

    assert get_parameter(parameters, "foo") == "bar"
    assert get_parameter(parameters, "enabled") == "true"
    assert get_parameter(parameters, "alpha") == "42"
    assert get_parameter(parameters, "beta") == 42

    with pytest.raises(MissingParameter):
        get_parameter(parameters, "gamma")

    with pytest.raises(BadParameter):
        get_parameter(parameters, "beta", as_type=bool)

    assert get_parameter(parameters, "gamma", default=17) == 17
    assert get_parameter(parameters, "gamma", default=17, as_type=str) == 17

    assert get_parameter(parameters, "beta", as_type=str) == "42"

    def force_title(x):
        return str(x).title()
    assert get_parameter(parameters, "alpha", as_type=force_title, default="stuff") == "42"
    assert get_parameter(parameters, "beta", as_type=force_title, default="stuff") == "42"
    assert get_parameter(parameters, "gamma", as_type=force_title, default="stuff") == "stuff"
    assert get_parameter(parameters, "foo", as_type=force_title, default="stuff") == "Bar"

    assert get_parameter(parameters, "foo", as_type=str) == "bar"
    assert get_parameter(parameters, "enabled", as_type=bool) == True
    assert get_parameter(parameters, "alpha", as_type=int) == 42
    assert get_parameter(parameters, "beta", as_type=int) == 42

    assert parameters == parameters_original  # No side effects before this point. No uses of update=True yet.

    assert get_parameter(parameters, "gamma", default=17, update=True) == 17
    assert get_parameter(parameters, "gamma") == 17  # update don previous line

    bool_tests = {
        "truth1": "TrUe",
        "truth2": True,
        "falsity1": "",
        "falsity2": "faLSE",
        "falsity3": "NONE",
        "falsity4": "NuLL",
        "falsity5": None,
    }

    for key in bool_tests:
        if key.startswith("t"):
            assert get_parameter(bool_tests, key, as_type=bool) == True
        elif key.startswith("f"):
            assert get_parameter(bool_tests, key, as_type=bool) == False

    for key in bool_tests:
        if key.startswith("t"):
            assert get_parameter(bool_tests, key, as_type=bool, update=True) == True
        elif key.startswith("f"):
            assert get_parameter(bool_tests, key, as_type=bool, update=True) == False

    assert bool_tests == { k: k.startswith('t') for k in bool_tests.keys() }
