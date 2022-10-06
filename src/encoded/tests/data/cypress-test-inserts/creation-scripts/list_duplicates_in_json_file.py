#!/usr/bin/env python

"""
Checks for duplicate items (based on key) within specified json file
List duplicates and number of duplicated items, if present
If no duplicates, prints 0
"""

import json
from pathlib import Path

if __name__ == "__main__":
    # absolute path to top directory of local portal repository
    path_to_portal_repo = Path("/Users/dbmi/Desktop/CGAP/cgap-portal") 

    # relative path to inserts directory, in relation to portal repository above
    inserts_repo = Path("src/encoded/tests/data/")
    inserts_directory = Path("cypress-test-inserts")

    # specify JSON file to be checked (e.g. this checks structural_variant_sample JSON file)
    json_file = Path("structural_variant_sample.json")

    # combine to make overall absolute file path to specified JSON file
    absolute_file_path = path_to_portal_repo.joinpath(inserts_repo.joinpath(inserts_directory.joinpath(json_file)))
    absolute_file_path.exists() # make sure it this path exists

    # access this JSON file and check for duplicate items
    with absolute_file_path.open() as json_obj_list:
        json_list = json.load(json_obj_list) # return JSON object (list of dicts)

        key_to_check = "structural_variant" # or whatever you're trying to check
        non_duplicates_list = [] # will add non-duplicates here
        counter = 0 # for the number of duplicates present in this file
        for json_obj in json_list:
            val = json_obj[key_to_check] # retrive value for this key
            if val not in non_duplicates_list:
                non_duplicates_list.append(val)
            else:
                print(val) # prints duplicates
                counter += 1
        print(counter)