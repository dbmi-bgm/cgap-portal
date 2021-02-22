#!/bin/sh

# load local data
poetry run load-data development.ini --app-name app

# Start application
make deploy2
