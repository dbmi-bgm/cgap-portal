#!/bin/sh

echo "Running a CGAP deployment on the given environment"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Clear db/es since this is the local entry point
# 'skip' is provided as an argument so that this step doesn't run
poetry run clear-db-es-contents production.ini --app-name app --env skip

## Create mapping
poetry run create-mapping-on-deploy production.ini --app-name app

# Load Data (based on development.ini, for now just master-inserts)
poetry run load-data production.ini --app-name app --prod

# Load access keys
# Note that the secret name must match that which was created for this environment
poetry run load-access-keys production.ini --app-name app --secret-name dev/beanstalk/cgap-dev

exit 0
