"""Site source drift, no-JavaScript fallbacks and publication-boundary regressions."""

import importlib.util
from html.parser import HTMLParser
import json
from pathlib import Path
import struct
import tempfile
import unittest
import xml.etree.ElementTree as ET


SPEC = importlib.util.spec_from_file_location('prepare_site', Path(__file__).resolve().parents[1] / 'tools/prepare-site.py')
SITE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SITE)


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, text):
        self.parts.append(text)


class PrepareSiteTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name).resolve()
        self.product = {
            'name': 'AI Türkçe Metin Düzeltici', 'developer': 'Mehmet Yerli',
            'website': 'https://github.com/mytsx/duzelt-ai', 'support': 'https://github.com/mytsx/duzelt-ai/issues',
            'privacy': 'https://github.com/mytsx/duzelt-ai/blob/main/PRIVACY.md',
            'plannedWebsite': 'https://duzelt.yerli.dev/', 'plannedSupport': 'https://duzelt.yerli.dev/support/',
            'plannedPrivacy': 'https://duzelt.yerli.dev/privacy/', 'repository': 'https://github.com/mytsx/duzelt-ai',
            'issues': 'https://github.com/mytsx/duzelt-ai/issues', 'developerWebsite': 'https://yerli.dev/',
            'contactEmail': 'iletisim@mehmetyerli.com', 'publishedVersion': '3.3.0', 'publishedVersionVerifiedOn': '2026-10-03',
            'store': 'https://chromewebstore.google.com/detail/example', 'video': None, 'videoDurationSeconds': None,
        }
        self.manifest = {'name': self.product['name'], 'version': '3.4.0', 'minimum_chrome_version': '111', 'icons': {str(size): f'icons/icon{size}.png' for size in (16, 48, 128)}}
        self.write_sources()
        self.write('PRIVACY.md', '# AI Türkçe Metin Düzeltici — Gizlilik Politikası\n\nSon güncelleme: 3 Ekim 2026\n\n## İletişim ve veriler\n\n**Düzelt** ile `metin` paylaşılır.\n\n- [E-posta](mailto:iletisim@mehmetyerli.com)\n- [Kaynak](https://github.com/mytsx/duzelt-ai)\n')
        for page in (*SITE.PAGES, '404.html'):
            canonical = '<meta name="robots" content="noindex">' if page == '404.html' else '<link rel="canonical" href="https://old.example/"><meta property="og:url" content="https://old.example/">'
            content = '<!doctype html><html><head>' + canonical + '<meta property="og:image" content="https://old.example/og.png"><meta property="og:site_name" content="Eski ad"><meta name="author" content="Eski kişi"></head><body><a data-link="store" href="https://old.example/">Mağaza</a><a href="mailto:old@example.com" data-link="email"><span>old@example.com</span></a><a data-link="repository" href="https://old.example/repo"><strong>Kaynak</strong><span>old.example/repo</span></a><span data-config="version">old</span><span data-config="minimumChromeVersion">old</span><span data-version-note>Mağaza <span data-config="publishedVersion">old</span></span>'
            if page == 'privacy/index.html':
                content += '<article data-toc-source><!-- privacy:start -->old policy<!-- privacy:end --></article>'
            self.write('site/' + page, content + '</body></html>')
        self.write('site/_preview/video.html', '<span data-config="version">old</span>')
        self.write('site/README.md', 'Local documentation')
        for size in (16, 48, 128):
            self.write(f'icons/icon{size}.png', b'\x89PNG\r\n\x1a\n' + struct.pack('>I', 13) + b'IHDR' + struct.pack('>II', size, size) + b'fixture')
        for name in SITE.SCREENSHOTS:
            self.write('design/claude-assets/' + name, ('public fixture ' + name).encode())

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content if isinstance(content, bytes) else content.encode())

    def write_sources(self):
        self.write('manifest.json', json.dumps(self.manifest))
        fields = '\n'.join('    ' + key + ': ' + json.dumps(value, ensure_ascii=False) + ',' for key, value in self.product.items())
        self.write('lib/product-config.js', 'const PRODUCT_CONFIG = Object.freeze({\n' + fields + '\n});\n')

    def read(self, relative):
        return (self.root / relative).read_text()

    def test_prepare_is_idempotent_and_keeps_unchanged_mtimes(self):
        self.assertIn('site/privacy/index.html', SITE.prepare(self.root))
        files = SITE.expected_files(self.root)
        before = {name: (self.root / name).stat().st_mtime_ns for name in files}
        self.assertEqual(SITE.prepare(self.root), [])
        self.assertEqual(SITE.prepare(self.root, check=True), [])
        self.assertEqual(before, {name: (self.root / name).stat().st_mtime_ns for name in files})

    def test_check_reports_drift_without_changing_any_file(self):
        SITE.prepare(self.root)
        for relative in ('site/assets/js/config.js', 'site/privacy/index.html', 'site/index.html', 'site/robots.txt', 'site/sitemap.xml', 'site/assets/img/icon128.png', 'site/assets/img/options-desktop.png', 'site/favicon.ico', 'site/.assetsignore'):
            with self.subTest(relative=relative):
                original = (self.root / relative).read_bytes()
                if relative.endswith('.html'):
                    drift = original.replace(b'https://chromewebstore.google.com/detail/example', b'https://old.example/store')
                else:
                    drift = b'drift'
                self.write(relative, drift)
                self.assertIn(relative, SITE.prepare(self.root, check=True))
                self.assertEqual((self.root / relative).read_bytes(), drift)
                self.write(relative, original)

    def test_source_updates_reach_config_and_no_js_fallbacks(self):
        SITE.prepare(self.root)
        self.manifest['version'] = '3.5.0'
        self.manifest['minimum_chrome_version'] = '120'
        self.product.update({'store': 'https://store.example/new', 'contactEmail': 'new@example.com', 'repository': 'https://github.com/new/repo', 'plannedWebsite': 'https://new.example/', 'plannedPrivacy': 'https://new.example/privacy/', 'plannedSupport': 'https://new.example/support/'})
        self.write_sources()
        SITE.prepare(self.root)
        page = self.read('site/index.html')
        self.assertIn('href="https://store.example/new"', page)
        self.assertIn('href="mailto:new@example.com"', page)
        self.assertIn('<span>new@example.com</span>', page)
        self.assertIn('github.com/new/repo</span>', page)
        self.assertIn('data-config="version">3.5.0', page)
        self.assertIn('data-config="minimumChromeVersion">120', page)
        self.assertIn('rel="canonical" href="https://new.example/"', page)
        self.assertIn('property="og:url" content="https://new.example/"', page)
        self.assertIn('property="og:image" content="https://new.example/assets/img/og-image.png"', page)
        self.assertIn('"version": "3.5.0"', self.read('site/assets/js/config.js'))
        self.assertIn('"publishedVersion": "3.3.0"', self.read('site/assets/js/config.js'))
        self.assertEqual(SITE.prepare(self.root, check=True), [])

    def test_privacy_copy_tracks_policy_and_preserves_text(self):
        source = '# Politika\n\nSon güncelleme: 4 Ekim 2026\n\n## İzin ve veri\n\n**Açık** metin, `kod` ve <script>alert(1)</script> & veri.\n\n- [Destek](https://example.com/help)\n- [E-posta](mailto:test@example.com)\n'
        self.write('PRIVACY.md', source)
        SITE.prepare(self.root)
        page = self.read('site/privacy/index.html')
        self.assertIn('<h2 id="izin-ve-veri">İzin ve veri</h2>', page)
        self.assertIn('<p class="meta">Son güncelleme: 4 Ekim 2026</p>', page)
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt; &amp; veri', page)
        self.assertNotIn('<script>alert', page)
        parser = TextParser()
        parser.feed(SITE.render_privacy(source))
        self.assertIn('Açık metin, kod ve <script>alert(1)</script> & veri.', ' '.join(' '.join(parser.parts).split()))

    def test_missing_duplicate_or_reversed_markers_fail_before_writing(self):
        for content in ('<!-- privacy:start -->', '<!-- privacy:start --><!-- privacy:start --><!-- privacy:end -->', '<!-- privacy:end --><!-- privacy:start -->'):
            with self.subTest(content=content):
                self.write('site/privacy/index.html', content)
                with self.assertRaisesRegex(ValueError, 'işaret'):
                    SITE.prepare(self.root)
                self.assertFalse((self.root / 'site/assets/js/config.js').exists())

    def test_unsupported_policy_structure_fails_before_writing(self):
        self.write('PRIVACY.md', '# Politika\n\nSon güncelleme: bugün\n\n```js\ncode\n```')
        with self.assertRaisesRegex(ValueError, 'Markdown'):
            SITE.prepare(self.root)
        self.assertFalse((self.root / 'site/assets/js/config.js').exists())

    def test_unsafe_policy_link_is_not_rendered(self):
        with self.assertRaises(ValueError):
            SITE.inline('[Tıkla](javascript:alert)')
        with self.assertRaises(ValueError):
            SITE.inline('[Tıkla](https://token@example.com/)')

    def test_unknown_or_duplicate_config_code_is_not_executed(self):
        self.assertEqual(SITE.read_product('const PRODUCT_CONFIG = Object.freeze({\n videoDurationSeconds: 35.5,\n});')['videoDurationSeconds'], 35.5)
        for source in ('const PRODUCT_CONFIG = Object.freeze({\n name: process.env.SECRET\n});', "const PRODUCT_CONFIG = Object.freeze({\n name: 'one',\n name: 'two'\n});"):
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    SITE.read_product(source)

    def test_source_url_and_product_name_mismatches_are_rejected(self):
        for bad in ('http://example.com/', 'https://key@example.com/', 'https://example.com/?key=test', 'https://example.com/#test'):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    SITE.public_url(bad)
        self.product['name'] = 'Başka ürün'
        self.write_sources()
        with self.assertRaisesRegex(ValueError, 'Ürün adı'):
            SITE.prepare(self.root)

    def test_icons_and_favicon_use_manifest_sources_without_resizing(self):
        SITE.prepare(self.root)
        ico = (self.root / 'site/favicon.ico').read_bytes()
        self.assertEqual(struct.unpack('<HHH', ico[:6]), (0, 1, 3))
        for index, size in enumerate((16, 48, 128)):
            original = (self.root / f'icons/icon{size}.png').read_bytes()
            self.assertEqual(original, (self.root / f'site/assets/img/icon{size}.png').read_bytes())
            _, _, _, _, _, _, length, offset = struct.unpack('<BBBBHHII', ico[6 + 16 * index:22 + 16 * index])
            self.assertEqual(ico[offset:offset + length], original)
        self.write('icons/icon128.png', b'not PNG')
        with self.assertRaisesRegex(ValueError, 'PNG'):
            SITE.prepare(self.root)

    def test_only_approved_public_screenshots_are_copied(self):
        self.write('design/claude-assets/options-mobile.png', b'not used')
        SITE.prepare(self.root)
        for name in SITE.SCREENSHOTS:
            self.assertEqual((self.root / ('site/assets/img/' + name)).read_bytes(), (self.root / ('design/claude-assets/' + name)).read_bytes())
        self.assertFalse((self.root / 'site/assets/img/options-mobile.png').exists())

    def test_robots_sitemap_and_asset_ignore_only_publish_public_routes(self):
        SITE.prepare(self.root)
        sitemap = ET.fromstring(self.read('site/sitemap.xml'))
        locations = [element.text for element in sitemap.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(locations, ['https://duzelt.yerli.dev/', 'https://duzelt.yerli.dev/privacy/', 'https://duzelt.yerli.dev/support/'])
        self.assertIn('Sitemap: https://duzelt.yerli.dev/sitemap.xml', self.read('site/robots.txt'))
        self.assertIn('Disallow: /_preview/', self.read('site/robots.txt'))
        self.assertIn('_preview/', self.read('site/.assetsignore'))
        self.assertIn('README.md', self.read('site/.assetsignore'))
        self.assertNotIn('canonical', self.read('site/404.html'))
        self.assertIn('name="robots" content="noindex"', self.read('site/404.html'))

    def test_version_note_no_js_visibility_tracks_verified_published_version(self):
        for published in ('3.4.0', None, '3.3.0'):
            with self.subTest(published=published):
                self.product['publishedVersion'] = published
                self.write_sources()
                SITE.prepare(self.root)
                self.assertEqual('data-version-note hidden>' in self.read('site/index.html'), published in ('3.4.0', None))

    def test_unknown_fallback_key_or_missing_canonical_fails(self):
        for page in ('<span data-config="unknown">old</span>', '<a data-link="unknown" href="/">old</a>', '<html>missing canonical</html>'):
            with self.subTest(page=page):
                config = SITE.site_config(self.product, self.manifest)
                with self.assertRaises(ValueError):
                    SITE.sync_html(page, 'index.html', config)


if __name__ == '__main__':
    unittest.main()
