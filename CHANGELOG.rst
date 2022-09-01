===========
cgap-portal
===========

----------
Change Log
----------


10.3.0
======

**Nature of Breaking Change**

This breaking change should not affect production builds or GA, but you should report problems if you see them.
This change is intended only to affect developers who are doing local testing
(e.g., ``make test`` or a call to ``pytest``) that would use ``test.ini``
or who are doing local deploys (e.g., ``make deploy1``) that would use ``development.ini``.

Prior to this change, ``development.ini`` and ``test.ini`` were in source control.
This PR chagnes this so that what's in source control is ``development.ini.template`` and ``test.ini.template``.
There is a command introduced, ``prepare-local-dev`` that you can run to create a ``development.ini``
and ``test.ini``. Once the file exists, the ``prepare-local-dev`` command will not touch it,
so you can do other edits as well without concern that they will get checked in.
The primary change that this command does is to make a local environment of ``cgap-devlocal-<yourusername>``
or ``cgap-test-<yourusername>`` so that testing and debugging that you do locally will be in an environment
that does not collide with other users. To use a different name, though, just edit the resulting file,
which is no longer in source control.

Changes made by this PR:

* Renames ``development.ini`` to ``development.ini.template``, parameterizing ``env.name``.
* Renames ``test.ini`` to ``test.ini.template``, parameterizing ``env.name``.
* Adds new script ``prepare-local-dev``.
* Adjusts ``Makefile`` to run the ``prepare-local-dev`` script in target ``build-after-poetry``.
* Renames ``commands/prepare_docker.py`` to ``commands/prepare_template.py``
  so that the two commands ``prepare-docker`` and ``prepare-local-dev`` can live in the same file.
  They do similar things.
* There is no change to docker setup, since that already does ``make build``.
* There is no change to GA workflows, since they already do ``make build``.


10.2.3
======

`PR 641: Pin poetry 1.1.15 <https://github.com/dbmi-bgm/cgap-portal/pull/641>`_

* Fixed broken hyperlinks in static documentation pages, updating links as necessary.


10.2.2
======

`PR 636: Add CHANGELOG.rst <https://github.com/dbmi-bgm/cgap-portal/pull/636>`_

* Add CHANGELOG.rst
* Add testing of version and changelog consistency.


10.2.1
======

`PR 632: Repair GA <https://github.com/dbmi-bgm/cgap-portal/pull/632>`_

* Adjust buckets use in ``test.ini``, ``development.ini``, the docker ``.ini`` files,
  and ``src/encoded/tests/conftest_settings.py`` to be buckets from ``cgap-devtest`` account.
* Update access creds for ``cgap-devtest``
* Change remote ES URL in ``Makefile`` and GA workflows.
* Add a user record for David Michaels in master-inserts.


10.2.0
======

`PR 629: Allow Mixed Sequencing Submissions <https://github.com/dbmi-bgm/cgap-portal/pull/629>`_

* Refactor ``submit.py`` to allow case submissions with samples containing different sequencing types.
  (Previously, we would raise an error, but we want to allow such submissions for the tentative
  future to inspect whether bioinformatics can process such cases.)


10.1.1
======

`PR 630: Fix fix-dist-info (C4-879) <https://github.com/dbmi-bgm/cgap-portal/pull/630>`_

* Fix ``scripts/fix-dist-info`` to have a more robust regular expression for the files it needs to delete.
  (The major version number of ``cgap-portal`` having gone from 9 to 10 had created a problem because the
  prior regexp had looked only for a single digit.)


10.1.0
=======

`PR 616: Expanded File Submission <https://github.com/dbmi-bgm/cgap-portal/pull/616/files>`_

Refactor our file submission process to accommodate more file types.

The main changes include:

* A new item type, ``FileSubmitted``, to be used for all submitted files
* The ``FileFastq`` type is deprecated. It continues to be supported for now, but will go away.
* ``FileFormat`` metadata dictates whether such files are accepted (via the ``valid_item_types`` property).
* One property (files) on ``Sample`` and ``SampleProcessing`` to hold all submitted files
  (deprecating and removing cram_files on Sample with upgrader to move existing CRAMs there to files).
* A new class, ``SubmittedFilesParser``, within ``submit.py`` to validate/create ``FileSubmitted`` items during submission
* Support for "extra files" associated with a ``File``.
  We may not end up needing these after initially hearing they would be required, but the functionality
  should be entirely contained here. Some aspects of how "extra files" work are a little clunky with respect
  to uploads and PATCHes and may need further refactoring should we require extra files from users.

With these updates, the only required validation on submitted files is to check
whether the extensions match accepted ``FileFormats``,
plus some additional checks on FASTQs to ensure accurate paired-end identification and pair matching.


10.0.0
======

