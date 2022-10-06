#!/usr/bin/env python

"""
Replace project and institution to Cypress Main for appropriate inserts
"""

from json import load, dump
import os
from pathlib import Path

if __name__ == "__main__":

    # absolute path to top directory of local CGAP portal repository
    path_to_portal_repo = Path("/Users/dbmi/Desktop/CGAP/cgap-portal") 

    # relative path of inserts repository, in relation to portal repo above
    inserts_repo = Path("src/encoded/tests/data/")
    inserts_directory = Path("cypress-test-inserts")

    # create absolute file path to inserts directory
    path_to_inserts_dir = path_to_portal_repo.joinpath(inserts_repo.joinpath(inserts_directory))

    # list of JSON files you do NOT want to edit within this directory
    excluded_jsons = ["variant.json", "structural_variant.json", "gene.json", "file_format.json", "institution.json", "project.json", "user.json"]
    
    # list all json files within inserts directory
    inserts_files = os.listdir(path_to_inserts_dir)

    # remove the excluded jsons from inserts you want to edit
    for json in excluded_jsons:
        inserts_files.remove(json)
        
    # go filewise through target files and edit project and institution
    for file in inserts_files:
        # create absolute file path to current target file
        json_file = Path(file)
        absolute_file_path = path_to_inserts_dir.joinpath(json_file)
        print(absolute_file_path.exists()) # make sure this filepath is viable

        with open(str(absolute_file_path),'r') as json_obj_list:
            json_list = load(json_obj_list)
            # replace the project and institution with appropriate uuids
            # these are the uuids for cypress-main project and institution
            for item in json_list:
                item["project"] = "1aa36a0b-9e6e-43ec-95d7-cd00e22589f3"
                item["institution"] = "9f4daa37-c5b5-4e19-89bc-fdcd4638f12d"

        # write the edited json object to the specified file
        with open(str(absolute_file_path),'w') as json_obj_list:
            dump(json_list, json_obj_list, indent=4)

