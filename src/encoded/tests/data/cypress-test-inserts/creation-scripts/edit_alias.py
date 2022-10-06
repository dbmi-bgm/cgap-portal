#!/usr/bin/env python

"""
Replace project within aliases in specified JSON files
e.g. "cgap-core:GAPFI4ELFNSI.fastq.gz" --> "cypress-main:GAPFI4ELFNSI.fastq.gz"
"""

from json import load, dump
from pathlib import Path

if __name__ == "__main__":

    # absolute path to top directory of local CGAP portal repository
    path_to_portal_repo = Path("/Users/dbmi/Desktop/CGAP/cgap-portal") 

    # relative path of inserts repository, in relation to portal repo above
    inserts_repo = Path("src/encoded/tests/data/")
    inserts_directory = Path("cypress-test-inserts")

    # create absolute file path to inserts directory
    path_to_inserts_dir = path_to_portal_repo.joinpath(inserts_repo.joinpath(inserts_directory))

    # list of JSON files you want to edit within this directory
    inserts_files = ["case.json", "family.json", "file_fastq.json", "individual.json", "report.json", "sample_processing.json", "sample.json"]

    # go filewise through directory and edit aliases
    for file in inserts_files:

        # create absolute filepath to JSON file
        json_file = Path(file)
        absolute_file_path = path_to_inserts_dir.joinpath(json_file)
        print(absolute_file_path.exists()) # check that this path is viable

        with open(str(absolute_file_path),'r') as json_obj_list:
            json_list = load(json_obj_list)
            
            # replace alias
            for item in json_list:
                for index, alias in enumerate(item["aliases"]):
                    if "cgap-core" in alias: # replace project within alias
                        temp = alias.replace("cgap-core", "cypress-main")
                        item["aliases"][index] = temp

        # and rewrite the JSON file
        with open(str(absolute_file_path),'w') as json_obj_list:
            dump(json_list, json_obj_list, indent=4)

