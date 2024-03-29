"""
Based on environment variables make a config file (production.ini) for our encoded application.
"""

import os
from dcicutils.deployment_utils import BasicLegacyCGAPIniFileManager


class ProductionIniFileManager(BasicLegacyCGAPIniFileManager):
    _MY_DIR = os.path.dirname(__file__)
    TEMPLATE_DIR = os.path.join(_MY_DIR, "ini_files")
    PYPROJECT_FILE_NAME = os.path.join(os.path.dirname(_MY_DIR), "pyproject.toml")


def main():
    ProductionIniFileManager.main()


if __name__ == '__main__':
    main()
