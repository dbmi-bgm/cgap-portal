========================
 CGAP PORTAL (HMS-BGM)
========================

.. image:: https://github.com/dbmi-bgm/cgap-portal/actions/workflows/main.yml/badge.svg

.. image:: https://readthedocs.org/projects/cgap-portal/badge/?version=latest


Welcome to CGAP! We are a team of scientists, clinicians, and developers who aim to streamline the clinical genetics workflow. The following locations are different deployments of our data portal:

* `Production  <http://cgap.hms.harvard.edu/>`_ for the stable release
* `cgapdev <http://fourfront-cgapdev.9wzadzju3p.us-east-1.elasticbeanstalk.com/>`_ for data model and back-end development
* `cgaptest <http://fourfront-cgaptest.9wzadzju3p.us-east-1.elasticbeanstalk.com/>`_ for front-end and UX development
* `cgapwolf <http://fourfront-cgapwolf.9wzadzju3p.us-east-1.elasticbeanstalk.com/>`_ for workflow development

Be warned that features are under active development and may not be stable! Visit the production deployment for the best experience. For installation and more information on getting started, see our `documentation page <https://cgap-portal.readthedocs.io/en/latest/index.html>`_.

Note that at this time, CGAP is operating in hybrid model where some environments are deployed to AWS ElasticBeanstalk and others are deployed to AWS Elastic Container Service. The BS deployments are considered legacy and the ECS deployments 

For information on how to run CGAP with Docker, see `here. <./docs/source/docker-local.rst>`_

For information on CGAP-Docker in production, see `here. <./docs/source/docker-production.rst>`_

Navigating this Repository
^^^^^^^^^^^^^^^^^^^^^^^^^^

Important directories/files are outlined below.

    * ``.github/workflows/`` contains Github Action Workflows
    * ``bin/`` contains the few remaining executables
    * ``deploy/docker`` contains containerization related scripts/configuration
    * ``docs/ contains`` documentation
    * ``scripts/`` contains misc scripts
    * ``src/encoded/`` where the code is
    * ``.dockerignore`` specifies paths ignored by the Dockerfile
    * ``Dockerfile`` contains the Docker build instructions for the cgap-portal - see ``docker-production.rst``
    * ``Makefile`` contains macros for common build operations - see ``make info``
    * ``docker-compose.yml`` builds the new local deployment - see ``docker-local.rst``
    * ``package.json`` and ``package-lock.json`` specify the front-end dependencies
    * ``pyproject.toml`` and ``poetry.lock`` specify the back-end dependencies
    * ``setup_eb.py`` performs final installation setup

Navigating src/encoded/
^^^^^^^^^^^^^^^^^^^^^^^

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
    * ``upgrade/`` contains collection schema version upgraders - are not functioning as intended currently
