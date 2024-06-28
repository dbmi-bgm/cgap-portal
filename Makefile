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

clear-poetry-cache:  # clear poetry/pypi cache. for user to do explicitly, never automatic
	poetry cache clear pypi --all

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
	@# This setup was needed here because there was no bracket syntax in pypoetry.com.
	@# Now that we're using a higher version of moto, and not using the server parts, we don't need this here.
	@# It's now all done in pyproject.toml, getting a higher version as well.
	@# This comment and this make target can go away once that's proven effective. -kmp 23-Mar-2023
	@# pip install "moto[server]==1.3.7"
	@echo "'moto[server]' not being installed here. Regular 'moto' will be installed by pyproject.toml."

macpoetry-install:  # Same as 'poetry install' except that on OSX Catalina, an environment variable wrapper is needed
	bin/macpoetry-install

configure:  # does any pre-requisite installs
	pip install --upgrade pip
#	pip install poetry==1.4.2
	pip install setuptools
	pip install wheel
#ifeq ($(shell uname -s), Darwin)
#ifeq ($(shell uname -m), arm64)
#	pip install pysam=="0.21.0"
#	pip install matplotlib=="3.3.4"
#endif
#endif
	poetry config virtualenvs.create false --local # do not create a virtualenv - the user should have already done this -wrr 20-Sept-2021

build-poetry:
	make configure
	poetry install

macbuild-poetry:
	make configure
	make macpoetry-install

build:  # builds
#ifeq ($(shell uname -s), Darwin)
#	@echo "Looks like this is Mac so executing: make macbuild"
#	make macbuild
#else
	make build-poetry
	make build-after-poetry
#endif

macbuild:  # Builds for MacOS (see: bin/macpoetry-install)
	make macbuild-poetry
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
	poetry run prepare-local-dev

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
#	@DEBUGLOG=`pwd` SNOVAULT_DB_TEST_PORT=`grep 'sqlalchemy[.]url =' development.ini | sed -E 's|.*:([0-9]+)/.*|\1|'` dev-servers development.ini --app-name app --clear --init --load

deploy1b:  # starts ingestion engine separately so it can be easily stopped and restarted for debugging in foreground
	@echo "Starting ingestion listener. Press ^C to exit." && DEBUGLOG=`pwd` SNOVAULT_DB_TEST_PORT=`grep 'sqlalchemy[.]url =' development.ini | sed -E 's|.*:([0-9]+)/.*|\1|'` poetry run ingestion-listener development.ini --app-name app

deploy2:  # spins up waittress to serve the application
	@DEBUGLOG=`pwd` SNOVAULT_DB_TEST_PORT=`grep 'sqlalchemy[.]url =' development.ini | sed -E 's|.*:([0-9]+)/.*|\1|'` pserve development.ini

deploy3:  # Uploads genes, consequences then ingests the VCF below
	poetry run ingest-vcf src/encoded/annotations/GAPFIBVPFEP5_v0.5.4.reformat.altcounts.vcf dummy-accession hms-dbmi hms-dbmi development.ini --app-name app --post-variants --post-genes --post-conseq

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

test-full:
	@git log -1 --decorate | head -1
	@date
	make test-static-full || echo "static tests failed"
	make test-unit-full || echo "unit tests failed"
	make test-npm || echo "npm tests failed"
	make test-indexing-full || echo "indexing tests failed"
	@git log -1 --decorate | head -1
	@date

test:
	@git log -1 --decorate | head -1
	@date
	make test-static && make test-unit && make test-npm && make test-indexing
	@git log -1 --decorate | head -1
	@date


BASE_MARKERS = not manual and not sloppy and not static and not broken
# Unit tests
NORM_MARKERS = not performance and not integratedx
# Performance tests
PERF_MARKERS = performance and not integratedx
# Integration tests
INTG_MARKERS = not performance and (integrated or integratedx)

retest:
	poetry run python -m pytest -vv -r w --last-failed

