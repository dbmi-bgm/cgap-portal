===================================
Updating Items from Ontologies
===================================

**Disorder** and **Phenotype** Items correspond to ontology terms from the MONDO or HPO ontologies.

The Items are converted from owl ontology files to our json items defined by the schemas with the script ``generate_items_from_owl.py``, which lives in the src/encoded/commands directory and is called from the top level directory as ``bin/owl-to-items``

The script must currently be run locally.  The script usage and parameters are described below.

``bin/owl-to-items Disorder --env fourfront-cgap --load --post_report``

Params and Options:

*item_type* - required Disorder or Phenotype

--env - (default = local) - environment on which to generate updates eg. fourfront-cgap
  the specified environment will be queries for existing items of the specified types for comparison and if *load* option is used will be the target for insert loading.

NOTE: can use *key* and *keyfile* options in place of *env* to get an auth dict from a stored set of credentials.

--input - url or path to owlfile - overrides the download_url present in script ITEM2OWL config info set at the top of the script.  Useful for generating items from a specific version of an ontology - the download_url specified in the config gets the current latest version of the owl file.

--outfile - relative or absolute path and filename to write output.  If you use the *load* parameter and don’t specify an *outfile* you will be prompted if you wish to specify a file and as a safety backup will still generate a file with name ``item_type.json`` in the top level directory

--load - if param is used will use the load_data endpoint (as wrapped in the load_items function from load_items.py script) to update the database by loading the generated inserts.

--post_report - if param is used will post a Document item to the portal with name like ‘item_type_Update_date-time’ and the generated logfile as an attachment.

--pretty - will write output in pretty json format for easier reading

--full - will create inserts for the full file - does not filter out existing and unchanged terms - WARNING - use with care.

Processing Data Flow
---------------------

- An RDF graph representation of the specified OWL ontology file is created. A specific version of an Ontology can be specified by URL or by filename (for a local owl file) - by default the URL specified in the script config gets the latest version.
- The graph is converted into a dict of term items keyed by their term_ids eg. MONDO:123456 or HP:123456 - the term is itself a dict consisting of fields whose values come from the owl.  Item specific terms that come from the owl are specified in the config eg. for Phenotype the name_field is ‘phenotype_name’ and id_field is ‘hpo_id’
- The terms/items from the file  are compared to the existing Items of the specified type from the database.

   - posts are created for new Items that are not in the database
   - patches are created for existing items that have fields that have changed
   - patches to status=obsolete for existing items no longer in the file

- all the changes are logged and the json corresponding to the updates becomes part of the log
- if the *load* option is used the updates will be posted to the server using the *load_data* endpoint via the *load_items* function of ``load_items.py``
- if the *post_report* option is used then the log will posted as a Document to the portal

Troubleshooting
----------------

The generation of updates and loading of inserts can be decoupled and run separately and the Document Item with the information about what happened can be generated and posted or edited manually if necessary.

Loading can be accomplished using ``bin/load-items`` script.

Possible most likely points of failure:

**During generation of updates**

- getting existing items from the database - this takes a few minutes and depends on connection to server
- downloading and processing the owl files - takes several minutes and usually depends on internet connection to external servers

**During loading of updates**

- typically if items fail to load there is a systematic reason that needs to be specifically resolved.
- connection issues can lead to partial loads - in this case the saved inserts should be loadable by ``load_items`` - the script is designed to avoid conflicts with partially loaded items.

**Posting of logs**

- this shouldn’t fail per se but:
- if the processing fails at any point above you may have a partial log and you should have info as to where the error occurred.
- you might want to update the Document by for example, concatenating generation and load logs for a decoupled run.  Or appending the successful load logs in case of interrupted loads.
