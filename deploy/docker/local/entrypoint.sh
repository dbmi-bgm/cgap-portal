#!/bin/sh

# Enter venv
export PATH="/opt/venv/bin:$PATH"

# load local data
poetry run load-data development.ini --app-name app

# Start application
make deploy2
