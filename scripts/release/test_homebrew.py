import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('homebrew', pathlib.Path(__file__).with_name('homebrew.py'))
homebrew = importlib.util.module_from_spec(spec)
spec.loader.exec_module(homebrew)


class HomebrewCaskTests(unittest.TestCase):
    def test_renders_version_digest_and_the_command(self):
        cask = homebrew.render('1.2.3', 'ab' * 32)
        self.assertIn('version "1.2.3"', cask)
        self.assertIn('sha256 "' + 'ab' * 32 + '"', cask)
        self.assertIn('Contents/Helpers/capsule', cask)
        self.assertNotIn('{{', cask)

    def test_leaves_the_command_out_for_releases_without_it(self):
        cask = homebrew.render('0.3.0', 'cd' * 32, cli=False)
        self.assertNotIn('binary', cask)
        self.assertNotIn('{{', cask)


if __name__ == '__main__':
    unittest.main()
