#!/bin/bash

echo "Running a CGAP deployment on the given environment"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Clear db/es on cgap-devtest if we run an "initial" deploy
# Do nothing on other environments
if [ -n "${INITIAL_DEPLOYMENT}" ]; then
  poetry run clear-db-es-contents production.ini --app-name app --env cgap-devtest
fi

## Create mapping
poetry run create-mapping-on-deploy production.ini --app-name app

# Load Data (based on development.ini, for now just master-inserts)
# Not necessary after first deploy
if [ -n "${INITIAL_DEPLOYMENT}" ]; then
    poetry run load-data production.ini --app-name app --prod
fi

# Load access keys
# Note that the secret name must match that which was created for this environment
poetry run load-access-keys production.ini --app-name app --secret-name "$IDENTITY"

exit 0
