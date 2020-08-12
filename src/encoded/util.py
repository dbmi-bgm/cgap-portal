import contextlib
import datetime
import gzip
import io
import os
import random
import pyramid.request
import tempfile

from dcicutils.misc_utils import check_true
from io import BytesIO
from snovault import COLLECTIONS, Collection
from snovault.crud_views import collection_add as sno_collection_add
from snovault.embed import make_subrequest
from snovault.schema_utils import validate_request


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


DEBUGLOG = os.environ.get('DEBUGLOG', "")


def debuglog(*args):
    """
    As the name implies, this is a low-tech logging facility for temporary debugging info.
    Prints info to a file in user's home directory.

    The debuglog facility allows simple debugging for temporary debugging of disparate parts of the system.
    It takes arguments like print or one of the logging operations and outputs to ~/DEBUGLOG-yyyymmdd.txt.
    Each line in the log is timestamped.
    """
    if DEBUGLOG:
        try:
            nowstr = str(datetime.datetime.now())
            dateid = nowstr[:10].replace('-', '')
            with io.open(os.path.expanduser(os.path.join(DEBUGLOG, "DEBUGLOG-%s.txt" % dateid)), "a+") as fp:
                print(nowstr, *args, file=fp)
        except Exception:
            # There are many things that could go wrong, but none of them are important enough to fuss over.
            # Maybe it was a bad pathname? Out of disk space? Network error?
            # It doesn't really matter. Just continue...
            pass


def subrequest_item_creation(request: pyramid.request.Request, item_type: str, json_body: dict = None) -> dict:
    """
    Acting as proxy on behalf of request, this creates a new item of the given item_type with attributes per json_body.

    For example,

        subrequest_item_creation(request=request, item_type='NobelPrize',
                                 json_body={'category': 'peace', 'year': 2016))

    Args:
        request: the request on behalf of which this subrequest is done
        item_type: the name of the item item type to be created
        json_body: a python dictionary representing JSON containing data to use in initializing the newly created item

    Returns:
        a python dictionary (JSON description) of the item created

    """

    if json_body is None:
        json_body = {}
    collection_path = '/' + item_type
    method = 'POST'
    # json_utf8 = json.dumps(json_body).encode('utf-8')  # Unused, but here just in case
    check_true(not request.remote_user, "request.remote_user has %s before we set it." % request.remote_user)
    request.remote_user = 'EMBED'
    subrequest = make_subrequest(request=request, path=collection_path, method=method, json_body=json_body)
    subrequest.remote_user = 'EMBED'
    subrequest.registry = request.registry
    # Maybe...
    # validated = json_body.copy()
    # subrequest.validated = validated
    collection: Collection = subrequest.registry[COLLECTIONS][item_type]
    check_true(subrequest.json_body, "subrequest.json_body is not properly initialized.")
    check_true(not subrequest.validated, "subrequest was unexpectedly validated already.")
    check_true(not subrequest.errors, "subrequest.errors already has errors before trying to validate.")
    check_true(subrequest.remote_user == request.remote_user,
               "Mismatch: subrequest.remote_user=%r request.remote_user=%r"
               % (subrequest.remote_user, request.remote_user))
    validate_request(schema=collection.type_info.schema, request=subrequest, data=json_body)
    if not subrequest.validated:
        return {
            "@type": ["Exception"],
            "errors": subrequest.errors
        }
    else:
        json_result: dict = sno_collection_add(context=collection, request=subrequest, render=False)
        return json_result


# These next few could be in dcicutils.s3_utils as part of s3Utils, but details of interfaces would have to change.
# For now, for expedience, they can live here and we can refactor later. -kmp 25-Jul-2020

@contextlib.contextmanager
def s3_output_stream(s3_client, bucket: str, key: str):
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
        bucket: an S3 bucket name
        key: the name of a key within the given S3 bucket
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
def s3_local_file(s3_client, bucket: str, key: str):
    """
    This context manager allows one to write:

        with s3_local_file(s3_client, bucket, key) as file:
            with io.open(local_file, 'r') as fp:
                dictionary = json.load(fp)

    to do input from an s3 bucket.

    Args:
        s3_client: a client object that results from a boto3.client('s3', ...) call.
        bucket: an S3 bucket name
        key: the name of a key within the given S3 bucket
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
def s3_input_stream(s3_client, bucket: str, key: str, mode: str = 'r'):
    """
    This context manager allows one to write:

        with s3_input_stream(s3_client, bucket, key) as fp:
            dictionary = json.load(fp)

    to do input from an s3 bucket.

    In fact, an intermediate local file is created, copied, and deleted.

    Args:
        s3_client: a client object that results from a boto3.client('s3', ...) call.
        bucket: an S3 bucket name
        key: the name of a key within the given S3 bucket
        mode: an input mode acceptable to io.open
    """

    with s3_local_file(s3_client, bucket, key) as file:
        with io.open(file, mode=mode) as fp:
            yield fp


def create_empty_s3_file(s3_client, bucket: str, key: str):
    """
    Args:
        s3_client: a client object that results from a boto3.client('s3', ...) call.
        bucket: an S3 bucket name
        key: the name of a key within the given S3 bucket
    """
    empty_file = "/dev/null"
    s3_client.upload_file(empty_file, Bucket=bucket, Key=key)


def generate_fastq_file(filename, num=10, length=10):
    """
    Creates a new fastq file with the given name, containing (pseudo)randomly generated content.

    Example usage:

        fastq_generator('fastq_sample.fastq.gz', 25, 50)
           creates a new fastq file with 25 sequences, each of length 50.

        fastq_generator('fastq_sample.fastq.gz')
           creates a new fastq file with default characteristics (10 sequences, each of length 10).

    Args:
        filename str: the name of a file to create
        num int: the number of random sequences (default 10)
        length int: the length of the random sequences (default 10)

    Returns:
        the filename

    """
    if not filename.endswith('.fastq.gz'):
        filename = filename.rstrip('fastq').rstrip('fq').rstrip('.') + '.fastq.gz'
    content = ''
    bases = 'ACTG'

    for i in range(num):
        content += '@SEQUENCE{} length={}\n'.format(i, length)
        content += ''.join(random.choice(bases) for i in range(length)) + '\n'
        content += '+\n'
        content += 'I' * length + '\n'
    with gzip.open(filename, 'w') as outfile:
        outfile.write(content.encode('ascii'))

    return filename
