===========
cgap-portal
===========

----------
Change Log
----------

15.2.0
======

* Security updates - nginx + python


15.1.2
======
`PR 759: Bm feb2024 npm updates <https://github.com/dbmi-bgm/cgap-portal/pull/759>`_

* Merge still-relevant dependabot fixes
* Run `npm audit fix`
* Bump SPC to 0.1.76


15.1.1
======
* 2023-10-24
* Change references to Dana's email address (dvuzman@research.bwh.harvard.edu) in
  tests/data/inserts/institution.json to an existing one, since it was previously
  removed from tests/data/master-inserts/user.json; make deploy1 fails without this.


15.1.0
======
`PR 737: Add notes for Case items <https://github.com/dbmi-bgm/cgap-portal/pull/737>`_

* Adds functionality for POSTing and PATCHing Note Items linked to Case Items
* Reveals new "Notes" column in columnExtensionMap
* New "notes available" indicator in search headers column
* New textarea popup component (CaseNotesColumn.js) for text input


15.0.1
======
* Remove Dana's user from master inserts


15.0.0
======
* Upgrade to Python 3.11.
* Changed pyyaml version to ^6.0.1.
* Updated boto versions.
* Removed types/access_key.py and schemas/access_key.json as the ones in snovault are sufficient.
* Added generate-local-access-key script (from snovault) to pyproject.toml;
  orignally created for smaht-portal since early in development no way to
  create an access-key normally using the UI; but generall useful/convenient.
* Added generate-local-access-key script (defined in snovault).
* Added view-local-object script (defined in snovault).


14.3.1
======
`PR 753: Auth0 Symlink Bugfix <https://github.com/dbmi-bgm/cgap-portal/pull/753>`_

* Fix broken auth0-lock when symlinking SPC on local deployment


14.3.0
======
`PR 746: Bm node18 upgrade <https://github.com/dbmi-bgm/cgap-portal/pull/746>`_

* Update Docker's MakeFile to use Node version 18.17.0
* Update Github workflows to use Node version 18.17.0


14.2.3
======

* Update README.rst


14.2.2
======
`PR 741: Style updates for cgap-portal item-pages <https://github.com/dbmi-bgm/cgap-portal/pull/741>`_

* Fixed bug occurring in collapsible text box
* Changed green color for links to a less fluorescent green


14.2.1
======

* Fix in ``parse_exception`` in ``submit.py`` to catch/ignore additional/new
  error message from ``normalize_links`` in ``snovault/schema_validation.py``;
  manifested as error from ``submit-metadata``.


14.2.0
======

* Removes ``jsonschema_serialize_fork``, updating schema format version
* Refactors registration restriction to customization in ``project/authentication.py``


14.1.4
======

* Bump cohort browser version


14.1.3
======
`PR 732: Fix for LinkTo items in ItemDetailPane <https://github.com/dbmi-bgm/cgap-portal/pull/732>`_

* Updated python dependencies (pyyaml and cython)
* Bump SPC with conditional for nested object arrays (without corresponding childKeys values)
* Update SPC to 0.1.68b2


14.1.2
======
* Fix for Germline case button link (ensure it points to proband-only cases)


14.1.1
======
`PR 743: Purge permissions fix <https://github.com/dbmi-bgm/cgap-portal/pull/743>`_

* Update set_user_info_property to true to allow admins to purge items
* Bring in updated snovault to fix impersonation bug


14.1.0
======
`PR 739: Bm babel updates <https://github.com/dbmi-bgm/cgap-portal/pull/739>`_

* Add and update a bunch of babel-related dependencies to match Fourfront and SMaHT
* Update babel config to make use of new plugins


14.0.2
======
* Polyfill buffer
* Upgrade higlass-bigwig-datafetcher and gmod/tabix


14.0.1
======
* Update Higlass SV view config


14.0.0
======
* July 2023
* Migrating ingestion (et.al.) code to snovault.


13.5.2
======
`PR 707: Somatic CGAP UI V1 <https://github.com/dbmi-bgm/cgap-portal/pull/707>`_

