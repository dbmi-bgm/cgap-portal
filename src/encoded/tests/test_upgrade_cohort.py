import pytest

from ..upgrade.cohort import PROPERTIES_1_2_TO_DELETE


@pytest.fixture
def cohort_v1():
    """A cohort with schema version 1 properties."""
    return {
        "title": "People with Blue Thumbs",
        "project": "12a92962-8265-4fc0-b2f8-cf14f05db58b",
        "institution": "hms-dbmi",
        "status": "shared",
        "uuid": "cc7d83a2-6886-4ca0-9402-7c49734cf3c4",
        "sample_processes": ["4fdb481a-fbdb-4c0f-a68d-aac87f847a67"],
        "families": [
            {
                "members": [
                    "5ec91041-78a0-4758-abef-21c7f5fd9f12",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f34",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f56",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f78",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f91",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f92",
                ],
                "proband": "5ec91041-78a0-4758-abef-21c7f5fd9f12",
                "original_pedigree": "dcf15d5e-40aa-43bc-b81c-32c70c9afc50",
            },
            {
                "members": [
                    "5ec91041-78a0-4758-abef-21c7f5fd9f21",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f22",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f23",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f24",
                    "5ec91041-78a0-4758-abef-21c7f5fd9f25",
                ],
                "proband": "5ec91041-78a0-4758-abef-21c7f5fd9f21",
                "original_pedigree": "dcf15d5e-40aa-43bc-b81c-32c70c9afc52",
            },
        ],
        "description": "These people have been affected by a novel disease which can emerge at any age. The initial symptoms include gastrointestinal pains followed a few days later by bluing of some extremities. Death occurs usually within 2 years of onset.",
    }


def test_cohort_1_2(app, cohort_v1):
    """Test upgrade of cohort from schema version 1 to 2."""
    upgrader = app.registry["upgrader"]
    upgrader.upgrade("cohort", cohort_v1, current_version="1", target_version="2")
    for property_to_delete in PROPERTIES_1_2_TO_DELETE:
        assert cohort_v1.get(property_to_delete) is None
