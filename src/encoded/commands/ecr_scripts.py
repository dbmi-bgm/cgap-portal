import argparse
import datetime
import json
import subprocess

from dcicutils.misc_utils import PRINT, full_class_name


EPILOG = __doc__


def make_string_list(elements):
    return ",".join(elements)


def _run_aws_command(command_args, expected_errors):
    """
    Runs an AWS command with given arguments as a subprocess.

    Args:
        command_args: a list of arguments to be given the 'aws' command.
        expected_errors: a dictionary of substrings to match and error messages to use instead if one matches.

    Returns:
        parsed JSON resulting from the command
    """
    # TODO: This function could go elsewhere. Perhaps dcicutils.
    #       The name has an "_" here so no one gets used to importing it from here before we move it.
    #       -kmp 9-Mar-2022
    try:
        binary_result = subprocess.check_output(['aws'] + list(command_args),
                                                # Send error messages to stdout so they can be captured
                                                stderr=subprocess.STDOUT)
        # In the successful case, the output captured is JSON to be parsed
        result = binary_result.decode('utf-8')
        result_json = json.loads(result)
    except subprocess.CalledProcessError as e:
        # In the unsuccessful case, there might be an error message on stdout.
        error_output = e.output.decode('utf-8').strip()
        if error_output:
            # Show the output if it wasn't something we recognize, but then allow original error to continue raising.
            PRINT(error_output)  # This may be a better error message.
        for substring, message in expected_errors.items():
            if substring in error_output:
                # If we have a better message, use it.
                raise RuntimeError(message)
        raise
    return result_json


def get_images_descriptions(ecs_repository, sort_results=False):
    result_json = _run_aws_command(command_args=['ecr', 'describe-images', '--repository-name', ecs_repository],
                                   expected_errors={
                                       "ExpiredTokenException": "Your AWS security token seems to have expired."})
    image_details = result_json['imageDetails']
    if sort_results:
        image_details = sorted(image_details, key=lambda x: x['imagePushedAt'], reverse=True)
    return image_details


def describe_images(ecs_repository):
    # Refer to
    for image_detail in get_images_descriptions(ecs_repository, sort_results=True):
        image_pushed_at = image_detail['imagePushedAt']
        if isinstance(image_pushed_at, (float, int)):
            # The raw API call returns a float, but higher level interfaces probably don't
            image_pushed_at = datetime.datetime.utcfromtimestamp(image_pushed_at)
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
