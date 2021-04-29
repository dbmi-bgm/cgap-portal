#!/bin/sh

# Echo something at startup
echo "Starting up CGAP Portal"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity.py

# XXX: this is deployment stuff, doesn't need to be run at this time
## Clear db/es since this is the local entry point
#poetry run clear-db-es-contents production.ini --app-name app --env $CGAP_ENV_NAME
#
## Create mapping
#poetry run create-mapping-on-deploy production.ini --app-name app
#
## Load Data (based on development.ini, for now just master-inserts)
#poetry run load-data production.ini --app-name app --prod

# Start nginx proxy
service nginx start

# Start application
pserve production.ini

