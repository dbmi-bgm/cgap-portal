import warnings

from ..utils import filtered_warnings


def test_filtered_warnings():

    def expect_warnings(pairs):
        with warnings.catch_warnings(record=True) as w:
            # Trigger a warning.
            warnings.warn("oh, this is deprecated for sure", DeprecationWarning)  # noqa
            warnings.warn("tsk, tsk, tsk, what ugly code", SyntaxWarning)  # noqa
            # Verify some things
            for expected_count, expected_type in pairs:
                count = 0
                for warning in w:
                    if issubclass(warning.category, expected_type):
                        count += 1
                assert count == expected_count

    expect_warnings([(2, Warning), (1, DeprecationWarning), (1, SyntaxWarning)])

    with filtered_warnings("ignore"):
        expect_warnings([(0, Warning), (0, DeprecationWarning), (0, SyntaxWarning)])

    with filtered_warnings("ignore", category=Warning):
        expect_warnings([(0, Warning), (0, DeprecationWarning), (0, SyntaxWarning)])

    with filtered_warnings("ignore", category=DeprecationWarning):
        expect_warnings([(1, Warning), (0, DeprecationWarning), (1, SyntaxWarning)])

    with filtered_warnings("ignore", category=SyntaxWarning):
        expect_warnings([(1, Warning), (1, DeprecationWarning), (0, SyntaxWarning)])
