# This code snippet is adapated from AWS ECS Documentation
# The plan is 'create' environments by uploading Secrets to AWS Secrets Manager
# and retrieve the secrets upon deployment.
# The idea is the container runner will have an assumed IAM role granting access
# specifically to the secret

import os
import json
import boto3
import logging
import watchtower
from botocore.exceptions import ClientError
from dcicutils.beanstalk_utils import REGION
from dcicutils.qa_utils import override_environ
from dcicutils.deployment_utils import IniFileManager


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__file__)
_MY_DIR = os.path.dirname(__file__)


class CGAPDockerIniFileManager(IniFileManager):
    """ This runs at top level, so path is slightly different. """
    # should work but doesn't (missing cgap-portal): os.path.join(os.path.dirname(_MY_DIR), "pyproject.toml")
    TEMPLATE_DIR = '/home/nginx/cgap-portal/deploy/ini_files'
    PYPROJECT_FILE_NAME = '/home/nginx/cgap-portal/pyproject.toml'


def assume_identity():
    """ This function makes a request to secrets manager for the identity passed to the container.
        See documentation above.
    """
    secret_name = os.environ.get('IDENTITY', 'dev/beanstalk/cgap-dev')
    region_name = REGION  # us-east-1

    # XXX: We should refactor a SecretsManager wrapper into dcicutils
    session = boto3.session.Session(region_name=region_name)
    # configure watchtower handler from session
    logger.addHandler(watchtower.CloudWatchLogHandler(boto3_session=session))
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:  # leaving some useful debug info to help narrow issues
        if e.response['Error']['Code'] == 'DecryptionFailureException':
            # Secrets Manager can't decrypt the protected secret text using the provided KMS key.
            raise e
        elif e.response['Error']['Code'] == 'InternalServiceErrorException':
            # An error occurred on the server side.
            raise e
        elif e.response['Error']['Code'] == 'InvalidParameterException':
            # You provided an invalid value for a parameter.
            raise e
        elif e.response['Error']['Code'] == 'InvalidRequestException':
            # You provided a parameter value that is not valid for the current state of the resource.
            raise e
        elif e.response['Error']['Code'] == 'ResourceNotFoundException':
            raise e
        else:
            raise e
    else:
        # Decrypts secret using the associated KMS CMK.
        # Depending on whether the secret is a string or binary, one of these fields will be populated.
        if 'SecretString' in get_secret_value_response:
            identity = json.loads(get_secret_value_response['SecretString'])
        else:
            raise Exception('Got unexpected response structure from boto3')

        # build production.ini
        with override_environ(**identity):

            CGAPDockerIniFileManager.main()


if __name__ == '__main__':
    assume_identity()
