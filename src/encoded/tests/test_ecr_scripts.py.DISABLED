import boto3
import botocore.client
import contextlib
import pytest

from dcicutils.common import REGION
from dcicutils.misc_utils import override_environ
from unittest import mock
from ..commands import ecr_scripts as ecr_scripts_module
from ..commands.ecr_scripts import (
    make_sorted_string_list, ecr_command_context, ECRCommandContext,
    CONFIRM_DEFAULT_ACCOUNT_NUMBER, DEFAULT_ECS_REPOSITORY, IMAGE_COUNT_LIMIT,
    add_image_tag_main, show_image_catalog_main, show_image_manifest_main, unrelease_most_recent_image_main,
)

GOOD_ACCOUNT_NUMBER = "11111111"
BAD_ACCOUNT_NUMBER = "22222222"
ALTERNATE_ECS_REPOSITORY = 'not-' + DEFAULT_ECS_REPOSITORY


@contextlib.contextmanager
def global_account_number_for_testing(account_number):
    # This protection helps assure we don't accidentally test against any real account numbers
    assert account_number in (GOOD_ACCOUNT_NUMBER, BAD_ACCOUNT_NUMBER, None)
    # Both of these have to be bound consistently to test what commands would do with this setting,
    # since each command is in its own script and the value of this at the time of loading the script
    # and the value in the moment of running the test would be consistent. -kmp 13-Mar-2022
    with mock.patch.object(ecr_scripts_module, "DEFAULT_ACCOUNT_NUMBER", account_number):
        with override_environ(ACCOUNT_NUMBER=account_number):
            yield


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
    assert make_sorted_string_list("alpha") == "a,a,h,l,p"  # string
    assert make_sorted_string_list(("alpha")) == "a,a,h,l,p"  # NoQA - that's not a tuple, just parens around a string
    assert make_sorted_string_list(("alpha",)) == "alpha"  # tuple
    assert make_sorted_string_list({"alpha": "first", "omega": "last"}) == "alpha,omega"  # dict


def test_ecr_errors_trapped():

    some_ecr_client = boto3.client('ecr', region_name=REGION)

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        # Normal case of ACCOUNT_NUMBER being set in the environment,
        # and command invoked with same account number given.
        with pytest.raises(SystemExit) as system_exit:
            with ecr_command_context(account_number=GOOD_ACCOUNT_NUMBER) as command_context:
                assert command_context.ecs_repository == DEFAULT_ECS_REPOSITORY
                assert command_context.account_number == GOOD_ACCOUNT_NUMBER
                assert isinstance(command_context.ecr_client, botocore.client.BaseClient)  # details don't matter here
                assert command_context.ecr_client is not some_ecr_client
        assert system_exit.value.code == 0

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        # Normal case of ACCOUNT_NUMBER being set in the environment,
        # and command invoked with same account number given.
        with pytest.raises(SystemExit) as system_exit:
            with ecr_command_context(account_number=GOOD_ACCOUNT_NUMBER,
                                     ecs_repository=ALTERNATE_ECS_REPOSITORY,
                                     ecr_client=some_ecr_client) as command_context:
                assert command_context.ecs_repository == ALTERNATE_ECS_REPOSITORY
                assert command_context.account_number == GOOD_ACCOUNT_NUMBER
                assert isinstance(command_context.ecr_client, botocore.client.BaseClient)  # details don't matter here
                assert command_context.ecr_client is some_ecr_client
        assert system_exit.value.code == 0

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        # Error case of ACCOUNT_NUMBER being set in the environment, and command invoked with a conflicting number.
        with pytest.raises(SystemExit) as system_exit:
            with ecr_command_context(account_number=BAD_ACCOUNT_NUMBER):
                pass
        assert system_exit.value.code != 0  # error exit because of account number mismatch

    with global_account_number_for_testing(None):
        # Error case of ACCOUNT_NUMBER being set in the environment, and command invoked with a conflicting number.
        with pytest.raises(SystemExit) as system_exit:
            with ecr_command_context(account_number=GOOD_ACCOUNT_NUMBER):
                pass
        assert system_exit.value.code != 0  # error exit because of account number mismatch

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        # Error case of ACCOUNT_NUMBER being set in the environment, and command invoked with a conflicting number.
        with mock.patch.object(ecr_scripts_module, "yes_or_no") as mock_yes_or_no:

            mock_yes_or_no.return_value = True
            with pytest.raises(SystemExit) as system_exit:
                with ecr_command_context(account_number=CONFIRM_DEFAULT_ACCOUNT_NUMBER) as command_context:
                    assert command_context.account_number == GOOD_ACCOUNT_NUMBER
            assert mock_yes_or_no.call_count == 1
            assert system_exit.value.code == 0  # normal exit because use of default was confirmed interactively

            mock_yes_or_no.reset_mock()

            mock_yes_or_no.return_value = False
            with pytest.raises(SystemExit) as system_exit:
                with ecr_command_context(account_number=CONFIRM_DEFAULT_ACCOUNT_NUMBER):
                    pass
            assert mock_yes_or_no.call_count == 1
            assert system_exit.value.code != 0  # error exit because use of default was not confirmed interactively


