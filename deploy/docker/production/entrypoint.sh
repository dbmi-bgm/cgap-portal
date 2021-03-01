#!/bin/sh

# Clear db/es since this is the local entry point
poetry run clear-db-es-contents production.ini --app-name app --env $CGAP_ENV_NAME

# Create mapping
poetry run create-mapping-on-deploy production.ini --app-name app

# Load Data (based on development.ini, for now just master-inserts)
poetry run load-data production.ini --app-name app --prod

# Start nginx proxy
service nginx start

# Start application
pserve production.ini

