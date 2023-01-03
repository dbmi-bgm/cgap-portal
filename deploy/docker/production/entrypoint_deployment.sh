#!/bin/bash

echo "Running a CGAP deployment on the given environment"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Clear db/es on cgap-devtest if we run an "initial" deploy
# Do nothing on other environments
# TEMP: add --allow-prod
if [ -n "${INITIAL_DEPLOYMENT}" ]; then
  poetry run clear-db-es-contents production.ini --app-name app --only-if-env cgap-supertest --allow-prod
fi

# Create mapping
# Force wipe of ES
poetry run create-mapping-on-deploy production.ini --staggered

# Load Data (based on development.ini, for now just master-inserts)
# Not necessary after first deploy
if [ -n "${INITIAL_DEPLOYMENT}" ]; then
    poetry run load-data production.ini --app-name app --prod
else
    # Patch higlass_view_config items on every deploy from the master-inserts directory as they have to be in sync with the code
    poetry run load-data-by-type production.ini --app-name app --prod --overwrite --indir master-inserts --itype higlass_view_config
fi

# Load access keys
# Note that the secret name must match that which was created for this environment
poetry run load-access-keys production.ini --app-name app --secret-name "$IDENTITY"

exit 0