test-any:
	poetry run python -m pytest -xvv -r w --timeout=200

test-unit:
	poetry run python -m pytest -xvv -r w --durations=25 --timeout=600 -m "${BASE_MARKERS} and ${NORM_MARKERS} and not indexing"

test-unit-full:
	poetry run python -m pytest -vv  -r w --durations=25 --timeout=600 -m "${BASE_MARKERS} and ${NORM_MARKERS} and not indexing"

test-indexing-full:
	make test-indexing-es-full
	make test-indexing-not-es-full

test-indexing-es-full:
	poetry run python -m pytest -vv  -r w --durations=25 --timeout=300 -m "${BASE_MARKERS} and ${NORM_MARKERS} and indexing and es"

test-indexing-not-es-full:
	poetry run python -m pytest -vv  -r w --durations=25 --timeout=300 -m "${BASE_MARKERS} and ${NORM_MARKERS} and indexing and not es"

test-indexing:
	make test-indexing-es && make test-indexing-not-es

test-indexing-es:
	poetry run python -m pytest -xvv -r w --durations=25 --timeout=200 -m "${BASE_MARKERS} and ${NORM_MARKERS} and indexing and es"

test-indexing-not-es:
	poetry run python -m pytest -xvv -r w --durations=25 --timeout=200 -m "${BASE_MARKERS} and ${NORM_MARKERS} and indexing and not es"

test-performance:
	poetry run python -m pytest -xvv -r w --timeout=200 -m "${BASE_MARKERS} and ${PERF_MARKERS}"

test-integrated:
	poetry run python -m pytest -xvv -r w --timeout=200 -m "${BASE_MARKERS} and ${INTG_MARKERS}"

test-npm:
	@#At one point we did 'npm test' here, but now we do separate cypress tests. -kmp 24-Mar-2023
	@echo "npm tests would run here if they were enabled. Instead we have a separate Cypress test GA workflow."

test-static-full:
	poetry run python -m pytest -vv -m static
	make lint-full

test-static:
	poetry run python -m pytest -vv -m static && make lint

TEST_NAME ?= missing_TEST_NAME_parameter

test-one:
	poetry run python -m pytest -xvv -r w --durations=25 --timeout=200 -m "${BASE_MARKERS} and ${NORM_MARKERS}" -k "${TEST_NAME}"

REMOTE_ES = search-cgap-unit-testing-opensearch-tcs45cjpwgdzoi7pafr6oewq6u.us-east-1.es.amazonaws.com:443
REMOTE_MARKERS = ${BASE_MARKERS} and ${NORM_MARKERS} and not broken_remotely

remote-test:  # Actually, we don't normally use this. Instead the GA workflow sets up two parallel tests.
	make remote-test-indexing && make remote-test-npm && make remote-test-unit

remote-test-npm:
	make test-npm

remote-test-unit:
	make remote-test-indexing-not-es

remote-test-not-indexing:  # Note this only does the 'not indexing' tests
	poetry run python -m pytest -xvv -r w --durations=25 --timeout=600 -m "${REMOTE_MARKERS} and not indexing" --aws-auth --es ${REMOTE_ES} --instafail --force-flaky --max-runs=2 --durations=20 --cov src/encoded

remote-test-indexing:
	make remote-test-indexing-es && make remote-test-not-indexing

remote-test-indexing-es:
	poetry run python -m pytest -xvv -r w --durations=25 --timeout=300 -m "${REMOTE_MARKERS} and indexing and es" --aws-auth --es ${REMOTE_ES} --cov-append

remote-test-indexing-not-es:
	poetry run python -m pytest -xvv -r w --durations=25 --timeout=300 -m "${REMOTE_MARKERS} and indexing and not es" --aws-auth --es ${REMOTE_ES} --cov-append

update:  # updates dependencies
	poetry update

debug-docker-local:
	@scripts/debug-docker-local

build-docker-local:
	docker-compose build

build-docker-local-clean:
	docker-compose build --no-cache

