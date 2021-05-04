#!/bin/sh

echo "Starting up CGAP-Portal Indexer"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Start indexer, do 20 runs
for i in {1..20}; do
  poetry run es-index-data production.ini --app-name app --verbose
  sleep 1
done
