import datetime
import io
import os
import pytest
import tempfile

from unittest import mock
from dcicutils.qa_utils import ControlledTime
from ..util import debuglog, deduplicate_list, gunzip_content, resolve_file_path, ENCODED_ROOT_DIR, check_true
from .. import util as util_module


def test_check_true():

    x = [1, 2, 3]
    check_true(x == [1, 2, 3], "x is not a list of one, two, and three.")

    msg = "x is not a list of four, five, and six."
    with pytest.raises(RuntimeError) as e:
        check_true(x == [4, 5, 6], msg)
    assert msg in str(e)


def test_deduplicate_list():

    def sort_somehow(seq):
        """Ordinarily, sorted would not compare type string and number. This just makes an arbitrary choice on that."""
        return sorted(seq, key=lambda x: (type(x).__name__, x))

    def test_it(test_value, pre_sorted_expectation):
        assert sort_somehow(deduplicate_list(test_value)) == pre_sorted_expectation

    assert deduplicate_list([]) == []

    abc = sort_somehow(['a', 'b', 'c'])
    onetwothree = sort_somehow([1, 2, 3])
    a1b2c3 = sort_somehow(['a', 1, 'b', 2, 'c', 3])

    test_it(onetwothree, onetwothree)
    test_it(abc, abc)
    test_it(a1b2c3, a1b2c3)
    test_it(onetwothree + onetwothree, onetwothree)
    test_it(sort_somehow(onetwothree + onetwothree), onetwothree)
    test_it(abc + abc, abc)
    test_it(sort_somehow(abc + abc), abc)
    test_it(a1b2c3 + a1b2c3, a1b2c3)
    test_it(sort_somehow(a1b2c3 + a1b2c3), a1b2c3)

    # It works on tuples, too. They become lists.
    test_it((), [])
    test_it(tuple(onetwothree), onetwothree)
    test_it(tuple(abc), abc)
    test_it(tuple(a1b2c3), a1b2c3)
    test_it(tuple(onetwothree) + tuple(onetwothree), onetwothree)
    test_it(tuple(abc) + tuple(abc), abc)
    test_it(tuple(a1b2c3) + tuple(a1b2c3), a1b2c3)
    test_it(sort_somehow(tuple(a1b2c3) + tuple(a1b2c3)), a1b2c3)

    with pytest.raises(Exception):
        # Lists cannot be hashed, so converting to a test will fail here.
        list_of_lists = [[1], [2], [3]]
        test_it(list_of_lists, list_of_lists)


