#!/usr/bin/env python3
"""CI-only credential import. Never print subprocess arguments or secret values."""
import base64
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys

REQUIRED = ('MAC_CERTIFICATE', 'MAC_CERTIFICATE_PASSWORD', 'APPLE_API_KEY_P8',
            'APPLE_API_KEY_ID', 'APPLE_API_ISSUER', 'SPARKLE_PRIVATE_KEY', 'RUNNER_TEMP', 'GITHUB_ENV')


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(f'{args[0]} {args[1]} failed; secret-bearing output withheld')
    return result.stdout.strip()


def prepare():
    missing = [name for name in REQUIRED if not os.environ.get(name)]
    if missing:
        raise SystemExit('Missing required release secrets: ' + ', '.join(missing))
    directory = Path(os.environ['RUNNER_TEMP']) / 'capsule-signing'
    directory.mkdir(mode=0o700, exist_ok=True)
    previous = [json.loads(line.strip()) for line in run('security', 'list-keychains', '-d', 'user').splitlines()]
    (directory / 'search-list.json').write_text(json.dumps(previous))
    keychain = str(directory / 'release.keychain-db')
    password = secrets.token_hex(32)
    certificate = directory / 'certificate.p12'
    certificate.write_bytes(base64.b64decode(os.environ['MAC_CERTIFICATE'], validate=True))
    api_key = directory / 'AuthKey.p8'
    api_key.write_text(os.environ['APPLE_API_KEY_P8'])
    update_key = directory / 'sparkle-key'
    update_key.write_text(os.environ['SPARKLE_PRIVATE_KEY'].strip())
    for path in (certificate, api_key, update_key):
        path.chmod(0o600)
    run('security', 'create-keychain', '-p', password, keychain)
    run('security', 'set-keychain-settings', '-lut', '21600', keychain)
    run('security', 'unlock-keychain', '-p', password, keychain)
    run('security', 'list-keychains', '-d', 'user', '-s', keychain, *previous)
    run('security', 'import', 'Support/Signing/DeveloperIDG2CA.cer', '-k', keychain)
    run('security', 'import', str(certificate), '-k', keychain, '-P',
        os.environ['MAC_CERTIFICATE_PASSWORD'], '-T', '/usr/bin/codesign', '-T', '/usr/bin/security')
    run('security', 'set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', password, keychain)
    certificate.unlink()
    identities = run('security', 'find-identity', '-v', '-p', 'codesigning', keychain)
    matches = [line.split()[1] for line in identities.splitlines() if 'Developer ID Application:' in line]
    if len(set(matches)) != 1:
        raise SystemExit('Expected one Developer ID signing identity')
    run('xcrun', 'notarytool', 'store-credentials', 'capsule-notary', '--keychain', keychain,
        '--key', str(api_key), '--key-id', os.environ['APPLE_API_KEY_ID'], '--issuer', os.environ['APPLE_API_ISSUER'])
    api_key.unlink()
    with open(os.environ['GITHUB_ENV'], 'a') as output:
        output.write(f'CAPSULE_SIGN_IDENTITY={matches[0]}\nNOTARY_PROFILE=capsule-notary\n')
        output.write(f'NOTARY_KEYCHAIN={keychain}\nSPARKLE_KEY_FILE={update_key}\n')
    print('Temporary signing keychain and notarization profile are ready.')


if __name__ == '__main__':
    prepare()
