===========
cgap-portal
===========

----------
Change Log
----------


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

* Changes to buckets used for testing in `test.ini`.
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

* Solving the row tracking issue in `SpreadsheetProcessing` class within `src/encoded/submit.py`,
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


9.3.0.1
=======

`PR 621 Technical Review Follow-Up <https://github.com/dbmi-bgm/cgap-portal/pull/621>`_

**NOTE:** There was no version change in this PR merge, so officially it was still calling itself 9.3.0.

* UI Change: Separates Interpretation Selection functionality/checkbox into own column plus some minor styling + refactoring.


9.3.0
=====

`PR 617: Cypress v10 update + test fix <https://github.com/dbmi-bgm/cgap-portal/pull/617>`_

* Update to cypress 10.
* Fix for a couple of tests.


9.2.4
=====

`PR 619: Added self (V. Stevens) as user for local deployment <https://github.com/dbmi-bgm/cgap-portal/pull/619>`_

* Added a developer profile under src/encoded/tests/data/master-inserts/user.json


9.2.3.1
=======

`PR 620: July Security Update <https://github.com/dbmi-bgm/cgap-portal/pull/620>`_

**NOTE:** There was no version change in this PR merge, so officially it was still calling itself 9.2.3.

* Brings in snovault fixes for invalidation scope, updating tests as needed
* Updates libraries wherever possible


9.2.3
=====

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

...


8.10.0
======

`PR 605: Syntax makeover for clear-db-es-contents <https://github.com/dbmi-bgm/cgap-portal/pull/605>`_

* Adjustments to ``clear-db-es-contents`` to make arguments more intelligible and error messages more clear.

  * Instead of ``--env <envname>`` this wants you to supply
    ``--only-if-env <env>`` or ``--only-if-envs <env1>,<env2>,...``

  * Using ``--confirm`` and ``--no-confirm`` controls whether you are interactively queried for confirmation.
   The default is not to prompt if you provide ``--only-if-env`` or ``--only-if-envs``, and otherwise to prompt.

8.9.5
=====

...


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
