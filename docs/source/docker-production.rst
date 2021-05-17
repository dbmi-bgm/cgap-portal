CGAP-Docker (production)
========================

CGAP-Docker runs in production on Elastic Container Service, meant to be orchestrated from the 4dn-cloud-infra repository. End users will modify `deploy/docker/production/Makefile`` to suite their immediate build needs with respect to target AWS Account/ECR Repository/Tagging strategy. For more information on the specifics of the ECS setup, see 4dn-cloud-infra.

The CGAP Application has been orchestrated into the ECS Service/Task paradigm. As of writing all core application services have their own image tag defined by the ``$ENTRYPOINT`` build argument. As such, they are all separate services with the following notable characteristics:

    * WSGI - services standard API requests - 8x parallelization on Fargate Spot
    * Indexer - hits /index at 3 second intervals indefinitely - 4x parallelization on Fargate Spot
    * Ingester - poll for ingestion tasks from SQS - 1x parallelization TODO add ability to add additional tasks through API
    * Deployment - triggers the standard deployment actions - must be explicitly run either through ECS console or TODO through API.

Building an Image
^^^^^^^^^^^^^^^^^

The production application configuration is in ``deploy/docker/production``. A description of all the relevent files is below.

    * assume_identity.py - script for pulling application configuration from Secrets Manager
    * Dockerfile - production Dockerfile, essentially identical to local deployment, except the container does not run as root
    * entrypoint.sh - WSGI entrypoint
    * entrypoint_deploymentn.sh - deployment entrypoint
    * entrypoint_indexer.sh - indexer entrypoint
    * entrypoint_ingester.sh - ingester entrypoint
    * install_nginx.sh - script for pulling in nginx
    * Makefile - configures builds/pushes for relevant images
    * mastertest.ini - base ini file used to build production.ini on the server
    * nginx.conf - nginx configuration


The following instructions describe how to build/push images. Note though that we assume an existing ECS setup. For instructions on how to orchestrate ECS, see 4dn-cloud-infra, but that is not the focus of this documentation.

    * Ensure the orchestrator credentials are sourced, or that your IAM user has been granted sufficient perms to push to ECR.
    * In the Makefile, replace "cgap-mastertest" with the env.name configured for the environment. This name should match the ECR repo name if you navigate to the ECR Console.
    * Again in the Makefile, replace the ECR Repo URL (NOT the tags) with the one from the output of the ECR stack in the account.
    * Run ``make login``, which should pull ECR credentials using the currently active AWS credentials.
    * Run ``make info`` for information on tags.
    * Run the appropriate make target to build/deploy the desired version by pushing a new image to ECR. Note that the upload process may take a long time if you made application code (non-configuration) changes.
