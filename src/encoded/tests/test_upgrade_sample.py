import pytest


FASTQ_FILES = ["/files-fastq/GAPFI000001", "/files-fastq/GAPFI000002"]
CRAM_FILES = ["/files-processed/GAPFI000003", "/files-processed/GAPFI000004"]


@pytest.fixture
def sample_version_1():
    """Simple Sample item for tests, not POSTed."""
    return {
        "project": "cgap-core",
        "institution": "cgap-core",
        "schema_version": "1",
        "bam_sample_id": "Sample1234",
    }


@pytest.mark.parametrize(
    "files,crams,expected_files",
    [
        (None, None, None),
        (FASTQ_FILES, None, FASTQ_FILES),
        (None, CRAM_FILES, CRAM_FILES),
        (FASTQ_FILES, CRAM_FILES, FASTQ_FILES + CRAM_FILES),
    ],
)
def test_upgrade_sample_1_to_2(app, files, crams, expected_files, sample_version_1):
    """Test submitted CRAM files, if present, are moved from
    'cram_files' to 'files' property.
    """
    if files:
        sample_version_1["files"] = files
    if crams:
        sample_version_1["cram_files"] = crams
    upgrader = app.registry["upgrader"]
    value = upgrader.upgrade(
        "sample", sample_version_1, current_version="1", target_version="2"
    )
    assert value["schema_version"] == "2"
    assert value.get("cram_files") is None
    assert value.get("files") == expected_files
