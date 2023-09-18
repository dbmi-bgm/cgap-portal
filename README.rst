========================
 CGAP PORTAL (HMS-BGM)
========================

.. image:: https://github.com/dbmi-bgm/cgap-portal/actions/workflows/main.yml/badge.svg
   :target: https://github.com/dbmi-bgm/cgap-portal/actions
   :alt: Build Status

.. image:: https://coveralls.io/repos/github/dbmi-bgm/cgap-portal/badge.svg
    :target: https://coveralls.io/github/dbmi-bgm/cgap-portal
    :alt: Coverage Percentage

.. image:: https://readthedocs.org/projects/cgap-portal/badge/?version=latest
   :target: https://cgap-portal.readthedocs.io/en/latest/
   :alt: Documentation Status


Welcome to CGAP!
================

CGAP is the Computational Genome Analysis Platform.

We are a team of scientists, clinicians, and developers
who aim to streamline the clinical genetics workflow.

* For useful information about CGAP's features,
  see `the CGAP informational site <https://cgap.hms.harvard.edu>`_.

* CGAP is orchestrated technology capable of being easily deployed
  in hospital setting. Our flagship site is
  `CGAP-MGB <https://cgap-mgb.hms.harvard.edu">`_.

  For information on how to set your hospital up to use this technology,
  `contact us <mailto:cgap-support@hms-dbmi.atlassian.net>`_.

* CGAP is an open source system under continuous development.
  For documentation, see
  `the CGAP Portal page at ReadTheDocs
  <https://cgap-portal.readthedocs.io/en/latest/>`_.

* For information about governance and other policies, see
  `the CGAP Governance repository
  <https://github.com/dbmi-bgm/cgap-governance>`_.


Repository Structure
--------------------

These are some important files and directories you might want to be aware of:

* ``.dockerignore`` specifies paths ignored by the Dockerfile
* ``.github/workflows/`` contains Github Action Workflows
* ``bin/`` contains a few legacy scripts, though most are in ``scripts/``
* ``deploy/docker`` contains containerization related scripts/configuration
* ``docker-compose.yml`` builds the new local deployment (see ``docker-local.rst``)
* ``Dockerfile`` contains the Docker build instructions for the cgap-portal (see ``docker-production.rst``)
* ``docs/ contains`` documentation
* ``Makefile`` contains macros for common build operations (see ``make info``)
* ``package.json`` and ``package-lock.json`` specify the front-end dependencies
* ``pyproject.toml`` and ``poetry.lock`` specify the back-end dependencies
* ``scripts/`` contains misc scripts
* ``setup_eb.py`` performs final installation setup
* ``src/encoded/`` where the code is


Navigating core functionality (src/encoded/)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Top level files are modules that make up the core functionality of the back-end. Some modules differ greatly from or do
not even exist in fourfront. Directories are outlined below.

* ``annotations/`` contains mapping table and ingestion related metadata
* ``commands/`` contains Python commands that can be run on the system from the command line
* ``docs/`` contains ReadTheDocs documentation
* ``ingestion/`` contains ingestion related code, such as mapping table intake and VCF processing
* ``schemas/`` contains the metadata schemas
* ``search/`` contains the search/filter_set APIs
* ``static/`` contains front-end code
* ``tests/`` contains back-end unit tests and insert data
* ``types/`` contains metadata type definitions
* ``upgrade/`` contains collection schema version upgraders


Related Repositories
~~~~~~~~~~~~~~~~~~~~

Note that ``cgap-portal`` is bound on supporting functionality
in numerous libaries, but importantly:

* **dcicsnovault**
  [`pypi library <https://pypi.org/project/dcicsnovault/>`_]
  [`source repo <https://github.com/4dn-dcic/snovault>`_]

* **dcicutils**
  [`pypi library <https://pypi.org/project/dcicutils/>`_]
  [`source repo <https://github.com/4dn-dcic/utils>`_]
