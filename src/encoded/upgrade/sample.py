from snovault import upgrade_step


@upgrade_step("sample", "1", "2")
def sample_1_2(value, system):
    """Upgrade Sample to move CRAMs to generic submitted files property.

    All submitted (i.e. user-uploaded) files will now be included within
    the "files" property, not just FASTQ files.
    """
    cram_files = value.get("cram_files")
    if cram_files is not None:
        submitted_files = value.get("files", [])
        if not submitted_files:
            value["files"] = submitted_files
        submitted_files += cram_files
        del value["cram_files"]
