import contextlib
import datetime
import gzip
import io
import os
import tempfile

from io import BytesIO


ENCODED_ROOT_DIR = os.path.dirname(__file__)


def resolve_file_path(path, file_loc=None):
    """ Takes a relative path from this file location and returns an absolute path to
        the desired file, needed for WSGI to resolve embed files.

    :param path: relative path to be converted
    :param file_loc: absolute path to location path is relative to, by default path/to/encoded/src/
    :return: absolute path to location specified by path
    """
    if path.startswith("~"):
        # Really this shouldn't happen, so we could instead raise an error, but at least this is semantically correct.
        path = os.path.expanduser(path)
    if file_loc:
        if file_loc.startswith("~"):
            file_loc = os.path.expanduser(file_loc)
        path_to_this_file = os.path.abspath(os.path.dirname(file_loc))
    else:
        path_to_this_file = os.path.abspath(ENCODED_ROOT_DIR)
    return os.path.join(path_to_this_file, path)


def deduplicate_list(lst):
    """ De-duplicates the given list by converting it to a set then back to a list.

    NOTES:
    * The list must contain 'hashable' type elements that can be used in sets.
    * The result list might not be ordered the same as the input list.
    * This will also take tuples as input, though the result will be a list.

    :param lst: list to de-duplicate
    :return: de-duplicated list
    """
    return list(set(lst))


def gunzip_content(content):
    """ Helper that will gunzip content """
    f_in = BytesIO()
    f_in.write(content)
    f_in.seek(0)
    with gzip.GzipFile(fileobj=f_in, mode='rb') as f:
        gunzipped_content = f.read()
    return gunzipped_content.decode('utf-8')


DEBUGLOG_ENABLED = os.environ.get('DEBUGLOG_ENABLED', "FALSE").lower() == "true"


def debuglog(*args):
    """
    As the name implies, this is a low-tech logging facility for temporary debugging info.
    Prints info to a file in user's home directory.

    The debuglog facility allows simple debugging for temporary debugging of disparate parts of the system.
    It takes arguments like print or one of the logging operations and outputs to ~/DEBUGLOG-yyyymmdd.txt.
    Each line in the log is timestamped.
    """
    if DEBUGLOG_ENABLED:
        nowstr = str(datetime.datetime.now())
        dateid = nowstr[:10].replace('-', '')
        with io.open(os.path.expanduser("~/DEBUGLOG-%s.txt" % dateid), "a+") as fp:
            print(nowstr, *args, file=fp)


# These next few could be in dcicutils.s3_utils as part of s3Utils, but details of interfaces would have to change.
# For now, for expedience, they can live here and we can refactor later. -kmp 25-Jul-2020

@contextlib.contextmanager
def s3_output_stream(s3_client, bucket, key):
    """
    This context manager allows one to write:

        with s3_output_stream(s3_client, bucket, key) as fp:
            print("foo", file=fp)

    to do output to an s3 bucket.

    In fact, an intermediate local file is involved, so this function yields a file pointer (fp) to a
    temporary local file that is open for write. That fp should be used to supply content to the file
    during the dynamic scope of the context manager. Once the context manager's body executes, the
    file will be closed, its contents will be copied to s3, and finally the temporary local file will
    be deleted.

    Args:
        s3_client: a client object that results from a boto3.client('s3', ...) call.
        bucket str: an S3 bucket name
        key str: the name of a key within the given S3 bucket
    """

    tempfile_name = tempfile.mktemp()
    try:
        with io.open(tempfile_name, 'w') as fp:
            yield fp
        s3_client.upload_file(Filename=tempfile_name, Bucket=bucket, Key=key)
    finally:
        try:
            os.remove(tempfile_name)
        except Exception:
            pass



@contextlib.contextmanager
def s3_local_file(s3_client, bucket, key):
    """
    This context manager allows one to write:

        with s3_local_file(s3_client, bucket, key) as file:
            with io.open(local_file, 'r') as fp:
                dictionary = json.load(fp)

    to do input from an s3 bucket.
    """

    tempfile_name = tempfile.mktemp()
    try:
        s3_client.download_file(Bucket=bucket, Key=key, Filename=tempfile_name)
        yield tempfile_name
    finally:
        try:
            os.remove(tempfile_name)
        except Exception:
            pass


@contextlib.contextmanager
def s3_input_stream(s3_client, bucket, key, mode='r'):
    """
    This context manager allows one to write:

        with s3_input_stream(s3_client, bucket, key) as fp:
            dictionary = json.load(fp)

    to do input from an s3 bucket.

    In fact, an intermediate local file is created, copied, and deleted.
    """

    with s3_local_file(s3_client, bucket, key) as file:
        with io.open(file, mode=mode) as fp:
            yield fp


def create_empty_s3_file(s3_client, bucket, key):
    empty_file = "/dev/null"
    s3_client.upload_file(empty_file, Bucket=bucket, Key=key)
