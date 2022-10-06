Insert Creation Scripts
=======================

[This directory](.) contains Python scripts that were utilized to create the set of inserts within the [**cypress-test-inserts** directory](../), used for automated UI integration tests.

This folder contains a number of JSON files which are named by the type of item they contain -- for example, `file_processed.json` contains a list of individual JSON objects that represent Processed File items.

The outline of what each script executes is described below. They can be run using the command `python <script_name>` from the command line terminal within this directory.

The `Cypress Main` project, institution, and users were created manually. Their UUIDs were generated using the `uuid4()` function from the `uuid` Python library.

### Summary of the scripts

#### Insert creation scripts
- **get_keys.py**: grabs CGAP user keys from ~/.cgap-keys.json
- **insert_loader_classes.py**: defines the `InsertFinder` and `InsertWriter` classes, which are used within `create_cypress_inserts.py`
- **create_cypress_inserts.py**: pulls specified cases from a given CGAP deployment. For the Cypress test inserts, two cases and their corresponding variants were pulled from CGAP Wolf.
    - Note: if you are creating a new inserts folder (`inserts_destination` in line 30 of this script), add this destination to the `InsertWriter` class (within the `PERMISSIBLE_INSERTS` list in line 82 of `insert_loader_classes.py`)
    - You can also omit additional keys when pulling inserts by adding those keys to the `keys_to_remove` list in line 19
- **duplicate_variants_across_samples.py**: duplicates specified number of variants from one sample to another. This was used to create overlapping variants between the two cases within the Cypress test inserts
- **edit_alias.py**: replaces the project within aliases in specified JSON files
- **replace_project_and_institution.py**: replaces the project and institution attributes within items in specified JSON files. This was done to switch the project and institution to `Cypress Main` for the appropriate inserts
- **delete_extraneous_processed_files.py**: removes extraneous processed files and corresponding QC files

#### Utility scripts
- **json_item_counter.py**: counts and returns number of items within specified JSON file
- **list_duplicates_in_json_file.py**: checks for duplicate item attribute values (based on key) within specified JSON file. Lists duplicate values and number of duplicated items, if present; prints `0` if no duplicates present
