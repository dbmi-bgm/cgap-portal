========================
 CGAP PORTAL (HMS-BGM)
========================

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

Be warned that features are under active development and may not be stable! Visit the production deployment for the best experience. For installation and more information on getting started, see our `documentation page <https://cgap-portal.readthedocs.io/en/latest/index.html>`_.

For information on how to run CGAP with Docker, see `here. <./docs/source/docker-local.rst>`_

For information on CGAP-Docker in production, see `here. <./docs/source/docker-production.rst>`_

Navigating this Repository
^^^^^^^^^^^^^^^^^^^^^^^^^^
    * .github/workflows/ contains Github Action Workflows
    * bin/ contains the few remaining executables
    * deploy/docker contains Docker setups (see docker-compose.yml)
    * docs/ contains documentation
    * scripts/ contains misc scripts
    * src/ where the code is