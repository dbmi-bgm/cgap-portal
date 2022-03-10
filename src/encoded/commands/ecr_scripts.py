import argparse
import botocore.exceptions
import boto3
import contextlib

from dcicutils.common import REGION
from dcicutils.misc_utils import PRINT, full_class_name
from dcicutils.lang_utils import n_of


EPILOG = __doc__


DEFAULT_ECS_REPO = 'main'
IMAGE_COUNT_LIMIT = 10
IMAGE_LIST_CHUNK_SIZE = 25


def make_ordered_string_list(elements):
    return ", ".join(sorted(elements))


@contextlib.contextmanager
def ecr_errors_trapped():
    try:
        try:
            yield
            exit(0)
        except botocore.exceptions.ClientError as e:
            error_info = e.response.get('Error', {})
            message = error_info.get('Message')
            code = error_info.get('Code')
            if code == 'ExpiredTokenException':
                raise RuntimeError("Your security token seems to have expired.")
            elif message:
                PRINT(f"{code}: {message}")
                exit(1)
            else:
                raise
    except Exception as e:
        PRINT(f"{full_class_name(e)}: {e}")
        exit(1)


def get_images_descriptions(ecs_repository, digests=None, tags=None, limit=None, ecr_client=None):
    ecr_client = ecr_client or boto3.client('ecr', region_name=REGION)
    next_token = None
    image_descriptions = []
    # We don't know what order they are in, so we need to pull them all down and sort them before applying the limit.
    while True:
        options = {'repositoryName': ecs_repository}
        if next_token:
            options['nextToken'] = next_token
        else:
            ids = []
            if digests:
                # We may only provide this option on the first call, and only if it's non-null.
                ids.extend([{'imageDigest': digest} for digest in digests])
            if tags:
                ids.extend([{'imageTag': tag} for tag in tags])
            if ids:
                options['imageIds'] = ids
            else:
                options['maxResults'] = IMAGE_LIST_CHUNK_SIZE  # can only be provided on the first call
        response = ecr_client.describe_images(**options)
        image_descriptions.extend(response['imageDetails'])
        next_token = response.get('nextToken')
        if not next_token:
            break
    image_descriptions = sorted(image_descriptions, key=lambda x: x['imagePushedAt'], reverse=True)
    total = len(image_descriptions)
    if limit:  # Either None or 0 will be treated as no limit
        image_descriptions = image_descriptions[:limit]
    return {'descriptions': image_descriptions, 'count': len(image_descriptions), 'total': total}


def describe_images(ecs_repository, digests=None, tags=None, limit=IMAGE_COUNT_LIMIT, summarize=True):
    # Refer to
    info = get_images_descriptions(ecs_repository=ecs_repository, digests=digests, tags=tags, limit=limit)
    for image_detail in info['descriptions']:
        image_pushed_at = image_detail['imagePushedAt']
        image_tags = image_detail.get('imageTags', [])
        image_digest = image_detail['imageDigest']
        PRINT(f"{image_digest} {image_pushed_at} {make_ordered_string_list(image_tags)}")
    n = info['count']
    total = info['total']
    if summarize:
        if digests or tags:
            PRINT(f"Only {n_of(n, 'relevant image')} shown.")
        else:
            PRINT(f"{'All' if n == total else 'Most recent'} {info['count']} of {info['total']} images shown.")


def describe_images_main(override_args=None):
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Show descriptions of all images in ECS", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--ecs-repository', dest='ecs_repository', default=DEFAULT_ECS_REPO, metavar="<repo-name>",
                        help=f"repository name to show images for (default: {DEFAULT_ECS_REPO})")
    parser.add_argument('--limit', default=IMAGE_COUNT_LIMIT, metavar="<n>", type=int,
                        help=f"maximum number of images to describe (default: {IMAGE_COUNT_LIMIT})")
    parsed = parser.parse_args(args=override_args)

    with ecr_errors_trapped():
        describe_images(ecs_repository=parsed.ecs_repository, limit=parsed.limit)


def get_image_manifest(ecs_repository, tag=None, digest=None, ecr_client=None) -> str:
    ecr_client = ecr_client or boto3.client('ecr', region_name=REGION)
    if tag and not digest:
        image_id = {"imageTag": tag}
    elif digest and not tag:
        image_id = {"imageDigest": digest}
    else:  # neither or both
        raise RuntimeError("Exactly one of --tag and --digest is required.")
    options = {'repositoryName': ecs_repository, 'imageIds': [image_id]}
    response = ecr_client.batch_get_image(**options)
    images = response.get('images')
    if not images or len(images) == 0:
        raise RuntimeError(f"No match for {image_id}.")
    elif len(images) > 1 and not all(image['imageManifest'] == images[0]['imageManifest'] for image in images):
        # Usually we get more than one because it's the same image with different labels,
        # but this is just in case the problem is other than that.
        raise RuntimeError(f"Too many ({len(images)}) matches for {image_id}.")
    else:
        image = images[0]
    return image.get('imageManifest')


