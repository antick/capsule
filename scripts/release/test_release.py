import base64
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('appcast', Path(__file__).with_name('validate-appcast.py'))
appcast = importlib.util.module_from_spec(spec)
spec.loader.exec_module(appcast)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.info = dict(CFBundleVersion='2', CFBundleShortVersionString='0.2.0', LSMinimumSystemVersion='14.0')
        (self.root / 'Capsule-0.2.0-arm64.zip').write_bytes(b'archive')
        self.xml = '''<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><item>
<sparkle:version>2</sparkle:version><sparkle:shortVersionString>0.2.0</sparkle:shortVersionString>
<sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>
<enclosure url="https://github.com/antick/capsule/releases/download/v0.2.0/Capsule-0.2.0-arm64.zip"
length="7" sparkle:edSignature="SIGNATURE"/></item></channel></rss>'''.replace('SIGNATURE', base64.b64encode(bytes(64)).decode())

    def tearDown(self):
        self.temp.cleanup()

    def validate(self, xml):
        path = self.root / 'appcast.xml'
        path.write_text(xml)
        appcast.validate(path, self.info, self.root)

    def test_valid_metadata(self):
        self.validate(self.xml)

    def test_rejects_wrong_build_url_size_signature_and_os(self):
        replacements = [('>2<', '>1<'), ('https://github.com/', 'https://evil.example/'),
                        ('length="7"', 'length="8"'), ('edSignature="', 'edSignature="!'),
                        ('>14.0<', '>13.0<')]
        for before, after in replacements:
            with self.subTest(before=before), self.assertRaises(ValueError):
                self.validate(self.xml.replace(before, after))

    def test_rejects_empty_feed(self):
        with self.assertRaises(ValueError):
            self.validate('<rss><channel/></rss>')


if __name__ == '__main__':
    unittest.main()
