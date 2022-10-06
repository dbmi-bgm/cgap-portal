#!/usr/bin/env python

"""
Counts and returns number of items within JSON file
"""

import json
from pathlib import Path

if __name__ == "__main__":
    # absolute path to top directory of local CGAP portal
    path_to_portal_repo = Path("/Users/dbmi/Desktop/CGAP/cgap-portal") 

    # relative path to inserts in relation to portal repo above
    inserts_repo = Path("src/encoded/tests/data/")
    inserts_directory = Path("cypress-test-inserts")

    # JSON file to be accessed
    json_file = Path("case.json")

    # create absolute file path to specified JSON file
    absolute_file_path = path_to_portal_repo.joinpath(inserts_repo.joinpath(inserts_directory.joinpath(json_file)))
    absolute_file_path.exists() # make sure specified path to directory exists

    with absolute_file_path.open() as json_obj_list:
        json_list = json.load(json_obj_list)
        print(len(json_list)) # prints length of json list, which is the number of items in this json