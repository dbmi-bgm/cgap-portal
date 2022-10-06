import json
import os
import re
from dcicutils import ff_utils
from pathlib import Path

"""
InsertFinder: class to pull inserts from a CGAP deployment
"""
class InsertFinder:
    
    UUID_IDENTIFIER = re.compile(
        '^[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[a-f0-9]{4}-?[a-f0-9]{12}\Z',
        re.I,
    )

    # items that will be pulled, but not recursively pull if they are present as a linkTo
    KEYS_TO_IGNORE = ["uuid", "title", "blob_id", "md5sum", "content_md5sum", "ingestion_ids", "associated_meta_workflow_runs"] 
    
    def __init__(self, omit_fields, auth_key):
        self.inserts = {}
        self.uuids_seen = set()
        self.uuids_to_get = set()
        self.schema_names = ff_utils.get_schema_names(key=auth_key)
        self.omit_fields = omit_fields
        self.auth_key = auth_key
        
    def get_inserts(self, uuids):
        self.uuids_to_get.update(set(uuids))
        self.get_all_linked_items()
        return self.inserts
    
    def get_all_linked_items(self):
        while self.uuids_to_get:
            current_uuids_to_get = self.uuids_to_get.copy()     
            for uuid in current_uuids_to_get:
                if uuid not in self.uuids_seen:
                    item_schema_name = self.get_item_schema_name(uuid)
                    if item_schema_name not in self.inserts:
                        self.inserts[item_schema_name] = []
                        print("Found items of type: %s" % item_schema_name)
                    insert_item = self.get_cleaned_item(uuid)
                    self.inserts[item_schema_name].append(insert_item)
                    self.find_linked_items(insert_item)
                    self.uuids_seen.add(uuid)
            self.uuids_to_get.difference_update(current_uuids_to_get)
                
    def get_item_schema_name(self, uuid):
        item_object = ff_utils.get_metadata(uuid, add_on="frame=object", key=self.auth_key)
        item_type = item_object["@type"][0]
        item_schema_name = self.schema_names[item_type]
        return item_schema_name
    
    def get_cleaned_item(self, uuid):
        item_raw = ff_utils.get_metadata(uuid, add_on="frame=raw", key=self.auth_key)
        for key in self.omit_fields:
            if key in item_raw:
                del item_raw[key]
        return item_raw
    
    def find_linked_items(self, item):
        if isinstance(item, dict):
            for key in item.keys():
                if key in self.KEYS_TO_IGNORE:
                    continue
                self.find_linked_items(item[key])
        elif isinstance(item, list):
            for sub_item in item:
                self.find_linked_items(sub_item)
        elif isinstance(item, str):
            if self.UUID_IDENTIFIER.match(item):
                if item not in self.uuids_seen:
                    self.uuids_to_get.add(item)


