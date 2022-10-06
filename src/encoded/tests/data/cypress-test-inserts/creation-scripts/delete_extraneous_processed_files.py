#!/usr/bin/env python

"""
Removes extraneous processed files and corresponding QC files
"""

from json import load, dump
from pathlib import Path

def remove_files(filepath, extraneous_files_ids):
    """
    Removes extraneous items with given UUIDs

    :param filepath: absolute filepath to JSON file
    :type filepath: Path object
    :param extraneous_files_ids: list of UUIDs of items (representing files) to be removed from given JSON
    :type extraneous_files_ids: list[str]
    """
    with open(str(filepath),'r') as json_obj_list:
        print(type(json_obj_list))
        json_list = load(json_obj_list)

        # remove extraneous files
        for item in json_list:
            if item["uuid"] in extraneous_files_ids:
                json_list.remove(item)

    with open(str(filepath),'w') as json_obj_list:
        dump(json_list, json_obj_list, indent=4)

if __name__ =="__main__":
    # absolute path to top directory of local CGAP portal repository
    path_to_portal_repo = Path("/Users/dbmi/Desktop/CGAP/cgap-portal") 

    # relative path of inserts repository, in relation to portal repo above
    inserts_repo = Path("src/encoded/tests/data/")
    inserts_directory = Path("cypress-test-inserts")

    # create absolute file path to inserts directory
    path_to_inserts_dir = path_to_portal_repo.joinpath(inserts_repo.joinpath(inserts_directory))

    # JSON file that contains processed files
    file = "file_processed.json"

    # construct full absolute filepath to processed file JSON and check it exists
    json_file = Path(file)
    absolute_file_path = path_to_inserts_dir.joinpath(json_file)
    print(absolute_file_path.exists())


    ### remove extraneous processed vcf files

    qc_ids_to_remove = [] # list of qc IDs to be removed

    with open(str(absolute_file_path),'r') as json_obj_list:
        json_list = load(json_obj_list)

        # create list of VCF files that are extraneous
        for item in json_list:
            if (item["file_type"] == "full annotated VCF") or (item["file_type"] == "full-annotated vcf"): # or (item["file_vcf_to_ingest"] == True)):
                # do not delete the following processed files, needed for variants in filter spaces
                if (item["accession"] != "GAPFIPD2CSFH") and (item["accession"] != "GAPFIQHD6QAN") and (item["accession"] != "GAPFI3HP7Y9J") and (item["accession"] != "GAPFIHNS8TBL"):
                    qc_ids_to_remove.append(item["quality_metric"])
                    json_list.remove(item)
                    
    with open(str(absolute_file_path),'w') as json_obj_list:
        dump(json_list, json_obj_list, indent=4)


    # construct absolute filepath for QC List and check it exists
    qclist = "quality_metric_qclist.json"
    qclist_json_file = Path(qclist)
    qclist_absolute_file_path = path_to_inserts_dir.joinpath(qclist_json_file)
    print(qclist_absolute_file_path.exists())

    qc_id_pairs = [] # list of pairs: (QC ID, QC type) -- to be deleted

    with open(str(qclist_absolute_file_path),'r') as json_obj_list:
        json_list = load(json_obj_list)

        # loop through QC uuids to be removed and construct QC pair list
        for item in json_list:
            if item["uuid"] in qc_ids_to_remove:
                for qc in item["qc_list"]:
                    qc_id_pairs.append(qc)
                json_list.remove(item)

    # rewrite edited QC List, deleting extraneous QC files
    with open(str(qclist_absolute_file_path),'w') as json_obj_list:
        dump(json_list, json_obj_list, indent=4)


    # Two sets: vcfqc and vcfcheck
    # for future development, also check for peddyqc, fastqc, bamqc
    # these inserts only required deletion of vcfqc and vcfcheck QC files
    vcfqc = set()
    vcfcheck = set()
    for id_pair in qc_id_pairs:
        if id_pair["qc_type"] == "quality_metric_vcfcheck":
            vcfcheck.add(id_pair["value"])
        elif id_pair["qc_type"] == "quality_metric_vcfqc":
            vcfqc.add(id_pair["value"])
            
    vcfqc_list = list(vcfqc)
    vcfcheck_list = list(vcfcheck)


    # construct absolute filepath for vcfqc JSON and check it exists
    vcfqc_json = "quality_metric_vcfqc.json"
    vcfqc_json_file = Path(vcfqc_json)
    vcfqc_absolute_file_path = path_to_inserts_dir.joinpath(vcfqc_json_file)
    print(vcfqc_absolute_file_path.exists())

    # construct absolute filepath for vcfcheck JSON and check it exists
    vcfcheck_json = "quality_metric_vcfcheck.json"
    vcfcheck_json_file = Path(vcfcheck_json)
    vcfcheck_absolute_file_path = path_to_inserts_dir.joinpath(vcfcheck_json_file)
    print(vcfcheck_absolute_file_path.exists())

    # remove extraneous vcfqc items
    remove_files(vcfqc_absolute_file_path, vcfqc_list)
    # remove extraneous vcfcheck items
    remove_files(vcfcheck_absolute_file_path, vcfcheck_list)