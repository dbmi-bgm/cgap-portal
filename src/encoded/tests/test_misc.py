import os
import pytest

from dcicutils.qa_checkers import ChangeLogChecker, DebuggingArtifactChecker
from .conftest_settings import REPOSITORY_ROOT_DIR


@pytest.mark.static
def test_changelog_consistency():

    class MyAppChangeLogChecker(ChangeLogChecker):
        PYPROJECT = os.path.join(REPOSITORY_ROOT_DIR, "pyproject.toml")
        CHANGELOG = os.path.join(REPOSITORY_ROOT_DIR, "CHANGELOG.rst")

    MyAppChangeLogChecker.check_version()


@pytest.mark.static
def test_utils_debugging_artifacts_pdb():
    checker = DebuggingArtifactChecker(sources_subdir="src/encoded",
                                       skip_files="(tests/data)",
                                       filter_patterns=['pdb'])
    checker.check_for_debugging_patterns()


@pytest.mark.static
def test_utils_debugging_artifacts_print():
    checker = DebuggingArtifactChecker(sources_subdir="src/encoded",
                                       skip_files="encoded/(commands|tests)/",
                                       filter_patterns=['print'],
                                       if_used='warning')
    checker.check_for_debugging_patterns()
