Local Installation
==================

The following instructions are for running a CGAP deployment with macOS and homebrew.

CGAP is known to work with Python 3.6.x and will not work with Python 3.7 or greater. If part of the HMS team, it is recommended to use Python 3.4.3, since that's what is running on our servers. It is best practice to create a fresh Python virtualenv using one of these versions before proceeding to the following steps.

* Step 0: Obtain AWS keys. These will need to added to your environment variables or through the AWS CLI (installed later in this process).

* Step 1: Verify that homebrew is working properly::

   $ brew doctor


* Step 2: Install or update dependencies::

   $ brew install libevent libmagic libxml2 libxslt openssl postgresql graphviz nginx python3
   $ brew install freetype libjpeg libtiff littlecms webp  # Required by Pillow
   $ brew cask install homebrew/cask-versions/adoptopenjdk8
   $ brew tap homebrew/versions
   $ brew install elasticsearch@6.8 node@10


You may need to link the brew-installed elasticsearch::

   $ brew link --force elasticsearch@6.8


If you need to update dependencies::

   $ brew update
   $ brew upgrade
   $ rm -rf encoded/eggs


* Step 3: Run make::

   $ make build

   NOTE:
   If you have issues with postgres or the python interface to it (psycogpg2) you
   probably need to install postgresql via homebrew (as above)
   If you have issues with Pillow you may need to install new xcode command line tools:
   - First update Xcode from AppStore (reboot)
   $ xcode-select --install



If you wish to completely rebuild the application, or have updated dependencies:
   $ make clean

   Then goto Step 3.

* Step 4: Start the application locally

In one terminal startup the database servers and nginx proxy with::

   $ make deploy1

This will first clear any existing data in /tmp/encoded.
Then postgres and elasticsearch servers will be initiated within /tmp/encoded.
An nginx proxy running on port 8000 will be started.
The servers are started, and finally the test set will be loaded.

In a second terminal, run the app with::

   $ make deploy2

Indexing will then proceed in a background thread similar to the production setup.

Running the app with the `--reload` flag will cause the app to restart when changes to the Python source files are detected::

   $ bin/pserve development.ini --reload

If doing this, it is highly recommended to set the following environment variable to override the default file monitor used. The default monitor on Unix systems is watchman, which can cause problems due too tracking too many files and degrade performance. Use the following environment variable::

   $ HUPPER_DEFAULT_MONITOR=hupper.polling.PollingFileMonitor

Browse to the interface at http://localhost:8000/.


Running tests
^^^^^^^^^^^^^

To run specific tests locally::

   $ bin/test -k test_name

To run with a debugger::

   $ bin/test --pdb

Specific tests to run locally for schema changes::

   $ bin/test -k test_load_workbook
   $ bin/test -k test_edw_sync

Run the Pyramid tests with::

   $ bin/test

Note: to run against chrome you should first::

   $ brew install chromedriver

Run the Javascript tests with::

   $ npm test

Or if you need to supply command line arguments::

   $ ./node_modules/.bin/jest


Building Javascript
^^^^^^^^^^^^^^^^^^^

Our Javascript is written using ES6 and JSX, so needs to be compiled
using babel and webpack.

To build production-ready bundles, do::

   $ npm run build

(This is also done as part of running buildout.)

To build development bundles and continue updating them as you edit source files, run::

   $ npm run dev

The development bundles are not minified, to speed up building.


Notes on SASS/Compass
^^^^^^^^^^^^^^^^^^^^^

We use the `SASS <http://sass-lang.com/>`_ and `node-sass <https://github.com/sass/node-sass/>`_ CSS preprocessors.
The buildout installs the SASS utilities and compiles the CSS.
When changing the SCSS source files you must recompile the CSS using one of the following methods:

Compiling "on the fly"
^^^^^^^^^^^^^^^^^^^^^^

Node-sass can watch for any changes made to .scss files and instantly compile them to .css.
To start this, from the root of the project do::

   $ npm run watch-scss


Force compiling
^^^^^^^^^^^^^^^

::

   $ npm run build-scss


SublimeLinter
^^^^^^^^^^^^^

To setup SublimeLinter with Sublime Text 3, first install the linters::

   $ easy_install-2.7 flake8
   $ npm install -g jshint
   $ npm install -g jsxhint

After first setting up `Package Control`_ (follow install and usage instructions on site), use it to install the following packages in Sublime Text 3:

   * sublimelinter
   * sublimelinter-flake8
   * sublimelinter-jsxhint
   * jsx
   * sublimelinter-jshint

.. _`Package Control`: https://sublime.wbond.net/}}
