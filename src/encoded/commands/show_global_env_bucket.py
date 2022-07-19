import argparse
import boto3
import json
import yaml

from dcicutils.lang_utils import disjoined_list
from dcicutils.misc_utils import PRINT


EPILOG = __doc__


def get_envs_buckets(client=None):
    client = client or boto3.client('s3')
    all_buckets = [bucket['Name'] for bucket in client.list_buckets()['Buckets']]
    envs_buckets = [bucket for bucket in all_buckets if bucket.endswith("-envs")]
    return envs_buckets


LEGACY_FF_ENVS_BUCKET = 'foursight-prod-envs'

def get_env_bucket(client=None):
    envs_buckets = get_envs_buckets(client=client)
    if len(envs_buckets) == 1:
        return envs_buckets[0]
    elif LEGACY_FF_ENVS_BUCKET in envs_buckets:
        return LEGACY_FF_ENVS_BUCKET
    else:
        return None


def print_heading(head, width=80, style='='):
    head_width = len(head)
    offset = head_width + (width - head_width) // 2
    PRINT(style * width)
    PRINT(head.rjust(offset))
    PRINT(style * width)


def show_global_env_bucket(bucket, mode='json'):

    client = boto3.client('s3')

    if bucket is None:
        envs_buckets = get_envs_buckets(client=client)
        if envs_buckets:
            PRINT("There are no obvious envs buckets.")
        else:
            PRINT(f"There is no default bucket. Please use a '--bucket' argument"
                  f" to specify one of {disjoined_list(envs_buckets)}.")
        exit(1)

    print_heading(bucket, style='=')

    for entry in client.list_objects(Bucket=bucket, MaxKeys=100)['Contents']:
        key = entry['Key']
        print_heading(key, style='-')
        object = json.load(client.get_object(Bucket=bucket, Key=key)['Body'])
        if mode == 'json':
            PRINT(json.dumps(object, indent=2, default=str))
        elif mode == 'yaml':
            PRINT(yaml.dump(object))
        else:
            PRINT(f"Unknown mode: {mode}. Try 'json' or 'yaml'.")
            exit(1)


DEFAULT_BUCKET = get_env_bucket()
DEFAULT_MODE = 'json'

def main(override_args=None):
    """
    This is the main program that can be used from the command line to invoke the unrelease_most_recent_image function.

    Args:
        override_args: a list of arguments to  use instead of the command line arguments (usually for testing)
    """
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description=f"Shows the contents of a global env bucket.", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--bucket', default=DEFAULT_BUCKET, required=False,
                        help=f"bucket to show (default {DEFAULT_BUCKET})")
    parser.add_argument('--mode', default=DEFAULT_MODE, required=False,
                        help=f"mode to show (json or yaml; default {DEFAULT_MODE})")
    args = parser.parse_args(args=override_args)
    show_global_env_bucket(bucket=args.bucket)


if __name__ == '__main__':
    main()
