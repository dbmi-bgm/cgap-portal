#!/usr/bin/env python

"""
Duplicate specified number of variants from one sample to another
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

    # list of JSON files to be edited within this directory
    inserts_files = ["variant_sample.json", "structural_variant_sample.json"]

    flag = False # for differentiating between variant and structural variants
    # go filewise through file list and duplicate variants accordingly
    for file in inserts_files:
        if file == "structural_variant_sample.json": # just for this list of files
            flag = True

        # create filepath to current json file
        json_file = Path(file)
        absolute_file_path = path_to_inserts_dir.joinpath(json_file)
        print(absolute_file_path.exists())

        with open(str(absolute_file_path),'r') as json_obj_list:
            json_list = load(json_obj_list)
        
            # two cases CALL_INFO: NA12879_sample-WGS (x50), HG002/NA24385_sample-WGS (x25)
            # make set of variants/structural_variants from NA12879
            # which will be copied over to case HG002
            curr_variants = set()
            for item in json_list:
                if item["CALL_INFO"] == "NA12879_sample-WGS":
                    if not flag:
                        curr_variants.add(item["variant"])
                    else:
                        curr_variants.add(item["structural_variant"])
            
            # replace 20 of the variants/structural_variants for HG002/NA24385_sample-WGS
            counter = 0
            for item_again in json_list:
                if counter == 20:
                    break
                if item_again["CALL_INFO"] == "NA24385_sample-WGS":
                    file_id = item_again["file"]
                    call_info = item_again["CALL_INFO"]
                    if not flag: # replace variants
                        item_again["variant"] = curr_variants.pop()
                        item_again["annotation_id"] = call_info + ":" + item_again["variant"] + ":" + file_id
                    else: # replace structural variants
                        item_again["structural_variant"] = curr_variants.pop()
                        item_again["annotation_id"] = call_info + ":" + item_again["structural_variant"] + ":" + file_id
                    counter += 1

        # rewrite the edited inserts to JSON file
        with open(str(absolute_file_path),'w') as json_obj_list:
            dump(json_list, json_obj_list, indent=4)
