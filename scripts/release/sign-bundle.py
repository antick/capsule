#!/usr/bin/env python3
"""Thin every nested binary before signing nested code from the inside out."""
import pathlib
import subprocess
import sys

app = pathlib.Path(sys.argv[1])
identity, timestamp = sys.argv[2:]


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT).strip()


binaries = []
for path in app.rglob('*'):
    if path.is_symlink() or not path.is_file():
        continue
    if 'Mach-O' not in run('file', '-b', str(path)):
        continue
    architectures = run('lipo', '-archs', str(path)).split()
    if 'arm64' not in architectures:
        raise SystemExit(f'No Apple silicon slice: {path}')
    if architectures != ['arm64']:
        temp = path.with_name(path.name + '.arm64')
        run('lipo', str(path), '-thin', 'arm64', '-output', str(temp))
        temp.chmod(path.stat().st_mode)
        temp.replace(path)
    binaries.append(path)

# Sign every Mach-O, then each enclosing bundle. Never use --deep for signing.
bundles = [p for p in app.rglob('*') if p.is_dir() and not p.is_symlink()
           and p.suffix in ('.app', '.xpc', '.framework')]
for path in sorted(set(binaries + bundles), key=lambda p: len(p.parts), reverse=True) + [app]:
    args = ['codesign', '--force', '--sign', identity, timestamp]
    if identity != '-':
        args += ['--options', 'runtime']
    run(*args, str(path))
run('codesign', '--verify', '--deep', '--strict', str(app))
print(f'Signed {len(binaries)} Apple silicon binaries in {app.name}', file=sys.stderr)
