.. CGAP-Portal documentation master file, created by
   sphinx-quickstart on Tue Oct  8 11:23:43 2019.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to CGAP-Portal's documentation!
=======================================

.. toctree::
   :maxdepth: 2
   :caption: Contents:


This is a fork from ENCODE-DCC/encoded . We are working to modularize the project and adapted to our needs for the 4D Nucleome project.

Fourfront is known to work with Python 3.6.x and will not work with Python 3.7 or greater. If part of the 4DN team, it is recommended to use Python 3.4.3, since that's what is running on our servers. It is best practice to create a fresh Python virtualenv using one of these versions before proceeding to the following steps.


Installing/Running
==================

Step 0: Obtain AWS keys. These will need to added to your environment variables or through the AWS CLI (installed later in this process).

Step 1: Verify that homebrew is working properly:

``$ brew doctor
``
Step 2: Install or update dependencies:

``$ brew install libevent libmagic libxml2 libxslt openssl postgresql graphviz nginx python3``
``$ brew install freetype libjpeg libtiff littlecms webp  # Required by Pillow``
``$ brew cask install homebrew/cask-versions/adoptopenjdk8``
``$ brew tap homebrew/versions``
``$ brew install elasticsearch@5.6 node@10
``
You may need to link the brew-installed elasticsearch:

``$ brew link --force elasticsearch@5.6
``
If you need to update dependencies:

``$ brew update``
``$ brew upgrade``
``$ rm -rf encoded/eggs
``
Step 3: Run buildout:

``$ pip install -U zc.buildout setuptools``
``$ buildout bootstrap --buildout-version 2.9.5 --setuptools-version 36.6.0``
``$ bin/buildout``

NOTE:
If you have issues with postgres or the python interface to it (psycogpg2) you probably need to install postgresql
via homebrew (as above)
If you have issues with Pillow you may need to install new xcode command line tools:
- First update Xcode from AppStore (reboot)
``$ xcode-select --install
``
If you wish to completely rebuild the application, or have updated dependencies:
``$ make clean
``

Then goto Step 3.

Step 4: Start the application locally

In one terminal startup the database servers and nginx proxy with:

``$ bin/dev-servers development.ini --app-name app --clear --init --load
``
This will first clear any existing data in /tmp/encoded. Then postgres and elasticsearch servers will be initiated within /tmp/encoded. An nginx proxy running on port 8000 will be started. The servers are started, and finally the test set will be loaded.

In a second terminal, run the app with:

``$ bin/pserve development.ini
``
Indexing will then proceed in a background thread similar to the production setup.

Running the app with the --reload flag will cause the app to restart when changes to the Python source files are detected:

``$ bin/pserve development.ini --reload
``
If doing this, it is highly recommended to set the following environment variable to override the default file monitor used. The default monitor on Unix systems is watchman, which can cause problems due too tracking too many files and degrade performance. Use the following environment variable:

``$ HUPPER_DEFAULT_MONITOR=hupper.polling.PollingFileMonitor
``
Browse to the interface at http://localhost:8000/.


Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`