`PR 625: Accept configurable env_utils (and other relevant changes) <https://github.com/dbmi-bgm/cgap-portal/pull/625>`_

Incompatible Changes:

* Changes to which version of ``dcicutils`` is required in ``pyproject.toml``:

  * ``dcicutils`` (``^4.0.2``, with configurable ``env_utils``)
    Requires different values in the Secrets Manager and when running standalone for debugging.

    In particular, ``GLOBAL_ENV_BUCKET`` must be set the name of the ``...-envs`` bucket that ``EnvUtils``
    finds files describing the various environments in a given account, including particularly the
    file called ``main.ecosystem`` that describes the entire account setup.

    Note that the older environment variable ``GLOBAL_BUCKET_ENV`` is deprecated. Please rewrite uses
    to use the methods on ``dcicutils.env_base.EnvBase`` such as ``EnvBase.global_env_bucket_name`` to
    obtain the value and ``EnvBase.global_env_bucket_named``, a context manager, to bind the value.

  * ``dcicsnovault`` (``^6.0.0``) requires ``dcicutils 4.x``.

New Features:

* New commands (available from a ``bash`` shell)

  * Commands for managing ECR images:

    * ``add-image-tag``
    * ``show-image-manifest``
    * ``show-image-catalog``
    * ``unrelease-most-recent-image``

  * Commands for managing the new ``env_utils`` data:

    * ``show-global-env-bucket``

Compatible Changes and Bug Fixes:

* Changes to buckets used for testing in ``test.ini``.

  * ``file_upload_bucket = cgap-unit-testing-files`` (formerly ``elasticbeanstalk-encoded-4dn-files``)
  * ``blob_bucket = cgap-unit-testing-blobs`` (formerly ``elasticbeanstalk-encoded-4dn-blobs``)
  * ``metadata_bundles_bucket = cgap-unit-testing-metadata-bundles``
    (formerly ``elasticbeanstalk-fourfront-cgaplocal-test-metadata-bundles``)
  * ``file_wfout_bucket = cgap-unit-testing-wfout`` (formerly not present)

* Changes to required versions of libraries other than ``dcicutils`` and ``dcicsnovault`` are compatible.

Small Additional Changes:

* Add a ``.flake8`` file that suppresses small whitespace-related PEP8 problems for a while
  so ``flake8`` can show us more serious problems.

* Add ``.python-cmd`` to ``.gitignore``.


9.4.2
=====

`PR 622: VS: row tracking <https://github.com/dbmi-bgm/cgap-portal/pull/622>`_

* Solving the row tracking issue in ``SpreadsheetProcessing`` class within ``src/encoded/submit.py``,
  which is used when processing spreadsheets for accession submissions (cases)
  and pedigree submissions (family histories).

  * The largest change was refactoring the contents of self attribute "rows",
    which was originally a list of dictionaries, where each dictionary contained
    the row's contents from the spreadsheet.
  * The dictionaries were left untouched, but rather than keeping rows as a list
    of those dictionaries, it was changed into a list of tuples ``(dict, int)``,
    where the dict was that row's data, just as before, and the integer was
    that row's line number within the spreadsheet (counted using enumeration
    and a preheader rows counter, for rows before the header in the submitted spreadsheet).
  * Because of this change, there were some extraneous counter variables
    removed from other classes, specifically:
    * ``PedigreeMetadata``
    * ``AccessionMetadata``

* Two pytests were added to the corresponding test file to show correction of this error
* Documentation was added to several classes within the ``submit.py`` file.


9.4.1
=====

`PR 623: Variant tab date fix <https://github.com/dbmi-bgm/cgap-portal/pull/623>`_

* Small fix to validate clinvar dates/prevent client-side error

* Small change to propTypes in SPC to go with this branch: ``4dn-dcic/shared-portal-components#137``


9.4.0
=====

`PR 624: Sv confidence UI <https://github.com/dbmi-bgm/cgap-portal/pull/624>`_

* Added call confidence to Variant Info pane for SVs
* Updated title of BIC-seq2 & Manta properties sections and added a link to cgap's docs
* Updated manta properties section with split_reads and paired_reads (values + descriptions from schema)

Notes: Built this off of Doug's SV confidence branch


9.3.0
=====

`PR 621 Technical Review Follow-Up <https://github.com/dbmi-bgm/cgap-portal/pull/621>`_

* UI Change: Separates Interpretation Selection functionality/checkbox into own column plus some minor styling + refactoring.

`PR 617: Cypress v10 update + test fix <https://github.com/dbmi-bgm/cgap-portal/pull/617>`_

* Update to cypress 10.
* Fix for a couple of tests.


9.2.4
=====

`PR 619: Added self (V. Stevens) as user for local deployment <https://github.com/dbmi-bgm/cgap-portal/pull/619>`_

* Added a developer profile under src/encoded/tests/data/master-inserts/user.json


