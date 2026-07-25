#!/bin/sh

echo "Starting up CGAP-Portal WSGI"

# Run assume_identity.py to access the desired deployment configuration from
# secrets manager - this builds production.ini
poetry run python -m assume_identity

# Start application workers and nginx (nginx runs in the foreground under supervisord)
echo "Starting supervisor"
supervisord -c supervisord.conf
