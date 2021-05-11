#!/bin/sh

echo "Starting up CGAP-Portal Indexer"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Start indexer, do 20 runs
i=0
while [ $i -ne 20 ]
do
  i=$(($i + 1))
  poetry run es-index-data production.ini --app-name app
  sleep 3
done