* SomaticAnalysis, Case, Search Item View updates for Somatic
* Update SPC to 0.1.66
* Update higlass-general-vcf to 0.1.4


13.5.1
======

* Update nginx signing key and import method to fix Docker build


13.5.0
======
`PR 574: Webpack 5 Update <https://github.com/dbmi-bgm/cgap-portal/pull/574>`_

* Update Webpack to Webpack 5 (polyfills, ugh)
* Update HiGlass versions to resolve webpack related issues


13.4.1
======
* 2023-06-26
* Added user load to deployment task in deploy/docket/production/entrypoint_deployment.py,
  along with the current higlass_view_config load.


13.4.0
======
`PR 711: Generic QualityMetric <https://github.com/dbmi-bgm/cgap-portal/pull/711>`_

* Add new QualityMetricGeneric item
* Add File property for QualityMetricGeneric linkTos


13.3.2
======

* Remove inclusion of unused loremipsum library from pyproject.toml (C4-1036)


13.3.1
======

* Remove Victoria's user insert from master-inserts
* Add Cesar's user insert to master-inserts


13.3.0
======
`PR 712: Somatic analysis updates <https://github.com/dbmi-bgm/cgap-portal/pull/712>`_

* Add Individual linkTo on SomaticAnalysis schema
* Add preservation method to Sample schema
* Add primary disorders calcprop for Individual item
* Add Individual embeds to SomaticAnalysis item
* Update inserts for changes above


13.2.1
======
`PR 714: Cohort browser updates <https://github.com/dbmi-bgm/cgap-portal/pull/714>`_

* Bump ``higlass-cohort`` version
* Add ``blob:`` to ``script-src`` CSP
* Switch to presigned links everywhere for the Cohort browser


13.2.0
======

* Refactored `IngestionListener.run` in `ingestion_listener.py` to use the
  new `@ingestion_message_handler` decorator functions; specific message handling
  code now in `ingestion_message_handler_default.py` and `ingestion_message_handler_vcf.py`.
* Updated poetry (from 1.1.15) to 1.2.2 (in Makefile and Dockerfile).
* Removed isodate and keepalive from pyproject.toml.
* Added special build steps to workaround issues on Mac M1.


13.2.0
======
`PR 710: Submitted file lifecycle policy <https://github.com/dbmi-bgm/cgap-portal/pull/710>`_

* Add lifecycle policy to submitted files on submission


13.1.2
======
`PR: 709: Sort alphabetically phenotypic features <https://github.com/dbmi-bgm/cgap-portal/pull/709>`_

* Sorts (family) phenotypic features before rendering via CaseStats


13.1.1
======
`PR: 706: Improve health page spc + add higlass ver <https://github.com/dbmi-bgm/cgap-portal/pull/706>`_

* Pull and compare SPC versions from package-lock.json's dependencies and packages objects in Health page
* Display information on discrepancies/mismatches
* Add higlass core (dependencies) version to health page


13.1.0
======
`PR 701: Not facets <https://github.com/dbmi-bgm/cgap-portal/pull/701>`_

* Upgrade SPC to v0.1.63
* Add a new folder for storing FontAwesome v6 icons & a couple of icons for not facets
* Update filter blocks/sets to show "excluded" fields
* Some CGAP-specific styling for not facets


13.0.0
======
`PR 703: Somatic data model <https://github.com/dbmi-bgm/cgap-portal/pull/703>`_

* Add SomaticAnalysis item
* Add Analysis abstract collection for SomaticAnalysis and CohortAnalysis
* Remove Cohort item
* Add tissue_type property to Sample


12.10.3
=======

* Backport pytest 7.2 support from Fourfront


12.10.2
=======

* Upgrade to ``poetry 1.3.2``

* Syntactically revamp the organization of the various ``Makefile`` targets related to testing,
  and associated workflows.

* Change the indexing tests in ``test_indexing.py`` to be labeled ``pytest.mark.es``
  and use that to make sure these run separately.

* Import and use from beta snovault various kinds of useful tools like ``index_n_items_for_testing``
  and ``make_es_count_checker``.


