#!/bin/sh

echo "Running a CGAP deployment on the given environment"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Clear db/es since this is the local entry point
poetry run clear-db-es-contents production.ini --app-name app --env $CGAP_ENV_NAME

## Create mapping
poetry run create-mapping-on-deploy production.ini --app-name app

# Load Data (based on development.ini, for now just master-inserts)
poetry run load-data production.ini --app-name app --prod

# Load access keys
poetry run load-access-keys production.ini --app-name app
