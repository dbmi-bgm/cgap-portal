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
    if file_loc:
        path_to_this_file = os.path.abspath(os.path.dirname(file_loc))
    else:
        path_to_this_file = os.path.abspath(ENCODED_ROOT_DIR)
    return os.path.join(path_to_this_file, path)


def deduplicate_list(lst):
    """ De-duplicates the given list by converting it to a set then back to a list.

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


# TODO: Move this mock file system to dcicutils. -kmp 30-Jun-2020

FILE_SYSTEM_VERBOSE = True

class MockFileSystem:
    """Extremely low-tech mock file system."""

    def __init__(self):
        self.files = {}

    def exists(self, file):
        return bool(self.files.get(file))

    def remove(self, file):
        if not self.files.pop(file, None):
            raise FileNotFoundError("No such file or directory: %s" % file)

    def open(self, file, mode='r'):
        if FILE_SYSTEM_VERBOSE: print("Opening %r in mode %r." % (file, mode))
        if mode == 'w':
            return self._open_for_write(file_system=self, file=file)
        elif mode == 'r':
            return self._open_for_read(file)
        else:
            raise AssertionError("Mocked io.open doesn't handle mode=%r." % mode)

    def _open_for_read(self, file):
        text = self.files.get(file)
        if text is None:
            raise FileNotFoundError("No such file or directory: %s" % file)
        if FILE_SYSTEM_VERBOSE: print("Read %s to %s." % (text, file))
        return io.StringIO(text)

    def _open_for_write(self, file_system, file):

        class MockFileWriter:

            def __init__(self, file_system, file):
                self.file_system = file_system
                self.file = file
                self.stream = io.StringIO()

            def __enter__(self):
                return self.stream

            def __exit__(self, exc_type, exc_val, exc_tb):
                text = self.stream.getvalue()
                if FILE_SYSTEM_VERBOSE: print("Writing %s to %s." % (text, file))
                self.file_system.files[file] = text

        return MockFileWriter(file_system=file_system, file=file)


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
