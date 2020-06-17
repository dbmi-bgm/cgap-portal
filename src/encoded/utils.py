import contextlib
import warnings
import typing

# This should move to dcicutils.misc_utils for better sharing
@contextlib.contextmanager
def filtered_warnings(action, message: str="", category: typing.Type[Warning]=Warning,
                      module: str="", lineno: int=0, append: bool=False):
    """
    Context manager temporarily filters deprecation messages for the duration of the body.
    Used otherwise the same as warnings.filterwarnings would be used.

    Note: This is not threadsafe. It's OK while loading system and during testing,
          but not in worker threads.
    """
    with warnings.catch_warnings():
        warnings.filterwarnings(action, message=message, category=category, module=module,
                                lineno=lineno, append=append)
        yield