def test_unrelease_most_recent_image_main():

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        with mock.patch.object(ECRCommandContext, "unrelease_most_recent_image") as mock_unrelease_most_recent_image:
            with mock.patch.object(ecr_scripts_module, "yes_or_no") as mock_yes_or_no:

                # This command permits zero arguments, but in that case will require confirmation of the account number.
                # If 'yes' is the answer, it will continue with the default account number and eventually exit normally.
                mock_yes_or_no.return_value = True
                with pytest.raises(SystemExit) as system_exit:
                    unrelease_most_recent_image_main(override_args=[])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 1
                assert mock_unrelease_most_recent_image.call_count == 1
                mock_unrelease_most_recent_image.assert_called_with()

                mock_unrelease_most_recent_image.reset_mock()
                mock_yes_or_no.reset_mock()

                # If 'no' is the answer, it will exit abnormally immediately.
                mock_yes_or_no.return_value = False
                with pytest.raises(SystemExit) as system_exit:
                    unrelease_most_recent_image_main(override_args=[])
                assert system_exit.value.code == 1
                assert mock_yes_or_no.call_count == 1
                assert mock_unrelease_most_recent_image.call_count == 0

                mock_unrelease_most_recent_image.reset_mock()
                mock_yes_or_no.reset_mock()

                # If an --account-number argument is given, there should be no query.
                with pytest.raises(SystemExit) as system_exit:
                    unrelease_most_recent_image_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_unrelease_most_recent_image.call_count == 1
                mock_unrelease_most_recent_image.assert_called_with()

                mock_unrelease_most_recent_image.reset_mock()
                mock_yes_or_no.reset_mock()

                # An --ecs-repository argument  can also be given.
                with pytest.raises(SystemExit) as system_exit:
                    unrelease_most_recent_image_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER,
                                                                    '--ecs-repository', ALTERNATE_ECS_REPOSITORY])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_unrelease_most_recent_image.call_count == 1
                mock_unrelease_most_recent_image.assert_called_with()


def test_add_image_tag_main():

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        with mock.patch.object(ECRCommandContext, "add_image_tag") as mock_add_image_tag:
            with mock.patch.object(ecr_scripts_module, "yes_or_no") as mock_yes_or_no:

                some_sha = 'sha256:12345'
                some_tag = 'some-tag'

                # This command permits zero arguments, but in that case will require confirmation of the account number.
                # If 'yes' is the answer, it will continue with the default account number and eventually exit normally.
                mock_yes_or_no.return_value = True
                with pytest.raises(SystemExit) as system_exit:
                    add_image_tag_main(override_args=[some_sha, some_tag])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 1
                assert mock_add_image_tag.call_count == 1
                mock_add_image_tag.assert_called_with(digest=some_sha, tag=some_tag)

                mock_add_image_tag.reset_mock()
                mock_yes_or_no.reset_mock()

                # If 'no' is the answer, it will exit abnormally immediately.
                mock_yes_or_no.return_value = False
                with pytest.raises(SystemExit) as system_exit:
                    add_image_tag_main(override_args=[some_sha, some_tag])
                assert system_exit.value.code == 1
                assert mock_yes_or_no.call_count == 1
                assert mock_add_image_tag.call_count == 0

                mock_add_image_tag.reset_mock()
                mock_yes_or_no.reset_mock()

                # If an --account-number argument is given, there should be no query.
                with pytest.raises(SystemExit) as system_exit:
                    add_image_tag_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER,
                                                      some_sha, some_tag])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_add_image_tag.call_count == 1
                mock_add_image_tag.assert_called_with(digest=some_sha, tag=some_tag)

                mock_add_image_tag.reset_mock()
                mock_yes_or_no.reset_mock()

                # An --ecs-repository argument  can also be given.
                with pytest.raises(SystemExit) as system_exit:
                    add_image_tag_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER,
                                                      '--ecs-repository', ALTERNATE_ECS_REPOSITORY,
                                                      some_sha, some_tag])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_add_image_tag.call_count == 1
                mock_add_image_tag.assert_called_with(digest=some_sha, tag=some_tag)


