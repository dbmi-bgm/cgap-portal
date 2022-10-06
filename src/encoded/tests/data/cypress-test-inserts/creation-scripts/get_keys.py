"""
Grab CGAP user keys from ~/.cgap-keys.json.
"""

import json
from pathlib import Path


KEYS_FILE = Path.home().joinpath(".cgap-keys.json")

with KEYS_FILE.open() as file_handle:
    keys = json.load(file_handle)