def show_image_manifest(ecs_repository, tag=None, digest=None, ecr_client=None):
    info = get_image_manifest(ecs_repository, tag=tag, digest=digest, ecr_client=ecr_client)
    PRINT(info)


def show_image_manifest_main(override_args=None):
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Show the manifest for an ECS image, specified by either label or digest (sha).", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--ecs-repository', dest='ecs_repository', default=DEFAULT_ECS_REPO, metavar="<repo-name>",
                        help=f"repository name to show images for (default: {DEFAULT_ECS_REPO})")
    parser.add_argument('--digest', default=None, metavar="<sha>",
                        help=f"digest (sha) to look for (required unless --tag is given)")
    parser.add_argument('--tag', default=None, metavar="<tag>",
                        help=f"tag to look for (required unless --digest is given)")
    parsed = parser.parse_args(args=override_args)

    with ecr_errors_trapped():
        show_image_manifest(ecs_repository=parsed.ecs_repository, tag=parsed.tag, digest=parsed.digest)


def add_image_tag(ecs_repository, digest, tag, ecr_client=None):
    ecr_client = ecr_client or boto3.client('ecr', region_name=REGION)
    relevant_digests = [digest]
    try:
        # This figures out where the image was before. It might be it was nowhere, in which case nothing gets added.
        info = get_images_descriptions(ecs_repository=ecs_repository, tags=[tag], ecr_client=ecr_client)
        old_digest = info['descriptions'][0]['imageDigest']
        relevant_digests.append(old_digest)
    except Exception:
        pass
    old_tags = []
    try:
        # This figures out where the image was before. It might be it was nowhere, in which case nothing gets added.
        info = get_images_descriptions(ecs_repository=ecs_repository, digests=[digest], ecr_client=ecr_client)
        old_tags = info['descriptions'][0]['imageTags']
    except Exception:
        pass
    if tag in old_tags:
        raise RuntimeError(f"Image {digest} is already labeled {tag!r}.")
    if tag.startswith("sha256:"):
        raise RuntimeError(f"Invalid tag: {tag}")
    if not digest.startswith("sha256:"):
        raise RuntimeError(f"Invalid digest (not a sha256): {digest}")
    PRINT("Before:")
    describe_images(ecs_repository=ecs_repository, digests=relevant_digests, summarize=False)
    manifest = get_image_manifest(ecs_repository, digest=digest, ecr_client=ecr_client)
    ecr_client.put_image(repositoryName=ecs_repository, imageManifest=manifest, imageTag=tag)
    # This shows what changed.
    PRINT("After:")
    describe_images(ecs_repository=ecs_repository, digests=relevant_digests)


def add_image_tag_main(override_args=None):
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Adds a tag to a given image.", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--ecs-repository', dest='ecs_repository', default=DEFAULT_ECS_REPO, metavar="<repo-name>",
                        help=f"repository name to show images for (default: {DEFAULT_ECS_REPO})")
    parser.add_argument('digest', metavar="<sha>",
                        help="digest (sha) of image to add tag to (REQUIRED)")
    parser.add_argument('tag', metavar="<tag>",
                        help="tag to add (REQUIRED)")
    parsed = parser.parse_args(args=override_args)

    with ecr_errors_trapped():
        add_image_tag(ecs_repository=parsed.ecs_repository, tag=parsed.tag, digest=parsed.digest)


def last_two_deploys(ecs_repository, ecr_client=None):
    ecr_client = ecr_client or boto3.client('ecr', region_name=REGION)
    info = get_images_descriptions(ecs_repository=ecs_repository, ecr_client=ecr_client)
    descriptions = info.get('descriptions')
    if not descriptions:
        raise RuntimeError("Nothing seems to have been deployed.")
    elif len(descriptions) == 1:
        raise RuntimeError("There is only one deploy.")
    else:
        most_recent_two = descriptions[:2]
        return most_recent_two


def unmark_latest(ecs_repository, ecr_client=None):
    ecr_client = ecr_client or boto3.client('ecr', region_name=REGION)
    [most_recent, previous] = last_two_deploys(ecs_repository=ecs_repository, ecr_client=ecr_client)
    if 'latest' not in most_recent.get('imageTags', []):
        raise RuntimeError("Most recent deploy is already marked latest. You'll have to sort this out manually.")
    add_image_tag(ecs_repository=ecs_repository, digest=previous['imageDigest'], tag='latest',
                  ecr_client=ecr_client)


def unmark_latest_main(override_args=None):
    parser = argparse.ArgumentParser(  # noqa - PyCharm wrongly thinks the formatter_class is invalid
        description="Moves the 'latest' tag from most recent deploy to the previous deploy.", epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--ecs-repository', dest='ecs_repository', default=DEFAULT_ECS_REPO, metavar="<repo-name>",
                        help=f"repository name to show images for (default: {DEFAULT_ECS_REPO})")
    parsed = parser.parse_args(args=override_args)
    with ecr_errors_trapped():
        unmark_latest(ecs_repository=parsed.ecs_repository)
