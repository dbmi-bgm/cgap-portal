import io
import os
import gzip
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
