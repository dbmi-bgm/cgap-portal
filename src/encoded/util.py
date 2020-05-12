import os


def resolve_file_path(path):
    """ Takes a relative path from this file location and returns an absolute path to
        the desired file, needed for WSGI to resolve embed files
    """
    path_to_this_file = os.path.abspath(__file__)
    return os.path.join(path_to_this_file, path)