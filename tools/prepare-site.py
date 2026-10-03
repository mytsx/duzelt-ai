#!/usr/bin/env python3
"""Prepare or check static-site copies of the extension's public source data."""

import argparse
import ast
import hashlib
import html
import json
from pathlib import Path
import re
import struct
import sys
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent
PAGES = {'index.html': '', 'privacy/index.html': 'privacy/', 'support/index.html': 'support/'}
SCREENSHOTS = ('popup-light.png', 'popup-dark.png', 'options-desktop.png', 'options-openrouter.png')
IGNORE = '# Local documentation, secrets and component previews are not public assets.\nREADME.md\n_preview/\n.env\n.env.*\n**/.env\n**/.env.*\n.dev.vars\n.dev.vars.*\n**/.dev.vars\n**/.dev.vars.*\n.DS_Store\n**/.DS_Store\n'


def read_product(source):
    """Read the fixed scalar config without executing JavaScript."""
    match = re.search(r'const\s+PRODUCT_CONFIG\s*=\s*Object\.freeze\(\{(.*?)\}\);', source, re.S)
    if not match:
        raise ValueError('PRODUCT_CONFIG sabit nesnesi bulunamadı.')
    values = {}
    for line in match[1].splitlines():
        if not line.strip():
            continue
        field = re.fullmatch(r'\s*([A-Za-z_]\w*)\s*:\s*(\'(?:\\.|[^\'\\])*\'|"(?:\\.|[^"\\])*"|null|true|false|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,?\s*', line)
        if not field or field[1] in values:
            raise ValueError('Ürün yapılandırması benzersiz, sabit metin/sayı alanları içermeli.')
        literal = field[2]
        values[field[1]] = {'null': None, 'true': True, 'false': False}.get(literal) if literal in ('null', 'true', 'false') else ast.literal_eval(literal)
    return values


def public_url(value):
    parts = urlsplit(value) if isinstance(value, str) else None
    if not parts or parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError('Ürün bağlantıları kimlik bilgisi içermeyen sabit HTTPS adresleri olmalı.')
    return value


def site_config(product, manifest):
    if product.get('name') != manifest.get('name'):
        raise ValueError('Ürün adı manifest ile eşleşmiyor.')
    website = public_url(product.get('plannedWebsite') or product.get('website')).rstrip('/') + '/'
    config = {key: product[key] for key in ('name', 'developer', 'store', 'developerWebsite', 'contactEmail', 'repository', 'issues', 'publishedVersion', 'video', 'videoDurationSeconds')}
    config.update({
        'website': website,
        'support': product.get('plannedSupport') or product.get('support'),
        'privacy': product.get('plannedPrivacy') or product.get('privacy'),
        'version': manifest['version'],
        'minimumChromeVersion': manifest['minimum_chrome_version'],
        'videoCover': 'assets/img/video-cover.png',
        'videoTitle': product['name'] + ' tanıtım videosu',
    })
    for key in ('store', 'support', 'privacy', 'developerWebsite', 'repository', 'issues'):
        public_url(config[key])
    for key in ('support', 'privacy'):
        if config[key] != website + key + '/':
            raise ValueError('Site destek/gizlilik adresleri website köküyle eşleşmeli.')
    if not re.fullmatch(r'[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+', config['contactEmail']):
        raise ValueError('Sabit iletişim e-postası geçersiz.')
    return config


def inline(text):
    pattern = re.compile(r'`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^\s()]+)\)')
    parts, end = [], 0
    for match in pattern.finditer(text):
        parts.append(html.escape(text[end:match.start()]))
        if match[1] is not None:
            parts.append('<code>' + html.escape(match[1]) + '</code>')
        elif match[2] is not None:
            parts.append('<strong>' + inline(match[2]) + '</strong>')
        else:
            target = match[4]
            if target.startswith('mailto:'):
                if not re.fullmatch(r'mailto:[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+', target):
                    raise ValueError('Gizlilik metnindeki e-posta bağlantısı geçersiz.')
            else:
                public_url(target)
            parts.append('<a href="' + html.escape(target, quote=True) + '">' + inline(match[3]) + '</a>')
        end = match.end()
    parts.append(html.escape(text[end:]))
    return ''.join(parts)


