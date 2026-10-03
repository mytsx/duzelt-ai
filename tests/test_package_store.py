"""Paket sınırları, manifest bağımlılıkları ve tekrarlanabilirlik regresyonları."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile


SPEC = importlib.util.spec_from_file_location('package_store', Path(__file__).resolve().parents[1] / 'tools/package-store.py')
PACKAGER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGER)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name).resolve()
        self.manifest = {
            'manifest_version': 3,
            'name': 'Örnek eklenti',
            'version': '3.4.0',
            'background': {'service_worker': 'background/background.js'},
            'action': {'default_popup': 'popup/popup.html'},
            'icons': {'128': 'icons/icon128.png'},
            'content_scripts': [{'js': ['content/bridge.js'], 'world': 'MAIN'}],
        }
        self.write_manifest()
        self.write('background/background.js', "importScripts('provider.js');")
        self.write('background/provider.js', 'const provider = {};')
        self.write('popup/popup.html', '<script src="../lib/product-config.js"></script><link rel="stylesheet" href="popup.css">')
        self.write('popup/popup.css', 'body { color: black; }')
        self.write('lib/product-config.js', 'const config = {};')
        self.write('content/bridge.js', 'void 0;')
        self.write('icons/icon128.png', b'example-icon')

    def write(self, path, data):
        destination = self.root / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data if isinstance(data, bytes) else data.encode('utf-8'))

    def write_manifest(self):
        self.write('manifest.json', json.dumps(self.manifest))

    def test_only_referenced_runtime_files_are_packaged(self):
        for path in ('lib/crypto-js.min.js', 'site/index.html', 'tests/sample.js', '.env', 'node_modules/library.js', 'output/video.mp4'):
            self.write(path, 'must not ship')
        package, files, digest = PACKAGER.build_package(self.root)
        self.assertEqual(package.name, 'duzelt-ai-3.4.0.zip')
        self.assertNotIn('lib/crypto-js.min.js', files)
        self.assertIn('background/provider.js', files)
        self.assertIn('content/bridge.js', files)
        self.assertIn('lib/product-config.js', files)
        self.assertEqual(len(files), 8)
        with ZipFile(package) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.namelist(), sorted(files))
            self.assertEqual(json.loads(archive.read('manifest.json')), self.manifest)
        self.assertIn(digest, package.with_suffix('.zip.sha256').read_text())

    def test_same_sources_produce_identical_zip_after_mtime_change(self):
        package, files, digest = PACKAGER.build_package(self.root)
        before = package.read_bytes()
        for path in files:
            os.utime(self.root / path, (1700000000, 1700000000))
        package, _, next_digest = PACKAGER.build_package(self.root)
        self.assertEqual(before, package.read_bytes())
        self.assertEqual(digest, next_digest)

    def test_missing_manifest_dependency_is_rejected(self):
        (self.root / 'content/bridge.js').unlink()
        with self.assertRaisesRegex(ValueError, 'eksik'):
            PACKAGER.build_package(self.root)

    def test_unapproved_and_traversing_references_are_rejected(self):
        for reference in ('site/index.html', '../outside.js', 'lib/.env.js', 'https://example.org/script.js', 'content/*.js'):
            with self.subTest(reference=reference):
                self.manifest['content_scripts'][0]['js'] = [reference]
                self.write_manifest()
                with self.assertRaises(ValueError):
                    PACKAGER.build_package(self.root)

    def test_symlink_dependencies_are_rejected(self):
        target = self.root / 'background/provider.js'
        original = target.read_bytes()
        target.unlink()
        self.write('lib/alias.js', original)
        target.symlink_to(self.root / 'lib/alias.js')
        with self.assertRaisesRegex(ValueError, 'sembolik'):
            PACKAGER.build_package(self.root)

    def test_dynamic_import_and_remote_script_are_rejected(self):
        self.write('background/background.js', 'importScripts(userPath);')
        with self.assertRaisesRegex(ValueError, 'sabit'):
            PACKAGER.build_package(self.root)
        self.write('background/background.js', "importScripts('provider.js');")
        self.write('popup/popup.html', '<script src="https://example.org/code.js"></script>')
        with self.assertRaisesRegex(ValueError, 'yerel'):
            PACKAGER.build_package(self.root)

    def test_css_and_runtime_get_url_assets_are_included(self):
        self.write('popup/popup.css', 'body { background-image: url(../icons/back.svg); }')
        self.write('icons/back.svg', '<svg/>')
        self.write('background/provider.js', "chrome.runtime.getURL('lib/extra.json');")
        self.write('lib/extra.json', '{}')
        _, files, _ = PACKAGER.build_package(self.root)
        self.assertIn('icons/back.svg', files)
        self.assertIn('lib/extra.json', files)


if __name__ == '__main__':
    unittest.main()
