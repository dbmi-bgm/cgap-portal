#!/bin/sh


# Global CGAP Application Entrypoint
# This script resolves which application type is desired based on
# the "$application_type" environment variable. Possible options are:
#  * "deployment" to run the deployment
#  * "ingester" to run the production ingester (forever)
#  * "indexer" to run the production indexer (forever)
#  * "portal" to run the production portal worker (API back-end)
#  * "local" to run a local deployment

# Note that only "local" can be run from the local machine
# but the same image build is run across the entire local/production stack.


deployment="deployment"
ingester="ingester"
indexer="indexer"
portal="portal"
local="local"

echo "Resolving which entrypoint is desired"

# shellcheck disable=SC2154
if [ "$application_type" = deployment ]; then
  sh entrypoint_deployment.sh
elif [ "$application_type" = ingester ]; then
  sh entrypoint_ingester.sh
elif [ "$application_type" = indexer ]; then
  sh entrypoint_indexer.sh
elif [ "$application_type" = portal ]; then
  sh entrypoint_portal.sh
elif [ "$application_type" = local ]; then
  sh entrypoint_local.sh
else
  echo "Could not resolve entrypoint! Check that \$application_type is set."
  exit 1
fi

exit 0


