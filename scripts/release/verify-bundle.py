#!/usr/bin/env python3
"""Verify the finished app, including all nested architectures and signatures."""
from pathlib import Path
import plistlib
import subprocess
import sys

app = Path(sys.argv[1])
info = plistlib.load((app / 'Contents/Info.plist').open('rb'))
source = plistlib.load(Path('Support/CapsuleApp/Info.plist').open('rb'))
for key in ('CFBundleIdentifier', 'CFBundleVersion', 'CFBundleShortVersionString', 'SUPublicEDKey', 'SUFeedURL'):
    if info.get(key) != source.get(key):
        raise SystemExit(f'Packaged {key} does not match release source')
requirement = ('anchor apple generic and identifier "com.antick.capsule" '
               'and certificate leaf[subject.OU] = "2L85KT5GNL" '
               'and certificate leaf[field.1.2.840.113635.100.6.1.13] exists')
subprocess.run(['codesign', '--verify', '--deep', '--strict', '-R', '=' + requirement, str(app)], check=True)
count = 0
for path in app.rglob('*'):
    if path.is_symlink() or not path.is_file():
        continue
    kind = subprocess.check_output(['file', '-b', str(path)], text=True)
    if 'Mach-O' in kind:
        arch = subprocess.check_output(['lipo', '-archs', str(path)], text=True).strip()
        if arch != 'arm64':
            raise SystemExit(f'Unexpected architecture {arch}: {path}')
        count += 1
if not count:
    raise SystemExit('No executable code in bundle')
subprocess.run(['xcrun', 'stapler', 'validate', str(app)], check=True)
subprocess.run(['spctl', '--assess', '--type', 'execute', '--verbose=4', str(app)], check=True)
print(f'Verified signed, notarized app and {count} arm64-only binaries.')
