==================
CGAP Documentation
==================

.. image:: https://github.com/dbmi-bgm/cgap-portal/actions/workflows/main.yml/badge.svg

.. image:: https://readthedocs.org/projects/cgap-portal/badge/?version=latest


Welcome to CGAP! We are a team of scientists, clinicians, and developers who aim to streamline the clinical genetics workflow. The following locations are different deployments of our data portal:

* `cgap-dbmi <https://cgap-dbmi.hms.harvard.edu/>`_ DBMI production account
* `cgap-training <https://cgap-training.hms.harvard.edu/>`_ demo account for potential users
* `cgap-devtest <https://cgap-devtest.hms.harvard.edu/>`_ general development/testing account
* `cgap-wolf <https://cgap-wolf.hms.harvard.edu/>`_ workflow development account

Be warned that features are under active development and may not be stable! Visit the demo account for the best experience. To get started, read the following documentation on the infrastructure and how to work with the data model:

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
