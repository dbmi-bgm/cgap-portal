import pytest

from dcicutils.misc_utils import override_environ
from unittest import mock
from ..commands.ecr_scripts import (
    make_sorted_string_list, ecr_command_context
)

GOOD_ACCOUNT_NUMBER = "11111111"
BAD_ACCOUNT_NUMBER = "22222222"


def test_make_sorted_string_list():

    # Test as-needed separation with default separator
    assert make_sorted_string_list([]) == ""
    assert make_sorted_string_list(['alpha']) == 'alpha'
    assert make_sorted_string_list(['alpha', 'beta']) == "alpha,beta"
    assert make_sorted_string_list(['alpha', 'beta', 'gamma']) == "alpha,beta,gamma"

    # Test sorting
    assert make_sorted_string_list(['gamma', 'beta', 'alpha']) == "alpha,beta,gamma"
    assert make_sorted_string_list(['alpha', 'gamma', 'beta']) == "alpha,beta,gamma"

    # Test alternate separator
    assert make_sorted_string_list(['alpha', 'beta'], separator=", ") == "alpha, beta"
    assert make_sorted_string_list(['alpha', 'beta', 'gamma'], separator=", ") == "alpha, beta, gamma"

    # Test other datatypes
    assert make_sorted_string_list(('alpha', 'beta')) == "alpha,beta"
    assert make_sorted_string_list({'alpha', 'beta', 'gamma'}) == "alpha,beta,gamma"
    assert make_sorted_string_list("alpha") == "a,a,h,l,p" # string
    assert make_sorted_string_list(("alpha")) == "a,a,h,l,p"  # that's not a tuple, just parens around a string
    assert make_sorted_string_list(("alpha",)) == "alpha"  # tuple
    assert make_sorted_string_list({"alpha": "first", "omega": "last"}) == "alpha,omega"  # dict


def test_ecr_errors_trapped():

    # Normal case of ACCOUNT_NUMBER being set in the environment, and command invoked with same account number given.
    with override_environ(ACCOUNT_NUMBER=GOOD_ACCOUNT_NUMBER):
        with pytest.raises(SystemExit) as system_exit:
            with ecr_command_context(account_number=GOOD_ACCOUNT_NUMBER):
                pass
        assert system_exit.value.code == 0

    # Error case of ACCOUNT_NUMBER being set in the environment, and command invoked with a conflicting number.
    with override_environ(ACCOUNT_NUMBER=GOOD_ACCOUNT_NUMBER):
        with pytest.raises(SystemExit) as system_exit:
            with ecr_command_context(account_number=BAD_ACCOUNT_NUMBER):
                pass
        assert system_exit.value.code != 0  # error exit because of account number mismatch

    # Error case of ACCOUNT_NUMBER being set in the environment, and command invoked with a conflicting number.
    with override_environ(ACCOUNT_NUMBER=None):
        with pytest.raises(SystemExit) as system_exit:
            with ecr_command_context(account_number=GOOD_ACCOUNT_NUMBER):
                pass
        assert system_exit.value.code != 0  # error exit because of account number mismatch