deploy-docker-local:
	docker-compose up -V

deploy-docker-local-daemon:
	docker-compose up -d -V

ENV_NAME ?= cgap-mastertest
AWS_ACCOUNT ?= 645819926742

ecr-login:
	@echo "Making ecr-login AWS_ACCOUNT=${AWS_ACCOUNT} ..."
	scripts/assure-awscli
	aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT}.dkr.ecr.us-east-1.amazonaws.com

ecr-test-login:  # for ecr-login to account in ~/aws_test. More info in https://hms-dbmi.atlassian.net/browse/C4-684
	@echo "Making ecr-login for your .aws_test account ..."
	scripts/ecr-test-login

rebuild-docker-production:
	@echo "Remaking build-docker-production AWS_ACCOUNT=${AWS_ACCOUNT} ENV_NAME=${ENV_NAME} ..."
	docker build -t ${ENV_NAME}:latest . --no-cache
	make tag-and-push-docker-production

build-docker-test:
	@# This will do the equivalent of
	@#    make ecr-login AWS_ACCOUNT=<selected-test-account>
	@#    make build-docker-production AWS_ACCOUNT=<selected-test-account> ENV_NAME=<selected-env>
	@# but it has to do the login inside the script, we cannot do it separately here
	@# because it has to infer the correct AWS_ACCOUNT and ENV_NAME by nosing into
	@# ~/.aws_test/test_creds.sh looking for ACCOUNT_NUMBER (note: not AWS_ACCOUNT) and ENV_NAME.
	scripts/build-docker-test --login

build-docker-test-main:
	scripts/build-docker-test --login --ecosystem main

build-docker-production:
	@echo "Making build-docker-production AWS_ACCOUNT=${AWS_ACCOUNT} ENV_NAME=${ENV_NAME} ..."
	docker build -t ${ENV_NAME}:latest .
	make tag-and-push-docker-production ENV_NAME=${ENV_NAME} AWS_ACCOUNT=${AWS_ACCOUNT}

tag-and-push-docker-production:
	@echo "Making tag-and-push-docker-production AWS_ACCOUNT=${AWS_ACCOUNT} ENV_NAME=${ENV_NAME} ..."
	docker tag ${ENV_NAME}:latest ${AWS_ACCOUNT}.dkr.ecr.us-east-1.amazonaws.com/${ENV_NAME}:latest
	date
	docker push ${AWS_ACCOUNT}.dkr.ecr.us-east-1.amazonaws.com/${ENV_NAME}:latest
	date

lint-full:
	@flake8 deploy/ || echo "flake8 failed for deploy/"
	@flake8 src/encoded/ || echo "flake8 failed for src/encoded"

lint:
	@flake8 deploy/ && flake8 src/encoded/

publish:
	poetry run publish-to-pypi

publish-for-ga:
	poetry run publish-to-pypi --noconfirm

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
	   $(info - Use 'make clear-poetry-cache' to clear the poetry pypi cache if in a bad state. (Safe, but later recaching can be slow.))
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
	   $(info - Use 'make build-docker-local' to build the local Docker image.)
	   $(info - Use 'make build-docker-local-clean' to build the local Docker image with no cache.)
	   $(info - Use 'make deploy-docker-local' start up the cluster - pserve output will follow if successful.)
	   $(info - Use 'make deploy-docker-local-daemon' will start the cluster in daemon mode.)
	   $(info - Use 'make ecr-login' to login to ECR with the currently sourced AWS creds.)
	   $(info - Use 'make build-docker-test' to login+build+upload to ECR repo for config env with ~/.aws_test creds.)
	   $(info - Use 'make build-docker-test-main' to login+build+upload to ECR repo 'main' with ~/.aws_test creds.)
	   $(info - Use 'make build-docker-production' to build/tag/push a production image.)
	   $(info - Use 'make build-docker-test' to do a ecr-test-login + build-docker-production with ~/.aws_test creds.)
