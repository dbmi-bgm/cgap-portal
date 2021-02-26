#!/bin/sh

if [ $RUN_TEST -eq "0" ]; then

    # Clear db/es since this is the local entry point
    poetry run clear-db-es-contents development.ini --app-name app --env $CGAP_ENV_NAME

    # Create mapping
    poetry run create-mapping-on-deploy development.ini --app-name app

    # Load Data (based on development.ini, for now just master-inserts)
    poetry run load-data development.ini --app-name app --prod

    # Start nginx proxy
    service nginx start

    # Start application
    make deploy2

else

    make test

fi
