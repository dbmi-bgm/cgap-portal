#!/bin/sh

echo "Starting up CGAP-Portal Indexer"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Start indexer listener
es-index-listener production.ini --app-name app --verbose
