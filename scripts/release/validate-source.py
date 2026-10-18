#!/usr/bin/env python3
"""A release must be a new, versioned main-branch commit, never a moving ref."""
import os
from pathlib import Path
import plistlib
import re
import subprocess


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


info = plistlib.load(Path('Support/CapsuleApp/Info.plist').open('rb'))
version = info['CFBundleShortVersionString']
build = info['CFBundleVersion']
if not re.fullmatch(r'\d+\.\d+\.\d+', version) or not build.isdigit() or int(build) < 1:
    raise SystemExit('Release requires a semantic version and positive numeric build')
expected = 'refs/tags/v' + version
if os.environ.get('GITHUB_REF', expected) != expected:
    raise SystemExit('Release ref must match Info.plist version')
if git('status', '--porcelain'):
    raise SystemExit('Release source is dirty')
if git('rev-parse', 'HEAD') != git('rev-parse', f'v{version}^{{commit}}'):
    raise SystemExit('Release tag does not match checked-out commit')
subprocess.run(['git', 'merge-base', '--is-ancestor', 'HEAD', 'origin/main'], check=True)
for tag in git('tag', '--list', 'v*').splitlines():
    if tag == 'v' + version:
        continue
    result = subprocess.run(['git', 'show', f'{tag}:Support/CapsuleApp/Info.plist'], capture_output=True)
    if result.returncode == 0:
        old = plistlib.loads(result.stdout)
        if tuple(map(int, old['CFBundleShortVersionString'].split('.'))) >= tuple(map(int, version.split('.'))):
            raise SystemExit('Version must increase beyond previous native releases')
        if int(old['CFBundleVersion']) >= int(build):
            raise SystemExit('Build number must increase beyond previous native releases')
subprocess.run(['scripts/release-notes.sh', '--check'], check=True)
print('Release source, tag, build number and changelog verified.')