def slug(text):
    text = text.lower().replace('\u0307', '').translate(str.maketrans('çğıöşüâîû', 'cgiosuaiu'))
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def render_privacy(source):
    blocks = re.split(r'\n\s*\n', source.strip())
    if not blocks[0].startswith('# ') or not blocks[1].startswith('Son güncelleme: '):
        raise ValueError('Gizlilik kaynağı başlık ve son güncelleme tarihi içermeli.')
    rendered, seen = [], {}
    for index, block in enumerate(blocks):
        if block.startswith('# '):
            if index:
                raise ValueError('Gizlilik kaynağı yalnız bir ana başlık içermeli.')
            rendered.append('<h1>' + inline(block[2:]) + '</h1>')
        elif block.startswith('## '):
            if '\n' in block:
                raise ValueError('Gizlilik bölüm başlığı ayrı satır olmalı.')
            label = block[3:]
            anchor = slug(label)
            seen[anchor] = seen.get(anchor, 0) + 1
            identifier = anchor if seen[anchor] == 1 else anchor + '-' + str(seen[anchor])
            rendered.append('<h2 id="' + identifier + '">' + inline(label) + '</h2>')
        elif all(line.startswith('- ') for line in block.splitlines()):
            rendered.append('<ul>\n' + '\n'.join('  <li>' + inline(line[2:]) + '</li>' for line in block.splitlines()) + '\n</ul>')
        elif any(line.startswith(('#', '- ', '```')) for line in block.splitlines()):
            raise ValueError('Gizlilik kaynağındaki Markdown biçimi desteklenmiyor; sessizce atlanmadı.')
        else:
            attribute = ' class="meta"' if index == 1 else ''
            rendered.append('<p' + attribute + '>' + inline(' '.join(block.splitlines())) + '</p>')
    return '\n'.join(rendered)


def set_attribute(tag, name, value):
    pattern = re.compile(r'\b' + re.escape(name) + r'\s*=\s*([\'"])(.*?)\1', re.S)
    replacement = name + '="' + html.escape(str(value), quote=True) + '"'
    if pattern.search(tag):
        return pattern.sub(lambda _: replacement, tag, count=1)
    return tag[:-1] + ' ' + replacement + '>'


def attribute(tag, name):
    match = re.search(r'\b' + re.escape(name) + r'\s*=\s*([\'"])(.*?)\1', tag, re.S)
    return html.unescape(match[2]) if match else None


def version_feedback_script(source, root):
    """Change the browser cache key whenever the support feedback script changes."""
    asset = Path(root).resolve() / 'site/assets/js/feedback.js'

    def script(match):
        tag = match[0]
        src = attribute(tag, 'src')
        if not src or urlsplit(src).path != '../assets/js/feedback.js':
            return tag
        if not asset.is_file() or asset.is_symlink() or Path(root).resolve() not in asset.resolve().parents:
            raise ValueError('Geri bildirim betiği yerel normal dosya olmalı.')
        version = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        return set_attribute(tag, 'src', '../assets/js/feedback.js?v=' + version)

    return re.sub(r'<script\b[^>]*>', script, source)


def sync_html(source, relative, config):
    links = {key: config[key] for key in ('store', 'website', 'support', 'privacy', 'issues', 'repository')}
    links.update({'email': 'mailto:' + config['contactEmail'], 'developer': config['developerWebsite']})

    def link(match):
        opening, body, closing = match.groups()
        key = attribute(opening, 'data-link')
        if key is None:
            return match[0]
        if key not in links:
            raise ValueError('Site data-link alanı tanımlı değil: ' + key)
        old = attribute(opening, 'href') or ''
        if key == 'email':
            body = re.sub(r'[\w.%+\-]+@[\w.\-]+\.[A-Za-z]{2,}', lambda _: html.escape(config['contactEmail']), body)
        elif key == 'repository' and old:
            body = body.replace(html.escape(old.removeprefix('https://')), html.escape(links[key].removeprefix('https://')))
        return set_attribute(opening, 'href', links[key]) + body + closing

    source = re.sub(r'(<a\b[^>]*>)(.*?)(</a>)', link, source, flags=re.S)

    def field(match):
        opening, key, body, closing = match.groups()
        if key not in config:
            raise ValueError('Site data-config alanı tanımlı değil: ' + key)
        return opening + html.escape(str(config[key]) if config[key] is not None else '') + closing

    source = re.sub(r'(<[^>]+\bdata-config=[\'"]([^\'"]+)[\'"][^>]*>)(.*?)(</[^>]+>)', field, source, flags=re.S)
    no_version_note = not config['publishedVersion'] or config['publishedVersion'] == config['version']
    source = re.sub(r'<[^>]+\bdata-version-note\b[^>]*>', lambda match: re.sub(r'\s+hidden(?:=[\'"][^\'"]*[\'"])?', '', match[0])[:-1] + (' hidden>' if no_version_note else '>'), source)
    canonical = config['website'] + PAGES[relative] if relative in PAGES else None

    def metadata(match):
        tag = match[0]
        if attribute(tag, 'rel') == 'canonical':
            if canonical is None:
                raise ValueError('Yayımlanmayan sayfada canonical bulunmamalı.')
            return set_attribute(tag, 'href', canonical)
        name = attribute(tag, 'property') or attribute(tag, 'name')
        if name == 'og:url' and canonical:
            return set_attribute(tag, 'content', canonical)
        if name == 'og:image':
            return set_attribute(tag, 'content', config['website'] + 'assets/img/og-image.png')
        if name == 'og:site_name':
            return set_attribute(tag, 'content', config['name'])
        if name == 'author':
            return set_attribute(tag, 'content', config['developer'])
        return tag

    source = re.sub(r'<(?:meta|link)\b[^>]*>', metadata, source)
    if canonical and len(re.findall(r'<link\b[^>]*\brel=[\'"]canonical[\'"]', source)) != 1:
        raise ValueError('Her yayımlanan sayfa tek canonical içermeli: ' + relative)
    if relative == '404.html' and not re.search(r'<meta\b[^>]*\bname=[\'"]robots[\'"][^>]*\bcontent=[\'"]noindex[\'"]', source):
        raise ValueError('404 sayfası noindex içermeli.')
    return source


