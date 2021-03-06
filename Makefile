SHELL=/bin/bash

clean:  # clear node modules, eggs, npm build stuff
	make clean-python-caches
	make clean-npm-caches

clean-python-caches:
	rm -rf src/*.egg-info/
	rm -rf eggs
	rm -rf develop
	rm -rf develop-eggs

clean-npm-caches:
	make clean-node-modules
	rm -rf .sass-cache
	rm -f src/encoded/static/css/*.css
	rm -f src/encoded/static/build/*.js
	rm -f src/encoded/static/build/*.html

clean-node-modules:
	rm -rf node_modules

aws-ip-ranges:
	curl -o aws-ip-ranges.json https://ip-ranges.amazonaws.com/ip-ranges.json

npm-setup-if-needed:  # sets up npm only if not already set up
	if [ ! -d "node_modules" ]; then make npm-setup; fi

npm-setup:  # runs all front-end setup
	npm ci
	npm run build | grep -v "node_modules\|\[built\]"
	npm run build-scss
	make aws-ip-ranges

moto-setup:  # optional moto setup that must be done separately
	pip install "moto[server]==1.3.7"

macpoetry-install:  # Same as 'poetry install' except that on OSX Catalina, an environment variable wrapper is needed
	bin/macpoetry-install

configure:  # does any pre-requisite installs
	pip install --upgrade pip==21.0.1
	pip install poetry==1.1.4  # poetry latest as of 1/25/2021 seemed to work but apparantly does not

build:  # builds
	make configure
	poetry install
	make build-after-poetry

macbuild:  # builds for Catalina
	make configure
	make macpoetry-install
	make build-after-poetry

rebuild:
	make clean  # Among other things, this assures 'make npm-setup' will run, but it also does other cleanup.
	make build

macrebuild:
	make clean  # Among other things, this assures 'make npm-setup' will run, but it also does other cleanup.
	make macbuild

build-full:  # rebuilds for Catalina, addressing zlib possibly being in an alternate location.
	make clean-node-modules  # This effectively assures that 'make npm-setup' will need to run.
	make build

macbuild-full:  # rebuilds for Catalina, addressing zlib possibly being in an alternate location.
	make clean-node-modules  # This effectively assures that 'make npm-setup' will need to run.
	make macbuild

build-after-poetry:  # continuation of build after poetry install
	make moto-setup
	make npm-setup-if-needed
	poetry run python setup_eb.py develop
	make fix-dist-info

fix-dist-info:
	@scripts/fix-dist-info

build-dev:  # same as build, but sets up locust as well
	make build
	make build-locust

macbuild-dev:  # same as macbuild, but sets up locust as well
	make macbuild
	make build-locust

build-locust:  # just pip installs locust - may cause instability
	pip install locust

download-genes: # grabs latest gene list from the below link, unzips and drops in correct place
	wget https://www.dropbox.com/s/s6ahfq0gdn99uu8/mvp_gene_datasource_v0.4.6.coding_gene_main_chrom.json.gz?dl=1
	mv mvp_gene_datasource_v0.4.6.coding_gene_main_chrom.json.gz\?dl\=1 gene_inserts_v0.4.6.json.gz
	gunzip gene_inserts_v0.4.6.json.gz
	mv gene_inserts_v0.4.6.json src/encoded/annotations/gene_inserts_v0.4.6.json

deploy1:  # starts postgres/ES locally and loads inserts, and also starts ingestion engine
	@DEBUGLOG=`pwd` SNOVAULT_DB_TEST_PORT=`grep 'sqlalchemy[.]url =' development.ini | sed -E 's|.*:([0-9]+)/.*|\1|'` dev-servers development.ini --app-name app --clear --init --load

deploy1a:  # starts postgres/ES locally and loads inserts, but does not start the ingestion engine
	@DEBUGLOG=`pwd` SNOVAULT_DB_TEST_PORT=`grep 'sqlalchemy[.]url =' development.ini | sed -E 's|.*:([0-9]+)/.*|\1|'` dev-servers development.ini --app-name app --clear --init --load --no_ingest

deploy1b:  # starts ingestion engine separately so it can be easily stopped and restarted for debugging in foreground
	@echo "Starting ingestion listener. Press ^C to exit." && DEBUGLOG=`pwd` SNOVAULT_DB_TEST_PORT=`grep 'sqlalchemy[.]url =' development.ini | sed -E 's|.*:([0-9]+)/.*|\1|'` poetry run ingestion-listener development.ini --app-name app

deploy2:  # spins up waittress to serve the application
	@DEBUGLOG=`pwd` SNOVAULT_DB_TEST_PORT=`grep 'sqlalchemy[.]url =' development.ini | sed -E 's|.*:([0-9]+)/.*|\1|'` pserve development.ini

deploy3:  # Uploads genes, consequences then ingests the VCF below
	poetry run ingest-vcf src/encoded/annotations/GAPFIAI7IZ9Y.reformat.altcounts.vcf dummy-accession hms-dbmi hms-dbmi development.ini --app-name app --post-variants --post-genes --post-conseq

psql-dev:  # starts psql with the url after 'sqlalchemy.url =' in development.ini
	@scripts/psql-start dev

psql-test:  # starts psql with a url constructed from data in 'ps aux'.
	@scripts/psql-start test

kibana-start:  # starts a dev version of kibana (default port)
	scripts/kibana-start

kibana-start-test:  # starts a test version of kibana (port chosen for active tests)
	scripts/kibana-start test

kibana-stop:
	scripts/kibana-stop

kill:  # kills back-end processes associated with the application. Use with care.
	pkill -f postgres &
	pkill -f elasticsearch &
	pkill -f moto_server &

clean-python:
	@echo -n "Are you sure? This will wipe all libraries installed on this virtualenv [y/N] " && read ans && [ $${ans:-N} = y ]
	pip uninstall encoded
	pip uninstall -y -r <(pip freeze)

test:
	make test-npm
	make test-unit

retest:
	poetry run python -m pytest -vv --last-failed

test-any:
	poetry run python -m pytest -vv --timeout=200

test-npm:
	poetry run python -m pytest -vv --timeout=200 -m "working and not manual and not integratedx and not performance and not broken and not broken_locally and not sloppy and not indexing"

test-unit:
	poetry run python -m pytest -vv --timeout=200 -m "working and not manual and not integratedx and not performance and not broken and not broken_locally and not sloppy and indexing"

test-performance:
	poetry run python -m pytest -vv --timeout=200 -m "working and not manual and not integratedx and performance and not broken and not broken_locally and not sloppy"

test-integrated:
	poetry run python -m pytest -vv --timeout=200 -m "working and not manual and (integrated or integratedx) and not performance and not broken and not broken_locally and not sloppy"

travis-test:  # We don't use this target on Travis/GA. We call each as separate jobs.
	make travis-test-npm
	make travis-test-unit

travis-test-npm:  # Note this only does the 'not indexing' tests
	poetry run python -m pytest -vv --instafail --force-flaky --max-runs=3 --timeout=400 -m "working and not manual and not integratedx and not performance and not broken and not broken_remotely and not sloppy and not indexing" --aws-auth --durations=20 --cov src/encoded --es search-cgap-testing-6-8-vo4mdkmkshvmyddc65ux7dtaou.us-east-1.es.amazonaws.com:443

travis-test-unit:  # Note this does the 'indexing' tests
	poetry run python -m pytest -vv --timeout=300 -m "working and not manual and not integratedx and not performance and not broken and not broken_remotely and not sloppy and indexing" --aws-auth --es search-cgap-testing-6-8-vo4mdkmkshvmyddc65ux7dtaou.us-east-1.es.amazonaws.com:443

update:  # updates dependencies
	poetry update

help:
	@make info

info:
	@: $(info Here are some 'make' options:)
	   $(info - Use 'make aws-ip-ranges' to download latest ip range information. Invoked automatically when needed.)
	   $(info - Use 'make build' (or 'make macbuild' on OSX Catalina) to build only application dependencies.)
	   $(info - Use 'make build-dev' (or 'make macbuild-dev' on OSX Catalina) to build all dependencies, even locust.)
	   $(info - Use 'make build-locust' to install locust. Do not do this unless you know what you are doing.)
	   $(info - Use 'make clean' to clear out (non-python) dependencies.)
	   $(info - Use 'make clean-python' to clear python virtualenv for fresh poetry install.)
	   $(info - Use 'make configure' to install poetry. You should not have to do this directly.)
	   $(info - Use 'make deploy1' to spin up postgres/elasticsearch and load inserts.)
	   $(info - Use 'make deploy2' to spin up the application server.)
	   $(info - Use 'make deploy3' to load variants and genes.)
	   $(info - Use 'make kibana-start' to start kibana on the default local ES port, and 'make kibana-stop' to stop it.)
	   $(info - Use 'make kibana-start-test' to start kibana on the port being used for active testing, and 'make kibana-stop' to stop it.)
	   $(info - Use 'make kill' to kill postgres and elasticsearch proccesses. Please use with care.)
	   $(info - Use 'make moto-setup' to install moto, for less flaky tests. Implied by 'make build'.)
	   $(info - Use 'make npm-setup' to build the front-end. Implied by 'make build'.)
	   $(info - Use 'make psql-dev' to start psql on data associated with an active 'make deploy1'.)
	   $(info - Use 'make psql-test' to start psql on data associated with an active test.)
	   $(info - Use 'make retest' to run failing tests from the previous test run.)
	   $(info - Use 'make test' to run tests with normal options similar to what we use on GitHub Actions.)
	   $(info - Use 'make test-any' to run tests without marker constraints (i.e., with no '-m' option).)
	   $(info - Use 'make update' to update dependencies (and the lock file).)