def test_show_image_manifest_main():

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        with mock.patch.object(ECRCommandContext, "show_image_manifest") as mock_show_image_manifest:
            with mock.patch.object(ecr_scripts_module, "yes_or_no") as mock_yes_or_no:

                some_sha = 'sha256:12345'
                some_tag = 'some-tag'

                with pytest.raises(SystemExit) as system_exit:
                    show_image_manifest_main(override_args=['--digest', some_sha, '--tag', some_tag])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_show_image_manifest.call_count == 1
                mock_show_image_manifest.assert_called_with(digest=some_sha, tag=some_tag)

                mock_show_image_manifest.reset_mock()
                mock_yes_or_no.reset_mock()

                # If an --account-number argument is given, it will be used. Again no query.
                with pytest.raises(SystemExit) as system_exit:
                    show_image_manifest_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER,
                                                            '--digest', some_sha, '--tag', some_tag])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_show_image_manifest.call_count == 1
                mock_show_image_manifest.assert_called_with(digest=some_sha, tag=some_tag)

                mock_show_image_manifest.reset_mock()
                mock_yes_or_no.reset_mock()

                # An --ecs-repository argument  can also be given.
                with pytest.raises(SystemExit) as system_exit:
                    show_image_manifest_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER,
                                                            '--ecs-repository', ALTERNATE_ECS_REPOSITORY,
                                                            '--digest', some_sha, '--tag', some_tag])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_show_image_manifest.call_count == 1
                mock_show_image_manifest.assert_called_with(digest=some_sha, tag=some_tag)


def test_show_image_catalog_main():

    with global_account_number_for_testing(GOOD_ACCOUNT_NUMBER):
        with mock.patch.object(ECRCommandContext, "show_image_catalog") as mock_show_image_catalog:
            with mock.patch.object(ecr_scripts_module, "yes_or_no") as mock_yes_or_no:

                assert IMAGE_COUNT_LIMIT == 10  # this is basically informational

                # with no arguments, the limit defaults to IMAGE_COUNT_LIMIT
                with pytest.raises(SystemExit) as system_exit:
                    show_image_catalog_main(override_args=[])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_show_image_catalog.call_count == 1
                mock_show_image_catalog.assert_called_with(limit=IMAGE_COUNT_LIMIT)

                mock_show_image_catalog.reset_mock()
                mock_yes_or_no.reset_mock()

                some_number = 13
                some_number_as_string = str(some_number)
                with pytest.raises(SystemExit) as system_exit:
                    show_image_catalog_main(override_args=['--limit', some_number_as_string])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_show_image_catalog.call_count == 1
                mock_show_image_catalog.assert_called_with(limit=some_number)

                mock_show_image_catalog.reset_mock()
                mock_yes_or_no.reset_mock()

                # If an --account-number argument is given, it will be used. Again no query.
                with pytest.raises(SystemExit) as system_exit:
                    show_image_catalog_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER,
                                                           '--limit', some_number_as_string])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_show_image_catalog.call_count == 1
                mock_show_image_catalog.assert_called_with(limit=some_number)

                mock_show_image_catalog.reset_mock()
                mock_yes_or_no.reset_mock()

                # An --ecs-repository argument  can also be given.
                with pytest.raises(SystemExit) as system_exit:
                    show_image_catalog_main(override_args=['--account-number', GOOD_ACCOUNT_NUMBER,
                                                           '--ecs-repository', ALTERNATE_ECS_REPOSITORY,
                                                           '--limit', some_number_as_string])
                assert system_exit.value.code == 0
                assert mock_yes_or_no.call_count == 0
                assert mock_show_image_catalog.call_count == 1
                mock_show_image_catalog.assert_called_with(limit=some_number)
