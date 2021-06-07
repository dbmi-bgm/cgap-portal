==================
CGAP Documentation
==================

.. image:: https://github.com/dbmi-bgm/cgap-portal/actions/workflows/main.yml/badge.svg

.. image:: https://readthedocs.org/projects/cgap-portal/badge/?version=latest


Welcome to CGAP! We are a team of scientists, clinicians, and developers who aim to streamline the clinical genetics workflow. The following locations are different deployments of our data portal:

* `Production  <http://cgap.hms.harvard.edu/>`_ for the stable release
* `cgapdev <http://fourfront-cgapdev.9wzadzju3p.us-east-1.elasticbeanstalk.com/>`_ for data model and back-end development
* `cgaptest <http://fourfront-cgaptest.9wzadzju3p.us-east-1.elasticbeanstalk.com/>`_ for front-end and UX development
* `cgapwolf <http://fourfront-cgapwolf.9wzadzju3p.us-east-1.elasticbeanstalk.com/>`_ for workflow development

Be warned that features are under active development and may not be stable! Visit the production deployment for the best experience. To get started, read the following documentation on the infrastructure and how to work with the data model:

*Infrastructure*

  .. toctree::
    :titlesonly:

    local_installation
    infrastructure_overview
    dataflow_overview
    ingestion
    docker-local
    docker-production

*Data Model*

  .. toctree::
    :titlesonly:

    updating_items_from_ontologies
