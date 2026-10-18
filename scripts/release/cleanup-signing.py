#!/usr/bin/env python3
import json
import os
from pathlib import Path
import shutil
import subprocess

root = Path(os.environ['RUNNER_TEMP']) / 'capsule-signing'
previous = root / 'search-list.json'
if previous.exists():
    subprocess.run(['security', 'list-keychains', '-d', 'user', '-s', *json.loads(previous.read_text())], check=True)
keychain = root / 'release.keychain-db'
if keychain.exists():
    subprocess.run(['security', 'delete-keychain', str(keychain)], check=True)
if root.exists():
    shutil.rmtree(root)
