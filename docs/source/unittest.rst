Testing
============

Python : what & where
---------------------

Below is a bulleted list briefly describing what each test file/test file type is testing.

* ``data/`` : Contains inserts
* ``__init__.py`` : does nothing, just tells PyTest that this is where the tests are
* ``conftest.py`` : global configuration file for PyTest
* ``datafixtures.py`` : contains data fixtures (more on this below)
* ``test_access_key`` : tests access key creation and associated permissions
* ``test_aggregation`` : currently disabled, needs refactoring
* ``test_auth0`` : tests routes/methods related to auth0
* ``test_authentication`` : verifies CGAP authentication policies are functioning
* ``test_batch_download`` : currently disabled, needs refactoring
* ``test_clear_es_db_contents`` : tests that we are able to clear es
* ``test_create_mapping`` : tests creating mapping for all items defined in ``encoded.commands.create_mapping_on_deploy``
* ``test_download`` : tests that we can post an attachment and download it
* ``test_edw_hash`` : tests encrypting some strings with EDWHash
* ``test_embedding`` : tests that data store objects properly resolve their embedded fields
* ``test_fixtures`` : contains a few additional testing fixtures
* ``test_graph`` : tests that we can resolve dot/svg graphs
* ``test_higlass`` : currently disabled as it has not yet been configured on CGAP
* ``test_indexing`` : tests that we are able to successfully interact with elasticsearch using our data model
* ``test_key`` : tests that we can do various things with keys
* ``test_link`` : tests that we are able to properly update links within items
* ``test_load_access_key`` : tests that we are able to generate access keys based on a given env
* ``test_loadxl`` : tests that we can successfully load data and appropriate errors are thrown if not
* ``test_owltools`` : tests specific functionality of owltools
* ``test_permissions`` : tests the overall permissions hierarchy on CGAP - needs improvements
* ``test_post_put_patch`` : tests various behavior involving posting/patching data
* ``test_schema`` : testing if mixins load from schema, and schema syntactically correct
* ``test_search`` : test effects of embedding and what not on search
* ``test_server_defaults`` : sanity checks some aspects of our server configuration
* ``test_static_patch`` : tests our static page infrastructure functions
* ``test_type_<object>`` : test type specific stuff, minus embedding, calculated properties, update, etc...
* ``test_validation_errors`` : currently disabled, needs refactor
* ``test_views`` : tests many of the routes with different permissions on the application
* ``testing_views.py`` : various data/fixtures needed to run other tests

Deep-Dive: Python Tests
^^^^^^^^^^^^^^^^^^^^^^^

Testing CGAP is done in a variety of ways, nearly all of which are similar to how Fourfront testing is done as well. It's first important to understand how PyTest works, as this is the framework we use for testing. See the PyTest `docs <https://docs.pytest.org/en/latest/contents.html>`_ .

In order to test CGAP several different setup steps are required. We make use of many different fixtures to build TestApp's, automatically construct data, post data to our test application, setup users etc. A breakdown of some of the fixtures is below. Many of these base fixtures live in ``conftest.py`` and other more specific fixtures live in individual test files where they are most relevant.

.. code-block:: python

  # The following three fixtures define TestApp's in different states, most useful
  # when testing user permissions. Depending on which one you use, the types of
  # actions you can perform should be different, and thus PyTest leverages these
  # fixtures to test that behavior

  @fixture(scope="module")
  def testapp(app):
      '''TestApp with JSON accept header.
      '''
      from webtest import TestApp
      environ = {
          'HTTP_ACCEPT': 'application/json',
          'REMOTE_USER': 'TEST',
      }
      return TestApp(app, environ)


  @fixture
  def anontestapp(app):
      '''TestApp with JSON accept header.
      '''
      from webtest import TestApp
      environ = {
          'HTTP_ACCEPT': 'application/json',
      }
      return TestApp(app, environ)


  @fixture
  def authenticated_testapp(app):
      '''TestApp with JSON accept header for non-admin user.
      '''
      from webtest import TestApp
      environ = {
          'HTTP_ACCEPT': 'application/json',
          'REMOTE_USER': 'TEST_AUTHENTICATED',
      }
      return TestApp(app, environ)

In addition to infrastructural fixtures, there are also data fixtures. Nearly all of these are defined in `datafixtures.py`. Some examples with explanation are below.