def favicon(images):
    entries, data = [], []
    offset = 6 + 16 * len(images)
    for size, image in images:
        if len(image) < 24 or image[:8] != b'\x89PNG\r\n\x1a\n' or image[12:16] != b'IHDR' or struct.unpack('>II', image[16:24]) != (size, size):
            raise ValueError('Manifest ikonu belirtilen boyutta PNG olmalı.')
        entries.append(struct.pack('<BBBBHHII', size if size < 256 else 0, size if size < 256 else 0, 0, 0, 1, 32, len(image), offset))
        data.append(image)
        offset += len(image)
    return struct.pack('<HHH', 0, 1, len(images)) + b''.join(entries + data)


def expected_files(root):
    root = Path(root).resolve()
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    product = read_product((root / 'lib/product-config.js').read_text(encoding='utf-8'))
    config = site_config(product, manifest)
    privacy = (root / 'PRIVACY.md').read_text(encoding='utf-8')
    generated = {'site/assets/js/config.js': ('/* Generated by tools/prepare-site.py from lib/product-config.js and manifest.json. */\nwindow.SITE_CONFIG = Object.freeze(' + json.dumps(config, ensure_ascii=False, indent=4) + ');\n').encode()}
    for path in sorted((root / 'site').rglob('*.html')):
        if path.is_symlink():
            raise ValueError('Site HTML kaynağı sembolik bağlantı olamaz.')
        relative = path.relative_to(root / 'site').as_posix()
        source = path.read_text(encoding='utf-8')
        if relative == 'privacy/index.html':
            if source.count('<!-- privacy:start -->') != 1 or source.count('<!-- privacy:end -->') != 1 or source.index('<!-- privacy:end -->') < source.index('<!-- privacy:start -->'):
                raise ValueError('Gizlilik HTML işaretleri eksik veya tekrarlı.')
            source = re.sub(r'<!-- privacy:start -->.*?<!-- privacy:end -->', lambda _: '<!-- privacy:start -->\n' + render_privacy(privacy) + '\n<!-- privacy:end -->', source, flags=re.S)
        if relative == 'support/index.html':
            source = version_feedback_script(source, root)
        generated['site/' + relative] = sync_html(source, relative, config).encode()
    if any('site/' + page not in generated for page in (*PAGES, '404.html')):
        raise ValueError('Gerekli site sayfaları eksik.')
    images = []
    for size in (16, 48, 128):
        source = root / manifest['icons'][str(size)]
        if not source.is_file() or source.is_symlink() or root not in source.resolve().parents:
            raise ValueError('Manifest ikon kaynağı eksik veya yerel normal dosya değil.')
        image = source.read_bytes()
        generated[f'site/assets/img/icon{size}.png'] = image
        images.append((size, image))
    generated['site/favicon.ico'] = favicon(images)
    for name in SCREENSHOTS:
        generated['site/assets/img/' + name] = (root / 'design/claude-assets' / name).read_bytes()
    generated['site/.assetsignore'] = IGNORE.encode()
    generated['site/robots.txt'] = ('User-agent: *\nAllow: /\nDisallow: /_preview/\n\nSitemap: ' + config['website'] + 'sitemap.xml\n').encode()
    generated['site/sitemap.xml'] = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>' + html.escape(config['website'] + route) + '</loc></url>\n' for route in PAGES.values()) + '</urlset>\n').encode()
    return generated


def prepare(root=ROOT, check=False):
    root = Path(root).resolve()
    generated = expected_files(root)
    changed = []
    for relative, content in generated.items():
        path = root / relative
        if path.is_symlink() or root not in path.resolve().parents:
            raise ValueError('Hazırlık hedefi yerel normal dosya olmalı.')
        if not path.is_file() or path.read_bytes() != content:
            changed.append(relative)
    if not check:
        for relative in changed:
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(generated[relative])
    return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Report drift without changing files.')
    args = parser.parse_args()
    try:
        changed = prepare(check=args.check)
    except (ValueError, KeyError, OSError) as error:
        print('Site hazırlanamadı: ' + str(error), file=sys.stderr)
        return 1
    if args.check and changed:
        print('Site kaynaklarla eşleşmiyor; site:prepare çalıştırın:\n' + '\n'.join(changed), file=sys.stderr)
        return 1
    print('Site kaynaklarla eşleşiyor.' if args.check else f'Site hazır; {len(changed)} dosya eşitlendi.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