9.2.3
=====

`PR 620: July Security Update <https://github.com/dbmi-bgm/cgap-portal/pull/620>`_

* Brings in snovault fixes for invalidation scope, updating tests as needed
* Updates libraries wherever possible

`PR 595: Technical Review on Filtering Tab <https://github.com/dbmi-bgm/cgap-portal/pull/595>`_

* Adjustments to documentation

  * ``docs/source/index.rst``
  * ``docs/source/dataflow_overview.rst``
  * ``docs/source/docker-local.rst``
  * ``docs/source/infrastructure_overview.rst``
  * ``docs/source/ingestion.rst``
  * ``docs/source/local_installation.rst``

* Diagram Upgrades to pretty diagrams made by Shannon

  * ``docs/source/img/cgap_infra_diagram.png``
  * ``docs/source/img/portal_dataflow_diagram.png``

* Some ``package.lock`` updates

  * ``sass``
  * ``shared-portal-components``
  * ``auth0-lock``

* Some python dependency updates

  * ``dcicutils``
  * ``dcicsnovault``

* Schema changes

  * New schema type

    * ``NoteTechnicalReview``

  * In mixins, ``attribution`` changed

    * ``Institution`` to be ``"serverDefault": "userinstitution"``
    * ``Project`` to be ``"serverDefault": "userproject"``

  * Bump version

    * ``NoteDiscovery``
    * ``NoteInterpretation``
    * ``NoteStandard``

  * Added fields (some of which may have calculated property support;
    see ``the PR <https://github.com/dbmi-bgm/cgap-portal/pull/595>`_ for details)

    * In ``Note``, add ``"last_text_edited"``
    * In ``Report``, add ``"structural_variant_samples"``
    * In ``StructuralVariant``, add ``"technical_reviews"``
    * In ``StructuralVariantSample``:

      * Add ``"technical_review"``
      * Add ``"widthMap"`` to ``"structural_variant.SV_TYPE"``
      * Add ``"sv_browser"``
      * Add ``"technical_review.assessment.call"``

    * In ``Variant``, add ``"technical_reviews"``.
    * In ``VariantSample``, add ``"technical_review"`` and ``"technical_review.assessment.call"``

* Functional changes
  * ``get_basic_properties_for_user`` returns several properties, where ``project`` was changed to ``project_roles``.
  * ``get_iterable_search_result`` adds optional ``inherit_user`` argument.

* UI static component changes not enumerated here. See `the PR <https://github.com/dbmi-bgm/cgap-portal/pull/595>`_
  for details if interested.

9.2.2
=====

`PR 618: Invalidation Scope Test Fixes + Doc <https://github.com/dbmi-bgm/cgap-portal/pull/618>`_

* Fixes some invalidation scope tests under the new version
* Makes some doc updates, including new diagrams


9.2.1
=====

`PR 615: Bring in updated snovault <https://github.com/dbmi-bgm/cgap-portal/pull/615>`_

* Small updateto snovault requirement, general update of poetry.lock with various new versions.
* Add unit test ``test_project_lifecycle_policy_properties``


9.2.0
=====

`PR 577 Data model updates for MetaWorkflowRuns <https://github.com/dbmi-bgm/cgap-portal/pull/577>`_

In this PR, we create new metadata properties on ``MetaWorkflows``, ``MetaWorkflowRuns``, and ``MetaWorkflowRun``
outputs (``FileProcessed``, ``QualityMetric``) that are required for related changes in foursight and magma.

Specifically, we:

* Move ``MetaWorkflowRuns`` off of ``Cases`` and onto ``SampleProcessings`` ``
  (will handle existing Case items once merged and then delete properties on Case)
* Add properties to MWFR's output to facilitate searches on output items
* Add 2 new MWFR final_status options (stopped for manually stopped items,
  quality metric failed for those stopped due to output QC failure)
* Add properties to handle PATCHing of MWFR output files to appropriate destinations
  (Sample.processed_files or SampleProcessing.processed_files, currently)
* Fix a small embed API error noticed incidentally during foursight testing
* Add properties related to identifying VCFs for ingestion and files for HiGlass display,
  as bioinformatics is insisting on changing/having flexible file type descriptions
  (which kills current routes of finding these)

9.1.2
=====

`PR 614 Show cases without reports by default <https://github.com/dbmi-bgm/cgap-portal/pull/614>`_

* Small change to the homepage case display such that cases without reports are included by default.
  Users can click the button to show only those with reports. We make this change since many of our
  users are accessioning cases without reports since they don't require the item.

* Fix a calcprop on Image items.


9.1.1
=====

`PR 613: Nav updates <https://github.com/dbmi-bgm/cgap-portal/pull/613>`_

* Add 3 links to the top nav on the portal
* Adjustments to BigDropdown components to make it possible to navigate to the marketing website without a double click

9.1.0
=====

`PR 612: Schema changes for lifecycle management <https://github.com/dbmi-bgm/cgap-portal/pull/612>`_

* Schema changes required for
  `foursight-cgap PR 79: Lifecycle management <https://github.com/dbmi-bgm/foursight-cgap/pull/79>`_,
  adding to ``File`` these attributes:

  * ``"s3_lifecycle_category"``
  * ``"s3_lifecycle_status"``
  * ``"s3_lifecycle_last_checked"``

  See `foursight-cgap PR 79 <https://github.com/dbmi-bgm/foursight-cgap/pull/79>`_
  for more detailed description and rationale.


9.0.1
=====

`PR 611: Upgrader Fix for Schema Version <https://github.com/dbmi-bgm/cgap-portal/pull/611>`_

* Bring in latest ``snovault`` version, which includes further fixes to the upgrader process to handle
  items without a ``"schema_version"`` property.
* Add a test to ensure all non-abstract items contain proper ``"schema_version"`` properties.

Dependabot changes (no version bump):

* `PR 576: Bump numpy from 1.19.1 to 1.21.0 <https://github.com/dbmi-bgm/cgap-portal/pull/576>`_

9.0.0
=====

`PR 610  May Security Update <https://github.com/dbmi-bgm/cgap-portal/pull/610>`_
`PR 602  May Security Update <https://github.com/dbmi-bgm/cgap-portal/pull/602>`_

* Allow ``cgap-portal`` to run in both Python 3.7 and Python 3.8, with intent it be run in 3.8 in production.
  * Adjust ``pyproject.toml``
  * Adjust ``Dockerfile``
  * Adjust github workflow ``main.yml``
* Add ``auth0.options`` in registry settings.
* ``nginx`` change: Fall back to next server on 502 in case of out of memory
* Let ``supervisord`` start service for workers in ``entrypoint_portal.sh``
* In ``base.ini``:

  * lower ``rss_limit`` from 500MB to 450MB
  * remove ``rss_percent_limit``


8.10.0
======

`PR 605 Syntax makeover for clear-db-es-contents <https://github.com/dbmi-bgm/cgap-portal/pull/605>`_

* Adjustments to ``clear-db-es-contents`` to make arguments more intelligible and error messages more clear.

  * Instead of ``--env <envname>`` this wants you to supply
    ``--only-if-env <env>`` or ``--only-if-envs <env1>,<env2>,...``

  * Using ``--confirm`` and ``--no-confirm`` controls whether you are interactively queried for confirmation.
    The default is not to prompt if you provide ``--only-if-env`` or ``--only-if-envs``, and otherwise to prompt.

`PR 599 New Pedigree Submission Fields <https://github.com/dbmi-bgm/cgap-portal/pull/599>`_

* Handle upgrade from version 1 to version 2 of ``Individual``.
* Testing of the ``Individual`` upgrade.
* Updates to ``FamilyHistory`` doc.
* Miscellaneous detailed updates to ``submit.py``.
  (See `the PR <https://github.com/dbmi-bgm/cgap-portal/pull/599/files#diff-1dc4281734eec738e7416859045a7927e57021c4e102f1a9e8b53d4ba56c054d>`_
  for additional detail.)


8.9.5
=====

*version missing?*

8.9.4
=====

`PR 607: Add a CONTRIBUTING.rst <https://github.com/dbmi-bgm/cgap-portal/pull/607>`_

* Add file ``CONTRIBUTING.rst``.


8.9.3
=====

`PR 606 PedigreeViz parsing - try to handle subfamilies - skip/ignore relatives not present in jsonList. <https://github.com/dbmi-bgm/cgap-portal/pull/606>`_

* Attempt to skip relatives missing from ``Family.members``


8.9.2
=====

`PR 600 Remove Departed Admins <https://github.com/dbmi-bgm/cgap-portal/pull/600>`_

* Remove user inserts for Sarah Reiff and Phil Grayson from ``master-inserts``.
* Remove ``submitted_by``, etc. from ``VariantSample`` inserts in ``master-inserts``.

Dependabot changes (no version bump):

* `PR 603: Bump auth0-lock from 11.32.2 to 11.33.0 <https://github.com/dbmi-bgm/cgap-portal/pull/603>`_


Older Versions
==============

A record of older changes can be found
`in GitHub <https://github.com/dbmi-bgm/cgap-portal/pulls?q=is%3Apr+is%3Aclosed>`_.
To find the specific version numbers, see the ``version`` value in
the ``poetry.app`` section of ``pyproject.toml`` for the corresponding change, as in::

   [poetry.app]
   # Note: Various modules refer to this system as "encoded", not "cgap-portal".
   name = "encoded"
   version = "100.200.300"
   ...etc.

This would correspond with ``cgap-portal 100.200.300``.