def test_resolve_file_path():

    fake_working_dir = "/some/working/dir"
    fake_homedir = "/home/user"

    with mock.patch("os.path.abspath") as mock_abspath:
        with mock.patch("os.path.expanduser") as mock_expanduser:

            def mocked_abspath(x):
                if not x.startswith("/"):
                    return os.path.join(fake_working_dir, x)
                else:
                    return x

            def mocked_expanduser(x):
                if x.startswith("~/"):
                    return os.path.join(fake_homedir, x[2:])
                elif x.startswith("~"):
                    raise AssertionError("Beyond scope of this mock.")
                else:
                    return x

            mock_abspath.side_effect = mocked_abspath
            mock_expanduser.side_effect = mocked_expanduser

            # In a Python Listener with no mocking:
            #   >>> resolve_file_path("")
            #   '/Users/kentpitman/py/cgap-portal9/src/encoded/'
            #   >>> resolve_file_path("/foo/bar/baz")
            #   '/foo/bar/baz'
            #   >>> resolve_file_path("foo/bar/baz")
            #   '/Users/kentpitman/py/cgap-portal9/src/encoded/foo/bar/baz'

            assert resolve_file_path("/foo/bar/baz") == "/foo/bar/baz"
            assert resolve_file_path("") == os.path.join(ENCODED_ROOT_DIR, "")

            assert resolve_file_path("foo/bar/baz") == os.path.join(ENCODED_ROOT_DIR, "foo/bar/baz")

            # In a Python Listener with no mocking:
            #
            #   >>> resolve_file_path("foo/bar/baz", "/some/given/dir")
            #   '/some/given/foo/bar/baz'
            #   >>> resolve_file_path("foo/bar/baz", "/some/given/dir/")
            #   '/some/given/dir/foo/bar/baz'
            #   >>> resolve_file_path("foo/bar/baz", "/some/given/dir/omega.py")
            #   '/some/given/dir/foo/bar/baz'

            assert resolve_file_path("foo/bar/baz", "/some/given/dir") == "/some/given/foo/bar/baz"
            assert resolve_file_path("foo/bar/baz", "/some/given/dir/") == "/some/given/dir/foo/bar/baz"
            assert resolve_file_path("foo/bar/baz", "/some/given/dir/omega.py") == "/some/given/dir/foo/bar/baz"

            # In a Python Listener with no mocking:
            #
            #   >>> resolve_file_path("foo/bar/baz", "~/alpha/beta")
            #   '/Users/kentpitman/alpha/foo/bar/baz'
            #   >>> resolve_file_path("foo/bar/baz", "~/alpha/beta/")
            #   '/Users/kentpitman/alpha/beta/foo/bar/baz'
            #   >>> resolve_file_path("foo/bar/baz", "~/alpha/beta/omega.py")
            #   '/Users/kentpitman/alpha/beta/foo/bar/baz'

            assert resolve_file_path("foo/bar/baz", "~/alpha/beta") == "/home/user/alpha/foo/bar/baz"
            assert resolve_file_path("foo/bar/baz", "~/alpha/beta/") == "/home/user/alpha/beta/foo/bar/baz"
            assert resolve_file_path("foo/bar/baz", "~/alpha/beta/omega.py") == "/home/user/alpha/beta/foo/bar/baz"

            # In a Python Listener with no mocking:
            #
            #   >>> resolve_file_path("~/foo/bar")
            #   '/Users/kentpitman/foo/bar'
            #   >>> resolve_file_path("~/foo/bar", "/some/working/dir")
            #   '/Users/kentpitman/foo/bar'

            assert resolve_file_path("~/foo/bar") == "/home/user/foo/bar"
            assert resolve_file_path("~/foo/bar", "/some/working/dir") == "/home/user/foo/bar"


def test_gunzip_content():

    uncompressed_filename = resolve_file_path("tests/data/documents/some-data.txt")
    compressed_filename = resolve_file_path("tests/data/documents/some-data.txt.gz")

    with io.open(uncompressed_filename, 'r') as fp:
        text_content = fp.read()

    with io.open(compressed_filename, 'rb') as fp:
        binary_content = fp.read()

    assert gunzip_content(content=binary_content) == text_content


def test_debuglog():

    filename = tempfile.mktemp()

    some_start_time = datetime.datetime(2010, 7, 4, 12, 30)  # Just a randomly chosen date

    dt = ControlledTime(initial_time=some_start_time, tick_seconds=1/128)

    fake_homedir = "/home/user"

    with mock.patch("os.path.expanduser") as mock_expanduser:

        def mocked_expanduser(x):
            if x.startswith("~/"):
                return os.path.join(fake_homedir, x[2:])
            elif x.startswith("~"):
                raise AssertionError("Beyond scope of this mock.")
            else:
                return x

        mock_expanduser.side_effect = mocked_expanduser

        with mock.patch.object(datetime, "datetime", dt):

            real_open = io.open

            with mock.patch.object(io, "open") as mock_open:

                def mocked_open(file, mode):
                    assert file == "/home/user/DEBUGLOG-20100704.txt"
                    print("Writing to", filename, "mode=", mode)
                    return real_open(filename, mode)

                mock_open.side_effect = mocked_open

                with mock.patch.object(util_module, 'DEBUGLOG_ENABLED', False):

                    debuglog("test 1")
                    debuglog("test 2")

                    assert not os.path.exists(filename)

                with mock.patch.object(util_module, 'DEBUGLOG_ENABLED', True):

                    debuglog("test 1")
                    debuglog("test 2")

            with io.open(filename, 'r') as fp:
                text_content = fp.read()

            assert text_content == (
                "2010-07-04 12:30:00.007812 test 1\n"
                "2010-07-04 12:30:00.015624 test 2\n"
            )