12.10.1
=======
`PR 702: VEP QC metrics fix <https://github.com/dbmi-bgm/cgap-portal/pull/702>`_

* Fix VEP-annotated VCF recognition for updated SNV pipelines (v1.1.0)


12.10.0
=======
`PR 700: SV complex relationship analysis <https://github.com/dbmi-bgm/cgap-portal/pull/700>`_

* Add complex relationship analysis facet for StructuralVariantSamples
* Add samplegeno_role to StructuralVariantSample schema
* Reorder genotype-related facets for StructuralVariantSamples to match VariantSamples


12.9.0
======
`PR 699: Improved cohort browser + Higlass version bump <https://github.com/dbmi-bgm/cgap-portal/pull/699>`_

* Improved cohort browser
* Upgrade of Higlass to 1.12.2


12.8.7
======
`PR 698: More FASTQ paired-end options <https://github.com/dbmi-bgm/cgap-portal/pull/698>`_

* Allow dashes as separators for paired-end read information in FASTQ names


12.8.6
======
`PR 697: Bch case drawer <https://github.com/dbmi-bgm/cgap-portal/pull/697>`_

* Allows case information to be shown/hidden via a toggle
* Default state is dependent upon tab selected (dotPath); accessioning tab will load case info open, other tabs will keep it closed on load
* Add e.stopPropagation prop to the copyWrrapper, so the copy accession button doesn't trigger open/closing (requires an SPC update)
* Create a utility file for storing reusable custom React hooks (+ move pre-existing ones there)


12.8.5
======
`PR 694: Reload login box after logging out <https://github.com/dbmi-bgm/cgap-portal/pull/694>`_

