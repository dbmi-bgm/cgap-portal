.. CGAP-Portal documentation master file, created by
   sphinx-quickstart on Tue Oct  8 11:23:43 2019.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

CGAP Documentation
=======================================

.. image:: https://travis-ci.org/dbmi-bgm/cgap-portal.svg?branch=master
   :target: https://travis-ci.org/dbmi-bgm/cgap-portal

|Coverage|_

.. |Coverage| image:: https://coveralls.io/repos/github/4dn-dcic/fourfront/badge.svg?branch=master
.. _Coverage: https://coveralls.io/github/4dn-dcic/fourfront?branch=master

|Quality|_

.. |Quality| image:: https://api.codacy.com/project/badge/Grade/f5fc54006b4740b5800e83eb2aeeeb43
.. _Quality: https://www.codacy.com/app/4dn/fourfront?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=4dn-dcic/fourfront&amp;utm_campaign=Badge_Grade


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

*Data Model*

  .. toctree::
    :titlesonly:

    updating_items_from_ontologies
