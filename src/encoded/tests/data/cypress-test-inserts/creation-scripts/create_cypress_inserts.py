#!/usr/bin/env python

"""
Main script used to pull initial inserts for Cypress test inserts
Two cases were pulled from cgap-wolf: NA12879 and HG002
"""

from dcicutils import ff_utils
from get_keys import keys # to load cgap-keys file in home directory
from insert_loader_classes import InsertFinder, InsertWriter

if __name__ == "__main__":
    # Specify which portal to pull inserts from (this set was pulled from cgap-wolf)
    key = keys["wolf"]

    # Keys that are always omitted
    keys_to_remove = ["date_created", "submitted_by", "last_modified", "schema_version"]
    # Add optional omitted properties to prevent pulling unnecessary inserts
    keys_to_remove += [
        "meta_workflow_run",
        "meta_workflow_run_sv",
        "meta_workflow_runs"
    ]

    # Specify which directory to write inserts into
    path_to_portal_repo = "/Users/dbmi/Desktop/CGAP/cgap-portal" # path to top directory of local portal repository
    
    # NOTE: this destination must be added to PERMISSIBLE_INSERTS
    # within InsertWriter class (in inser_loader_classes.py)
    inserts_destination = "cypress-test-inserts" # for loading into cypress inserts folder

    # InsertFinder object to pull inserts from cgap-wolf
    insert_finder = InsertFinder(keys_to_remove, key) 
    # InsertWriter for cypress-test-inserts directory
    insert_writer = InsertWriter(path_to_portal_repo, inserts_destination) 

    # specify which cases to pull from CGAP deployment
    uuids_to_get = ["/cases/GAPCA3OREJJQ/", "/cases/GAPCAAX2X4D8/"]
    # get rid of duplicates
    uuids_to_get = list(set(uuids_to_get))

    # pull these two cases from specified CGAP deployment
    inserts = insert_finder.get_inserts(uuids_to_get)
    # write pulled inserts to specified directory
    insert_writer.update_inserts(inserts)


    ### pull inserts for variants separately

    ## SNVs
    SNV_uuids = []
    # 50 SNVs from case NA12789 -- search query filter string found under details for case
    search = ff_utils.search_metadata(
        (
            "search/?type=VariantSample&CALL_INFO=NA12879_sample-WGS&file=GAPFIPD2CSFH"
            "&field=uuid&limit=50"
        ),
        key=key,
    )
    SNV_uuids += [item["uuid"] for item in search] 

    # add 25 SNVs from second case, HG002/NA24385
    search = ff_utils.search_metadata(
        (
            "search/?type=VariantSample&CALL_INFO=NA24385_sample-WGS&file=GAPFI3HP7Y9J"
            "&field=uuid&limit=25"
        ),
        key=key,
    )
    SNV_uuids += [item["uuid"] for item in search]
    list(set(SNV_uuids)) # get rid of duplicates

    # retrieve SNV inserts and write to Cypress test inserts directory
    SNV_inserts = insert_finder.get_inserts(SNV_uuids)
    insert_writer.update_inserts(SNV_inserts)


    ## SVs/CNVs (structural variants)
    SV_uuids = []
    # pull 50 from first case, NA12789
    search = ff_utils.search_metadata(
        (# this is for a trio case
            "search/?type=StructuralVariantSample&CALL_INFO=NA12879_sample-WGS&file=GAPFIQHD6QAN"
            "&field=uuid&limit=50"
        ),
        key=key,
    )
    SV_uuids += [item["uuid"] for item in search]

    # add 25 from second case, HG002/NA24385
    search = ff_utils.search_metadata(
        (
            "search/?type=StructuralVariantSample&CALL_INFO=NA24385_sample-WGS&file=GAPFIHNS8TBL"
            "&field=uuid&limit=25"
        ),
        key=key,
    )
    SV_uuids += [item["uuid"] for item in search]
    list(set(SV_uuids)) # gets rid of duplicates

    # retrieve and write structural variants
    SV_inserts = insert_finder.get_inserts(SV_uuids)
    insert_writer.update_inserts(SV_inserts)

    ###
    # to get CNV's with BIC-seq2 as the caller (this was added after the code above was run)
    # add 25 from second case, HG002/NA24385 (only this case had CNVs)
    CNV_uuids = []
    search = ff_utils.search_metadata(
        (
            "search/?type=StructuralVariantSample&CALL_INFO=NA24385_sample-WGS&field=uuid&callers=BIC-seq2&limit=25"
        ),
        key=key,
    )
    CNV_uuids += [item["uuid"] for item in search]
    list(set(CNV_uuids)) # get rid of duplicates

    # retrieve and write these inserts
    CNV_inserts = insert_finder.get_inserts(CNV_uuids)
    insert_writer.update_inserts(CNV_inserts)