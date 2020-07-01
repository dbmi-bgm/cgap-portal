import io
import os
import pytest

from unittest import mock
from ..util import MockFileSystem


def test_mock_file_system():

    fs = MockFileSystem()

    with mock.patch.object(io, "open") as mock_open:
        with mock.patch.object(os.path, "exists") as mock_exists:
            with mock.patch.object(os, "remove") as mock_remove:

                mock_open.side_effect = fs.open
                mock_exists.side_effect = fs.exists
                mock_remove.side_effect = fs.remove

                filename = "no.such.file"
                assert os.path.exists(filename) is False

                with io.open(filename, 'w') as fp:
                    fp.write("foo")
                    fp.write("bar")

                assert os.path.exists(filename) is True

                with io.open(filename, 'r') as fp:
                    assert fp.read() == 'foobar'

                with io.open(filename, 'r') as fp:
                    assert fp.read() == 'foobar'

                assert os.path.exists(filename) is True

                os.remove(filename)

                assert os.path.exists(filename) is False

                with pytest.raises(FileNotFoundError):
                    os.remove(filename)

                with pytest.raises(FileNotFoundError):
                    io.open(filename, 'r')