.. code-block:: python

  # The below two fixtures create and post 'project' and 'institution' data to
  # the normal 'testapp' as defined above. Much of the data processed by CGAP
  # requires both project and institution tags, so these two fixtures are used
  # often throughout the test code.

  @pytest.fixture
  def project(testapp):
      item = {
          'name': 'encode-project',
          'title': 'ENCODE Project',
          'viewing_group': '4DN'
      }
      return testapp.post_json('/project', item).json['@graph'][0]

  @pytest.fixture
  def institution(testapp):
      item = {
          'name': 'encode-institution',
          'title': 'ENCODE Institution'
      }
      return testapp.post_json('/institution', item).json['@graph'][0]

  # ...
  # There are additional data fixtures as well that are more specific to certain
  # data types. They are most often used when testing a specific data type we have
  # defined, such as 'individual'. Two example data fixtures for this type that
  # don't actually post the data are below.

  @pytest.fixture
  def MIndividual():
      return {
          'project': 'encode-project',
          'institution': 'encode-institution',
          'sex': 'M'
      }

  @pytest.fixture
  def WIndividual():
      return {
          'project': 'encode-project',
          'institution': 'encode-institution',
          'sex': 'F'
      }

  # The below example test utilizes several of the above fixtures to ensure that
  # posting an individual on the normal testapp works as expected. The arguments
  # to the test are the fixtures being used. The test not only checks that the
  # object creation succeeds but also checks that the calculated property 'display_title'
  # is present as well.

  def test_post_valid_individuals(testapp, project, institution, MIndividual, WIndividual):
      """ Posts valid individuals """
      testapp.post_json('/individual', MIndividual, status=201)
      res = testapp.post_json('/individual', WIndividual, status=201)
      assert 'display_title' in res

Tips and Tricks
^^^^^^^^^^^^^^^

* Don't underestimate the importance of ``conftest.py`` - anything you need to do globally across the test suite should probably be done here.
* The easiest way to work with test inserts is to add them into ``encoded.tests.data.workbook-inserts`` and specify the ``workbook`` fixture in your test.
* ``import pdb; pdb.set_trace()`` is your friend! But not if you're debugging logging - ``capfd`` bugs out if you use pdb and your log entries will be lost.
* ``bin/test -k <test name>`` and ``bin/test -k <test_file>`` work great to run tests or a module of tests in isolation. Sometimes behavior is different.


JavaScript
----------

Unit tests in JavaScript are performed with `\ **Jest** <https://facebook.github.io/jest/>`_\ , and initialized via ``npm test <testfilenameprefix>`` where testfilenameprefix is the first part (before ``.js``\ ) of the filename located in ``src/encoded/static/components/__tests__``. Run ``npm test`` without arguments to run all tests. Execution of all tests is also automatically triggered in Travis upon committing or pull requesting to the GitHub repository.

Guidelines
^^^^^^^^^^


* Look at current tests to get understanding of how they work.
* Check out the `\ **Jest** API <https://facebook.github.io/jest/docs/api.html>`_.
* Check out the `React **TestUtils** documentation <https://facebook.github.io/react/docs/test-utils.html>`_.
* If you need to test AJAX calls, utilize `\ **Sinon** <http://sinonjs.org>`_ to create a `\ **fake server** <http://sinonjs.org/docs/#fakeServer>`_ inside testing scripts, which will also patch XMLHttpRequest to work within tests. For example, in a ``.../__tests__/`` file, can have something resembling the following:

.. code-block:: javascript


  sinon = require('sinon');
  var server = sinon.fakeServer.create();

  // Setup dummy server response(s)
  server.respondWith(
    "PATCH",                                      // Method
    context['@id'],                               // Endpoint / URL
    [
        200,                                      // Status code
        { "Content-Type" : "application/json" },  // Headers
        '{ "status" : "success" }'                // Raw data returned
    ]
  );

  // Body of test
  doSomeFunctionsHereWhichSendAJAXCalls();          // Any code with AJAX/XHR calls.
  server.respond();                                 // Respond to any AJAX requests currently in queue.
  expect(myNewValue).toBe(whatMyNewValueShouldBe);  // Assert state in Jest that may have changed in response to or after AJAX call completion.

  doSomeMoreFunctionsWithAJAX();
  server.respond();
  expect(myOtherNewValue).toBe(whatMyOtherNewValueShouldBe);

  server.restore();                                 // When done, restore/unpatch the XMLHttpRequest object.
