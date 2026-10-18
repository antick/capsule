#!/usr/bin/env python3
import base64
from pathlib import Path
import plistlib
import sys
import xml.etree.ElementTree as ET

SPARKLE = '{http://www.andymatuschak.org/xml-namespaces/sparkle}'


def validate(path, info, artifacts):
    tree = ET.parse(path)
    items = tree.findall('./channel/item')
    if len(items) != 1:
        raise ValueError('Expected exactly one current release in feed')
    item = items[0]
    if item.findtext(SPARKLE + 'version') != info['CFBundleVersion']:
        raise ValueError('Feed build does not match bundle')
    if item.findtext(SPARKLE + 'shortVersionString') != info['CFBundleShortVersionString']:
        raise ValueError('Feed version does not match bundle')
    enclosure = item.find('enclosure')
    name = f"Capsule-{info['CFBundleShortVersionString']}-arm64.zip"
    expected_url = f"https://github.com/antick/capsule/releases/download/v{info['CFBundleShortVersionString']}/{name}"
    if enclosure is None or enclosure.get('url') != expected_url:
        raise ValueError('Unexpected download URL')
    if int(enclosure.get('length', '0')) != (artifacts / name).stat().st_size:
        raise ValueError('Archive size mismatch')
    signature = base64.b64decode(enclosure.get(SPARKLE + 'edSignature', ''), validate=True)
    if len(signature) != 64:
        raise ValueError('Missing or invalid archive signature')
    if item.findtext(SPARKLE + 'minimumSystemVersion') != info['LSMinimumSystemVersion']:
        raise ValueError('Minimum macOS version mismatch')


if __name__ == '__main__':
    info = plistlib.load(open('Support/CapsuleApp/Info.plist', 'rb'))
    validate(Path(sys.argv[1]), info, Path('.build/release-artifacts'))
    print('Appcast version, URL, signature metadata, size and OS requirement verified.')
