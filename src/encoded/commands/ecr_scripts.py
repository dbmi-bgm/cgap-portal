import argparse
import boto3
import datetime

from dcicutils.common import REGION
from dcicutils.misc_utils import PRINT, full_class_name


EPILOG = __doc__


def make_string_list(elements):
    return ",".join(elements)


def get_images_descriptions(ecs_repository, sort_results=True, ecr_client=None):
    ecr_client = ecr_client or boto3.client('ecr', region_name=REGION)
    next_token = None
    image_descriptions = []
    while True:
        options = {'repositoryName': ecs_repository, 'maxResults': 10}
        if next_token:
            options['nextToken'] = next_token
        response = ecr_client.describe_images(**options)
        image_descriptions.extend(response['imageDetails'])
        next_token = response.get('nextToken')
        if not next_token:
            break
    if sort_results:
        image_descriptions = sorted(image_descriptions, key=lambda x: x['imagePushedAt'], reverse=True)
    return image_descriptions


def describe_images(ecs_repository):
    # Refer to
    for image_detail in get_images_descriptions(ecs_repository, sort_results=True):
        image_pushed_at = image_detail['imagePushedAt']
        image_tags = image_detail.get('imageTags', [])
        image_digest = image_detail['imageDigest']
        print(f"{image_digest} {image_pushed_at} {make_string_list(image_tags)}")


DEFAULT_ECS_REPO = 'main'


def describe_images_main(override_args=None):
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Show descriptions of all images in ECS", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--ecs-repository', dest='ecs_repository', default=DEFAULT_ECS_REPO, metavar="<repo-name>",
                        help=f"repository name to show images for (default: {DEFAULT_ECS_REPO})")
    parsed = parser.parse_args(override_args)

    try:
        describe_images(ecs_repository=parsed.ecs_repository)
    except Exception as e:
        PRINT(f"{full_class_name(e)}: {e}")