* Update SPC to newest release [0.1.60](https://github.com/4dn-dcic/shared-portal-components/releases/tag/0.1.60)
* This release enables UI to use custom auth0 configurations accessed via `/auth0_config` endpoint
* Note: `auth0Options` may still be passed to `<LoginController>` but only values for keys not returned by `/auth0_config` are used as fallback
* Fix logout auth0 lock related bug


12.8.4
======

* Add a landing page for the infrastructure repository to Readthedocs


12.8.3
======

`PR 684: QC + tooltip updates <https://github.com/dbmi-bgm/cgap-portal/pull/684>`_

* Decrease WES Ti/Tv lower bounds for warning/failure
* Add coverage tooltip to QC report
* Minor updates to variant facet tooltips


12.8.2
======

* Fix `Auth0AllowedConnections` for local deploy usage


12.8.1
======

`PR 689: Save filterset btn updates <https://github.com/dbmi-bgm/cgap-portal/pull/689>`_

* Add a new Case Preset button near the list of preset (+ update wording, tooltips, iconography)
* Update Cypress tests
* Update SPC to [0.1.59](https://github.com/4dn-dcic/shared-portal-components/releases/tag/0.1.59)


12.8.0
======

`PR 683: Auth0 Customization Support <https://github.com/dbmi-bgm/cgap-portal/pull/683>`_

* Allow configuration of Auth0Domain and Auth0AllowedConnections
* Set a bigger `large_client_header_buffers` so we can tolerate a larger cookie package


12.7.1
======

`PR 688: Rename CGAP <https://github.com/dbmi-bgm/cgap-portal/pull/688>`_

* Update "Clinical Genome Analysis Platform" to "Computational Genome Analysis Platform".


12.7.0
======

`PR 681: SNV mapping quality <https://github.com/dbmi-bgm/cgap-portal/pull/681>`_

* Add mapping quality to VariantSample schema


12.6.0
======

`PR 676: End of year npm updates <https://github.com/dbmi-bgm/cgap-portal/pull/676>`_

* Update higlass dependencies to latest (some beta) realeases to resolve security issues
* Update SPC to latest release: v0.1.58


12.5.0
======

`PR 677: Sample tag submission <https://github.com/dbmi-bgm/cgap-portal/pull/677>`_

* Enable sample tag submission via accessioning spreadsheet


12.4.0
======

`PR 680: Staggered Indexing <https://github.com/dbmi-bgm/cgap-portal/pull/680>`_

* Reindex by type support
* Allow more utils versions


12.3.1
======

`PR 679: Fix video tutorial link <https://github.com/dbmi-bgm/cgap-portal/pull/679>`_

* Update "Video Tutorials" link on portal sign in page to go to Youtube channel


12.3.0
======

`PR 660: File variant type submission <https://github.com/dbmi-bgm/cgap-portal/pull/660>`_

* Allow variant type submission for files during case accessioning


12.2.0
======

`PR 666: Quality Control Updates <https://github.com/dbmi-bgm/cgap-portal/pull/666>`_

* Add SampleProcessing calculated property to track QCs for each Sample
* Add Case calculated property to record QC flag counts + overall flag
* Update Bioinformatics tab QC table to display QCs for all Samples
* Add Case column + facet to view and filter flag results


12.1.0
======

`PR 674: Add social links + youtube embed component <https://github.com/dbmi-bgm/cgap-portal/pull/674>`_

* Add new "Video Tutorials" external link to the help menu (goes to the YouTube channel)
* Add GitHub and YouTube social icon links to the footer
* Create a new component for embedding YouTube videos
* Adjust content security policy (Will already approved these edits) to allow pulling videos and thumbnail images from YouTube directly
* Add `YoutubeVideoEmbed` component as a "placeholder" for use in JSX static sections
* Includes changes from [Victoria's PR] (https://github.com/dbmi-bgm/cgap-portal/pull/675) - Update static sections to use JSX, update master inserts to use new JSX files


12.0.0
======

* ElasticSearch 7 support
* SQLAlchemy 1.4 support
* Cascading library updates to support the above
* B-Tree index on sid column to optimize indexing
* Fixes to test segmentation to improve overall test runtime and reliability
* Remove support for Python 3.7
* Upgrade workflow version 7 -> version 8, supporting array of strings for EC2 instance type
* Provision custom inserts function, allowing admin users to be configured from initial load in the GAC


11.3.3
======

`PR 672: Embedded Youtube videos <https://github.com/dbmi-bgm/cgap-portal/pull/672>`_

* Embedded YouTube tutorial videos to static help pages


11.3.2
======

`PR 671: FASTQ submission paired end <https://github.com/dbmi-bgm/cgap-portal/pull/671>`_

* Add FASTQ paired-end property during file submission


11.3.1
======

`PR 669: File Paired-end <https://github.com/dbmi-bgm/cgap-portal/pull/669>`_

* Place paired-end property on abstract File item so available on all child classes


11.3.0
======

`PR 663: Cohort browser <https://github.com/dbmi-bgm/cgap-portal/pull/663>`_

* Add cohort browser and statistical analysis table


11.2.0
======

`PR 657: Pedigree diseases <https://github.com/dbmi-bgm/cgap-portal/pull/657>`_

* Add support for disorders to the pedigree visualization


11.1.0
======

`PR 633: Vs cypress test inserts  <https://github.com/dbmi-bgm/cgap-portal/pull/633>`_

* Adds set of inserts for automated Cypress integration tests for UI
* Includes folder of Python scripts used to create these inserts


11.0.3
======

`PR 638: MetaWorkflowRun - WorkflowViz <https://github.com/dbmi-bgm/cgap-portal/pull/638>`_

* Add UI/workflow visualization support for MetaWorkflowRun items


11.0.2
======

`PR 656: PEP8 fixes so that make test-static can use make lint <https://github.com/dbmi-bgm/cgap-portal/pull/656>`_

Lots of changes to satisfy PEP8, including some changes that may well be small bug fixes because existing
code could not have worked. More specifically...

* Renamed (disabled) some files in preparation for their later removal:

  * ``.ebextensions`` to ``.ebextensions.DISABLED``
  * Various files in ``deploy/`` that seemed to have no callers:

    * ``deploy/last_git_commit.py`` to ``deploy/last_git_commit.py.DISABLED``
    * ``deploy/set_beanstalk_config.py`` to ``deploy/set_beanstalk_config.py.DISABLED``
    * ``deploy/travis_after_all.py`` to ``deploy/travis_after_all.py.DISABLED``

* Make ``make lint`` actually invoke ``flake8`` instead of just saying it's coming soon.

* Add ``make static-test`` and appropriate GA workflow for that.

  * This required adjusting some fixtures to be conditional on environment variables
    similarly to what I did with ``snovault``.

* ``pyproject.toml`` uses ``dcicutils 5.2.0`` for new static check support, and ``poetry.lock`` is updated.

* Edits that were not just syntactic include:

  * Some unused variables in ``test_search_ngram`` in ``src/encoded/tests/test_search.py``
    seemed to be tests of the wrong variable value, so I fixed a test (which fortunately was still passing).

  * Removed ``build_xlsx_spreadsheet`` in ``batch_download_utils.py``. It does not appear to have any callers,
    and it has some problems that were not obvious how to fix. In particular there's an unused variable
    at the end, but I wonder if it doesn't want to return some value.

  * Commented out the content of ``src/encoded/commands/extract_test_data.py``,
    which had numerous problems in the code (undefined functions, etc.)
    and couldn't possibly have worked. (Probably unused?)

  * Rewrote some code in ``src/encoded/commands/generate_items_from_owl.py``
    to call ``dcicutils.command_utils.y_or_n`` rather than using lower level primitives.
    Adjusted some prompts in the process.

  * In ``src/encoded/commands/load_items.py``, rewrote some functions to require keyword-argument-calling
    because I don't think there are non-adjusted callers but I wanted to make sure that my addition of
    a ``logger`` argument to make some undefined varaibles work again was not going to cause a problem.
    I doubt anyone was calling this or they'd have complained about the undefined variables,
    so probably this is all fine. (Probably we should do auth stuff differently here,
    but I didn't bother with that.)

  * PEP8 doesn't like assigning lambda expressions to variables.
    I mostly do not think it's right about that, but the one case where we were doing it
    needed to be rewritten for other reasons, and I'd already done that rewrite in ``snovault``,
    so I ported the fix from there.

  * Rewrote a few cases of ``print`` as ``PRINT``. Maybe some as logger calls, too.
    Added static checkers for stray print statements.
    There are still a lot of them that need review. For now I just have it issuing a warning,
    not an error, while we work through those.
    I wrote ticket `C4-929 <https://hms-dbmi.atlassian.net/browse/C4-929>`_ on this.

* Removed a lot of unused imports, and alphabetized/merged many imports.

  * In some cases the unused imports were removed, and in others where they were "harder to find" names,
    I just commented them out while we let things shake out to make sure I didn't make an error.
  * In some cases I added an ``ignorable`` declaration for things where I expected a later change
    to bring back the need for the import.
  * In some cases I added ``notice_pytest_fixtures`` because the use of the name as a fixture
    is not lexically observable and PyCharm is bad about understanding what's going on.

* Rewrote some ``'''...'''`` doc strings as ``"""..."""``.

* Reviewed unused variables.

  * Some were marked ignored.
  * Some were statements that could be removed entirely.
  * Some were side-effects where we could ignore return value and the left-hand side
    of the assignment could be removed.

* Adjusted whitespace in some expressions per PEP8.

* Removed some parentheses that PEP8 insisted were redundant.

  * Some of these were things like assert, which is not a function but was being "called" by doing ``assert(...)``.

    * Same with ``del(...)`` that isn't a function either.

* Rewrote some ``except:`` as ``except Exception:``.

* Updated some ``.format()`` calls to use f-strings.

* PEP8 doesn't like lowercase-l as a variable name because it looks like a digit-1 in some fonts,
  so I rewrote some uses of that variable (usually as ``lst`` instead,
  though in a few cases there were obviously better names).

* Rewrote some ``== True/False`` as ``is True/False`` in testing.


11.0.1
======

`PR 658: Enabled nested for samplegeno  <https://github.com/dbmi-bgm/cgap-portal/pull/658>`_

* Turn on nested mappings for samplegeno fields
* Add some facets for the associated fields


11.0.0
======

`PR 654: Cohort data model <https://github.com/dbmi-bgm/cgap-portal/pull/654>`_

* Breaking schema changes to Cohort item to use for case vs. control analysis
* Upgrader for Cohort v1 --> v2
* Creation of CohortAnalysis item
* Inserts updates for existing Cohort + addition of CohortAnalysis insert

10.5.0
======
`PR 628: In portal feedback UI <https://github.com/dbmi-bgm/cgap-portal/pull/628/>`_

* Adds a button to the navbar that opens up a mailto link with some useful information pre-populated
  for submitting jira tickets.


10.4.1
======

`PR 659: Submission bug fixes <https://github.com/dbmi-bgm/cgap-portal/pull/659>`_

* Minor refactoring of case submission code to fix bugs failing submissions
* Enforce file name conventions to match schema regex


10.4.0
======

`PR 650: Pipeline deployment schema changes <https://github.com/dbmi-bgm/cgap-portal/pull/650>`_

* Non-breaking schema changes to Workflow and Software items to facilitate pipeline
  deployment


10.3.7
======

`PR 655: Small administrative fixes <https://github.com/dbmi-bgm/cgap-portal/pull/655>`_

* Fix pyproject.toml to use released ``snovault ^6.0.8`` rather than a beta.
* Update ``poetry.lock`` to match.
* Adjust ``Makefile`` to still run static tests now that they're factored out.
* Small changes to repair recent changelogs and versions.


10.3.6
======

`PR 651: Add lifecycle_management_active to schema <https://github.com/dbmi-bgm/cgap-portal/pull/651>`_

* Add ``lifecycle_management_active`` to ``project`` schema and embed it into the ``file`` type
  so it can be searched for.


10.3.5.1
========

`PR 653: GA Static checks sans db fixtures and EnvUtils setup <https://github.com/dbmi-bgm/cgap-portal/pull/653>`_

A PR was merged at this point that had no actual version number bump. That PR did:

* Implements ``USE_SAMPLE_ENVUTILS`` to cause ``EnvUtils`` to be initialized from the sample (Acme) configuration.

* Uses ``USE_SAMPLE_ENVUTILS`` and (from ``snovault``) ``NO_SERVER_FIXTURES``
  in the GA ``Static Checks`` script to not have to put in complicated credentials and setup.


10.3.5
======

`PR 649: Adjustments to changelog handling <https://github.com/dbmi-bgm/cgap-portal/pull/649>`_

* Raise an error if change log inconsistent.


10.3.4
======

`PR 647: Small fixes 2022-09-16 <https://github.com/dbmi-bgm/cgap-portal/pull/647>`_

* Fix a broken test (``test_test_port``
  in ``src/encoded/tests/test_ingestion_listener.py``).

* Update to require at least snovault 6.0.6 to pick up blob storage fix.
  (Locked to include 6.0.7, but that upgrade's not required.)

* Repair a missing changelog entry for 10.3.2.


10.3.3
======

`PR 634: Vs fix broken links <https://github.com/dbmi-bgm/cgap-portal/pull/634>`_

* Fixed broken hyperlinks in static documentation pages, updating links as necessary


10.3.2
======

`PR 631: SV Confidence Pop-overs <https://github.com/dbmi-bgm/cgap-portal/pull/631>`_

* Add pop-over to SV confidence class facet with links to further documentation


10.3.1
======

`PR 642: Fix problems in development.init.template and test.ini.template <https://github.com/dbmi-bgm/cgap-portal/pull/642>`_

* Fix a bug in ``prepare-local-dev`` script (C4-907).
* Cosmetic changes to Dockerfile to bring in line with Fourfront.


10.3.0
======

`PR 637: Manage development.ini and test.ini outside of source control <https://github.com/dbmi-bgm/cgap-portal/pull/637>`_

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

**Special Notes for Developers**

This change should **not** affect production builds or GA. You should report problems if you see them.

This change might affect developers who are doing local testing
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
