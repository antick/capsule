#!/usr/bin/env python3
"""Restart only the exact development bundle just built, never production."""
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import time

app = Path(sys.argv[1]).resolve()
info = plistlib.load((app / 'Contents/Info.plist').open('rb'))
source = plistlib.load((Path(__file__).resolve().parent.parent / 'Support/CapsuleApp/Info.plist').open('rb'))
if info['CFBundleIdentifier'] != source['CFBundleIdentifier'] + '.dev':
    raise SystemExit('Refusing to restart a non-development app')
executable = str(app / 'Contents/MacOS' / info['CFBundleExecutable'])
processes = subprocess.check_output(['ps', '-axww', '-o', 'pid=,comm='], text=True)
pids = [int(parts[0]) for line in processes.splitlines()
        if len(parts := line.strip().split(None, 1)) == 2 and parts[1] == executable]
for pid in pids:
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
for _ in range(50):
    remaining = []
    for pid in pids:
        try:
            os.kill(pid, 0)
            remaining.append(pid)
        except ProcessLookupError:
            pass
    if not remaining:
        break
    time.sleep(0.1)
else:
    raise SystemExit('Capsule Dev did not exit; close it before starting another copy')
subprocess.run(['open', str(app)], check=True)
