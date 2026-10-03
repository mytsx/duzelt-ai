#!/usr/bin/env python3
"""Manifest ve yerel çalışma bağımlılıklarından tekrarlanabilir mağaza ZIP'i üretir."""

import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
from urllib.parse import urlsplit
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED


ROOT = Path(__file__).resolve().parent.parent
ALLOWED_DIRECTORIES = frozenset(('background', 'content', 'popup', 'options', 'lib', 'icons'))
ALLOWED_SUFFIXES = frozenset(('.js', '.css', '.html', '.json', '.png', '.svg', '.jpg', '.jpeg', '.webp', '.woff2'))
FIXED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag in ('script', 'img') and values.get('src'):
            self.assets.append((values['src'], tag == 'script'))
        elif tag == 'link' and values.get('href'):
            if set(values.get('rel', '').split()) & {'stylesheet', 'icon', 'preload'}:
                self.assets.append((values['href'], False))


def manifest_references(manifest):
    refs = []
    background = manifest.get('background', {})
    refs.extend(background.get('scripts', []))
    refs.extend(value for value in (background.get('service_worker'), background.get('page')) if value)
    for content in manifest.get('content_scripts', []):
        refs.extend(content.get('js', []))
        refs.extend(content.get('css', []))
    for name in ('action', 'browser_action', 'page_action'):
        action = manifest.get(name, {})
        if action.get('default_popup'):
            refs.append(action['default_popup'])
        icons = action.get('default_icon', {})
        refs.extend(icons.values() if isinstance(icons, dict) else [icons])
    refs.extend(manifest.get('icons', {}).values())
    refs.extend(value for value in (manifest.get('options_page'), manifest.get('options_ui', {}).get('page')) if value)
    refs.extend(manifest.get('chrome_url_overrides', {}).values())
    for entry in manifest.get('web_accessible_resources', []):
        refs.extend(entry.get('resources', []) if isinstance(entry, dict) else [entry])
    return refs


def collect_files(root):
    root = Path(root).resolve()
    manifest_path = root / 'manifest.json'
    if manifest_path.resolve() != manifest_path or not manifest_path.is_file():
        raise ValueError('Kaynak manifest eksik veya sembolik bağlantı.')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    version = manifest.get('version', '')
    if not re.fullmatch(r'(?:0|[1-9]\d{0,4})(?:\.(?:0|[1-9]\d{0,4})){0,3}', version):
        raise ValueError('Manifest sürümü geçerli Chrome sürüm biçiminde değil.')
    if any(int(part) > 65535 for part in version.split('.')) or not any(int(part) for part in version.split('.')):
        raise ValueError('Manifest sürümü 0–65535 aralığında olmalı ve tüm parçaları sıfır olmamalı.')
    files = {'manifest.json'}
    pending = []

    def add(reference, owner='manifest.json', extension_root=False, code=False):
        if not isinstance(reference, str) or not reference:
            raise ValueError('Boş veya geçersiz çalışma dosyası referansı.')
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc:
            if owner == 'manifest.json' or code:
                raise ValueError('Çalıştırılabilir dosya referansı yerel olmalı.')
            return
        if not parsed.path:
            return
        if '\\' in parsed.path or re.search(r'[*?\[\]]', parsed.path):
            raise ValueError(f'Dosya referansı açık bir yerel yol olmalı: {owner}')
        path = posixpath.normpath(parsed.path.lstrip('/') if extension_root or parsed.path.startswith('/')
                                 else posixpath.join(posixpath.dirname(owner), parsed.path))
        parts = PurePosixPath(path).parts
        if not parts or parts[0] not in ALLOWED_DIRECTORIES or any(part.startswith('.') for part in parts):
            raise ValueError(f'Çalışma dosyası izin listesinin dışında: {path}')
        if PurePosixPath(path).suffix.lower() not in ALLOWED_SUFFIXES:
            raise ValueError(f'İzin verilmeyen çalışma dosyası türü: {path}')
        source = root / path
        if source.resolve() != source or not source.is_file():
            raise ValueError(f'Çalışma dosyası eksik veya sembolik bağlantı: {path}')
        if path not in files:
            files.add(path)
            pending.append(path)

    for reference in manifest_references(manifest):
        add(reference, extension_root=True)
    while pending:
        path = pending.pop()
        source = root / path
        if source.suffix not in ('.html', '.js', '.css'):
            continue
        content = source.read_text(encoding='utf-8')
        if source.suffix == '.html':
            parser = AssetParser()
            parser.feed(content)
            for reference, code in parser.assets:
                add(reference, path, code=code)
        elif source.suffix == '.js':
            for args in re.findall(r'\bimportScripts\s*\(([^)]*)\)', content):
                refs = re.findall(r"['\"]([^'\"]+)['\"]", args)
                if not refs or re.sub(r"['\"][^'\"]+['\"]|[\s,]", '', args):
                    raise ValueError(f'importScripts referansları sabit metin olmalı: {path}')
                for reference in refs:
                    add(reference, path, code=True)
            for reference in re.findall(r"\bruntime\.getURL\s*\(\s*['\"]([^'\"]+)['\"]\s*\)", content):
                add(reference, path, extension_root=True)
        else:
            for reference in re.findall(r'url\(\s*[\'"]?([^\'"\s)]+)', content):
                add(reference, path)
            for reference in re.findall(r'@import\s+[\'"]([^\'"]+)', content):
                add(reference, path)
    return manifest, sorted(files)


def build_package(root=ROOT):
    root = Path(root).resolve()
    manifest, files = collect_files(root)
    destination = root / 'dist' / f"duzelt-ai-{manifest['version']}.zip"
    destination.parent.mkdir(exist_ok=True)
    temporary = destination.with_suffix('.zip.tmp')
    try:
        with ZipFile(temporary, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
            for path in files:
                entry = ZipInfo(path, date_time=FIXED_TIMESTAMP)
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, (root / path).read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
        with ZipFile(temporary) as archive:
            if archive.namelist() != files or archive.testzip() is not None:
                raise ValueError('ZIP dosya listesi veya CRC doğrulaması başarısız.')
            if json.loads(archive.read('manifest.json')) != manifest:
                raise ValueError('ZIP kökündeki manifest kaynak manifest ile aynı değil.')
            for path in files:
                if archive.read(path) != (root / path).read_bytes():
                    raise ValueError(f'Paketleme sırasında çalışma dosyası değişti: {path}')
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.zip.sha256').write_text(f'{digest}  {destination.name}\n', encoding='utf-8')
    return destination, files, digest


if __name__ == '__main__':
    package, contents, sha256 = build_package()
    print(package)
    print(f'{len(contents)} çalışma dosyası; manifest referansları ve CRC doğrulandı.')
    print(f'SHA-256: {sha256}')
    print('\n'.join(contents))
