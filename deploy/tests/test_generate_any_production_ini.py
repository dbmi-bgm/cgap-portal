import os

from io import StringIO
from unittest import mock

from ..generate_production_ini import TEMPLATE_DIR, build_ini_stream_from_template
from .test_generate_production_ini import MOCKED_LOCAL_GIT_VERSION, MOCKED_PROJECT_VERSION


def test_transitional_equivalence():
    """
    We used to use separate files for each environment. This tests that the new any.ini technology,
    with a few new environment variables, will produce the same thing.

    This proves that if we set at least "ENCODED_ES_SERVER" and "ENCODED_BS_ENV" environment variables,
    or invoke generate_ini_file adding the "--es_server" nad "--bs_env" arguments, we should get a proper
    production.ini.
    """

    # TODO: Once this mechanism is in place, the files cgap.ini, cgapdev.ini, cgaptest.ini, and cgapwolf.ini
    #       can either be removed (and these transitional tests removed) or transitioned to be test data.

    def tester(ref_ini, bs_env, data_set, es_server, es_namespace=None):

        assert ref_ini[:-4] == bs_env[10:]  # "xxx.ini" needs to match "fourfront-xxx"

        es_namespace = es_namespace or bs_env

        # Test of build_ini_from_template with just 2 keyword arguments explicitly supplied (bs_env, es_server),
        # and others defaulted.

        old_output = StringIO()
        new_output = StringIO()

        build_ini_stream_from_template(os.path.join(TEMPLATE_DIR, ref_ini), old_output)
        build_ini_stream_from_template(os.path.join(TEMPLATE_DIR, "any.ini"), new_output,
                                       # data_env and es_namespace are something we should be able to default
                                       bs_env=bs_env, es_server=es_server)

        old_content = old_output.getvalue()
        new_content = new_output.getvalue()
        assert old_content == new_content

        # Test of build_ini_from_template with all 4 keyword arguments explicitly supplied (bs_env, data_set,
        # es_server, es_namespace), none defaulted.


        old_output = StringIO()
        new_output = StringIO()

        build_ini_stream_from_template(os.path.join(TEMPLATE_DIR, ref_ini), old_output)
        build_ini_stream_from_template(os.path.join(TEMPLATE_DIR, "any.ini"), new_output,
                                       bs_env=bs_env, data_set=data_set, es_server=es_server, es_namespace=es_namespace)

        old_content = old_output.getvalue()
        new_content = new_output.getvalue()
        assert old_content == new_content

    with mock.patch("deploy.generate_production_ini.get_app_version", return_value=MOCKED_PROJECT_VERSION):
        with mock.patch("toml.load", return_value={"tool": {"poetry": {"version": MOCKED_LOCAL_GIT_VERSION}}}):

            tester(ref_ini="cgap.ini", bs_env="fourfront-cgap", data_set="prod",
                   es_server="search-fourfront-cgap-ewf7r7u2nq3xkgyozdhns4bkni.us-east-1.es.amazonaws.com:80")

            tester(ref_ini="cgapdev.ini", bs_env="fourfront-cgapdev", data_set="test",
                   es_server="search-fourfront-cgapdev-gnv2sgdngkjbcemdadmaoxcsae.us-east-1.es.amazonaws.com:80")

            tester(ref_ini="cgaptest.ini", bs_env="fourfront-cgaptest", data_set="test",
                   es_server="search-fourfront-cgaptest-dxiczz2zv7f3nshshvevcvmpmy.us-east-1.es.amazonaws.com:80")

            tester(ref_ini="cgapwolf.ini", bs_env="fourfront-cgapwolf", data_set="test",
                   es_server="search-fourfront-cgapwolf-r5kkbokabymtguuwjzspt2kiqa.us-east-1.es.amazonaws.com:80")
