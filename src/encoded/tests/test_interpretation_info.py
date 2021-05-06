import json
import mock
import pytest

from uuid import uuid4

from encoded.vsl_listener import interpretation

pytestmark = [pytest.mark.working]

INTERPRETATION_URL = '/interpretation'


def test_interpretation_post(testapp, bgm_project, bgm_access_key, institution):
    """"""
    import pdb
    pdb.set_trace()
    creation_post_data = {}
    creation_post_headers = {
        "Content-type": "application/json",
        "Accept": "application/json",
    }
    response = testapp.post_json("/interpretation", creation_post_data, headers=creation_post_headers)
