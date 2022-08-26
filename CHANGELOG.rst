===========
cgap-portal
===========

----------
Change Log
----------


10.2.2
======

PR xxx: Add CHANGELOG.rst

* Add CHANGELOG.rst


10.2.1
======

`PR 632: Repair GA <https://github.com/dbmi-bgm/cgap-portal/pull/632>`_

* Adjust buckets use in ``test.ini``, ``development.ini``, the docker ``.ini`` files,
  and ``src/encoded/tests/conftest_settings.py`` to be buckets from ``cgap-devtest`` account.
* Update access creds for ``cgap-devtest``
* Change remote ES URL in ``Makefile`` and GA workflows.
* Add a user record for David Michaels in master-inserts.






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
