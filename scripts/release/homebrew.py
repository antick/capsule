#!/usr/bin/env python3
"""Point the Homebrew tap's cask at a published release.

  python3 scripts/release/homebrew.py <version> <zip> [--no-cli] [--print]

Renders Support/Homebrew/capsule.rb.template with the release's version and
the zip's SHA-256, checks that digest against the published release asset,
and commits the cask to antick/homebrew-tap through the contents API, which
refuses to overwrite a newer file. Needs GH_TOKEN with write access to the
tap; without one it warns and stops, so a release never fails on it.
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

TAP = 'antick/homebrew-tap'
CASK = 'Casks/capsule.rb'
TEMPLATE = Path(__file__).resolve().parents[2] / 'Support/Homebrew/capsule.rb.template'
BINARY = '  binary "#{appdir}/Capsule.app/Contents/Helpers/capsule"\n'


def render(version, sha256, cli=True):
    text = TEMPLATE.read_text()
    return (text.replace('{{version}}', version).replace('{{sha256}}', sha256)
            .replace('{{binary}}\n', BINARY if cli else ''))


def gh(*args, data=None):
    result = subprocess.run(['gh', 'api', *args], input=data, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f'gh api {args[0]} failed: {result.stderr.strip()}')
    return json.loads(result.stdout) if result.stdout.strip() else {}


def main(argv):
    flags = {a for a in argv if a.startswith('--')}
    version, archive = [a for a in argv if not a.startswith('--')]
    digest = hashlib.sha256(Path(archive).read_bytes()).hexdigest()
    cask = render(version, digest, cli='--no-cli' not in flags)
    if '--print' in flags:
        print(cask, end='')
        return
    if not os.environ.get('GH_TOKEN'):
        print('warning: HOMEBREW_TAP_TOKEN is not set; the Homebrew cask was not updated.', file=sys.stderr)
        return
    assets = gh(f'repos/antick/capsule/releases/tags/v{version}')['assets']
    published = {a['name']: a.get('digest') for a in assets}
    if published.get(Path(archive).name) != f'sha256:{digest}':
        raise SystemExit('The published zip does not match the one built; the cask was not updated.')
    current = gh(f'repos/{TAP}/contents/{CASK}')
    if base64.b64decode(current['content']).decode() == cask:
        print('Homebrew cask already current.')
        return
    body = json.dumps({
        'message': f'chore: update capsule to {version}',
        'content': base64.b64encode(cask.encode()).decode(),
        'sha': current['sha'],
        'branch': 'main',
    })
    gh('-X', 'PUT', f'repos/{TAP}/contents/{CASK}', '--input', '-', data=body)
    print(f'Homebrew cask updated to {version}.')


if __name__ == '__main__':
    main(sys.argv[1:])