"""
InsertWriter: class write inserts to a specified directory
"""         
class InsertWriter:
    
    # add directory you want to write inserts to here
    PERMISSIBLE_INSERTS = [
        "master-inserts",
        "inserts",
        "workbook-inserts",
        "deploy-inserts",
        "temp-local-inserts",
        "cypress-test-inserts"
    ]
    INSERTS_FROM_REPO = Path("src/encoded/tests/data/")
    MASTER_INSERTS = Path("master-inserts")
    
    def __init__(self, repo_path, inserts_directory, verbose=True):
        if inserts_directory not in self.PERMISSIBLE_INSERTS:
            raise Exception("Please choose an acceptable inserts destination")
        self.repository_path = Path(repo_path)
        self.inserts_path = self.repository_path.joinpath(self.INSERTS_FROM_REPO)
        self.master_inserts_path = self.inserts_path.joinpath(self.MASTER_INSERTS)
        self.inserts_to_write_path = self.inserts_path.joinpath(Path(inserts_directory))
        self.verbose = verbose
        self.check_inserts_path()
        
    def check_inserts_path(self):
        assert self.inserts_path.is_dir()
        if not self.inserts_to_write_path.is_dir():
            self.inserts_to_write_path.mkdir()
        
    def update_inserts(self, inserts):
        self.compare_inserts_against_master(inserts)
        updated_inserts = self.update_existing_inserts_with_new(inserts)
        self.write_inserts_to_destination(updated_inserts)
        
    def compare_inserts_against_master(self, inserts):
        insert_types_to_delete = []
        master_inserts = self.get_master_inserts()
        for item_type, insert_items in inserts.items():
            master_insert_items = master_inserts.get(item_type)
            if master_insert_items:
                duplicates, conflicts, _, uniques = self.get_duplicates_conflicts_and_uniques(
                    master_insert_items, insert_items
                )
                if self.verbose:
                    if duplicates:
                        print(
                            "%s inserts already exist in master-inserts for item type: %s"
                            % (len(duplicates), item_type)
                        )
                    if conflicts:
                        print(
                            "%s inserts conflict with master-inserts and will not be created"
                            " for item type: %s"
                            % (len(conflicts), item_type)
                        )
                if uniques:
                    inserts[item_type] = uniques
                else:
                    insert_types_to_delete.append(item_type)
        for item_type in insert_types_to_delete:
            del inserts[item_type]
            
    def update_existing_inserts_with_new(self, inserts):
        existing_inserts = self.fetch_inserts_from_path(self.inserts_to_write_path)
        for item_type, insert_items in inserts.items():
            existing_item_inserts = existing_inserts.get(item_type)
            if existing_item_inserts:
                (
                    duplicates, conflicts, existing_uniques, new_uniques
                ) = self.get_duplicates_conflicts_and_uniques(
                    existing_item_inserts, insert_items
                )
                if self.verbose:
                    if conflicts:
                        print(
                            "Overwriting %s existing inserts for item_type: %s"
                            % (len(conflicts), item_type)
                        )
                    if new_uniques:
                        print(
                            "Adding %s new inserts for item type: %s"
                            % (len(new_uniques), item_type)
                        )
                updated_inserts = existing_uniques + duplicates + new_uniques
                existing_inserts[item_type] = updated_inserts
            else:
                existing_inserts[item_type] = insert_items
        return existing_inserts
            
    def get_duplicates_conflicts_and_uniques(self, existing_items, new_items):
        duplicates = []
        conflicts = []
        existing_uniques = []
        new_uniques = []
        existing_uuids_to_idx = self.map_uuids_to_idx(existing_items)
        new_uuids_to_idx = self.map_uuids_to_idx(new_items)
        uuid_duplicates = [
            uuid for uuid in existing_uuids_to_idx if uuid in new_uuids_to_idx
        ]
        for existing_item in existing_items:
            existing_uuid = existing_item["uuid"]
            if existing_uuid not in uuid_duplicates:
                existing_uniques.append(existing_item)
            else:
                new_item_idx = new_uuids_to_idx[existing_uuid]
                new_item = new_items[new_item_idx]
                if sorted(existing_item) == sorted(new_item):
                    duplicates.append(existing_item)
                else:
                    conflicts.append(new_item)
        new_uniques += [item for item in new_items if item["uuid"] not in uuid_duplicates]
        return duplicates, conflicts, existing_uniques, new_uniques
        
    def map_uuids_to_idx(self, insert_items):
        return {item["uuid"]: idx for idx, item in enumerate(insert_items)}
        
    def write_inserts_to_destination(self, inserts_to_write):
        for item_type, insert_items in inserts_to_write.items():
            file_name = self.inserts_to_write_path.joinpath(Path(item_type + ".json"))
            with open(str(file_name), mode="w") as file_handle:
                json.dump(insert_items, file_handle, indent=4)     
            
    def get_master_inserts(self):
        return self.fetch_inserts_from_path(self.master_inserts_path)
        
    def fetch_inserts_from_path(self, inserts_path):
        item_types = []
        item_uuids = []
        inserts = {}
        for _, _, filenames in os.walk(inserts_path):
            item_types += [item[:-5] for item in filenames if item.endswith(".json")]
        for item_type in item_types:
            item_type_path = inserts_path.joinpath(Path(item_type + ".json"))
            insert_items = self.get_insert_items(item_type_path)
            inserts[item_type] = insert_items
        return inserts
              
    def get_insert_items(self, inserts_path):
        with open(inserts_path) as file_handle:
            inserts = json.load(file_handle)
        return inserts  
