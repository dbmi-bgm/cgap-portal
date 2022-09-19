import os

from dcicutils.qa_utils import ChangeLogChecker
from .conftest_settings import REPOSITORY_ROOT_DIR


def test_changelog_consistency():

    class MyAppChangeLogChecker(ChangeLogChecker):
        PYPROJECT = os.path.join(REPOSITORY_ROOT_DIR, "pyproject.toml")
        CHANGELOG = os.path.join(REPOSITORY_ROOT_DIR, "CHANGELOG.rst")

    MyAppChangeLogChecker.check_version()
