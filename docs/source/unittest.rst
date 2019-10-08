Testing
============

Python : what & where
---------------------


* ``test_schema`` : testing if mixins load from schema, and schema sytanctically correct
* ``test_type_<object>`` : test type sepcific stuff, minux embedding, calculated properties, update, etc..
* ``test_search`` : test effects of embedding and what not on search

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


Deep-Dive: Python Tests
^^^^^^^^^^^^^^^^^^^^^^^

Testing CGAP is done in a variety of ways, nearly all of which are similar to how Fourfront testing is done as well. It's first important to understand how PyTest works, as this is the framework we use for testing. See the PyTest `docs <https://docs.pytest.org/en/latest/contents.html>`_ .

In order to test CGAP several different setup steps are required. We make use of many different fixtures to build TestApp's, automatically construct data, post data to our test application, setup users etc. A breakdown of some of the fixtures is below. Many of these base fixtures live in `conftest.py` and other more specific fixtures live in individual test files where they are most relevant.

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

Keep in mind the importance of `conftest.py` - anything you need to do globally across the test suite should probably be done here.
