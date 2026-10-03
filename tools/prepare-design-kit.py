#!/usr/bin/env python3
"""Claude tasarım devri için gerçek ürün kaynaklarını kopyalar; web tasarlamaz."""
import hashlib
import json
from pathlib import Path
import shutil
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
TIMESTAMP = (1980, 1, 1, 0, 0, 0)


def prepare():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    state = json.loads((ROOT / 'docs/current-state.json').read_text())
    ui = json.loads((ROOT / 'evidence/ui-results.json').read_text())
    editors = json.loads((ROOT / 'evidence/editor-results.json').read_text())
    providers = json.loads((ROOT / 'evidence/provider-edge-review.json').read_text())
    if ui['visualReviewPending'] or ui['extensionVersion'] != manifest['version'] or editors['extensionVersion'] != manifest['version']:
        raise ValueError('Güncel sürüm ve görsel kontrol kanıtı gerekli.')
    for name, digest in ui.get('sourceSha256', {}).items():
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest:
            raise ValueError('Arayüz testinden sonra kaynak değişmiş: ' + name)
    target = ROOT / 'output' / f"claude-design-kit-{manifest['version']}"
    if target.exists():
        shutil.rmtree(target)
    (target / 'assets').mkdir(parents=True)
    sources = {
        'claude-design-prompt.txt': 'design/claude-design-prompt.txt',
        'PRIVACY.md': 'PRIVACY.md',
        'product-config.js': 'lib/product-config.js',
        'manifest.json': 'manifest.json',
        'providers-research.md': 'docs/providers-research.md',
        'testing.md': 'docs/testing.md',
        'assets/editor-before.png': 'output/playwright/editors/quill-before.png',
        'assets/editor-preview.png': 'output/playwright/editors/quill-preview.png',
        'assets/editor-accepted.png': 'output/playwright/editors/quill-accepted.png',
    }
    for name in ('icon16.png', 'icon48.png', 'icon128.png', 'popup-light.png', 'popup-dark.png', 'options-desktop.png', 'options-mobile.png', 'options-openrouter.png'):
        sources['assets/' + name] = 'design/claude-assets/' + name
    for name, source in sources.items():
        source_path = ROOT / source
        if not source_path.is_file() or source_path.is_symlink():
            raise ValueError('Gerekli kaynak bulunamadı: ' + source)
        shutil.copyfile(source_path, target / name)
    checks = sum(len(item['checks']) for item in editors['results']) + len(editors.get('globalChecks', []))
    facts = f'''Ürün: {manifest['name']}
Yerel hazırlanmış sürüm: {manifest['version']}; kamu mağaza sürümü: {state['published_version']}.
Mağaza öğesi: {state['item_id']} — yeni öğe oluşturulmayacak.
Gerçek mağaza adresi product-config.js içindedir; yukarıdaki kimliği config ile karşılaştırın.
Planlanan site: https://duzelt.yerli.dev/ (henüz yayınlanmadı).
Düzelt → önizle → kabul/iptal. Kullanıcı kabul etmeden editör değişmez.
Normal input/textarea desteklenmez; test edilen klasik zengin editör kurulumları testing.md içindedir.
Katalog: {providers['providerCount']} kayıt, {providers['selectableProviders']} doğrudan protokol yoluna sahip sağlayıcı; {providers['selectableModelRecords']} model adayı.
Bu sayılar canlı hesap/model erişimi veya düzeltme kalitesi kanıtı değildir. Özel giriş sınırları providers-research.md içindedir.
Sağlayıcı/key/model/adres/bulut alanları tek ekrandadır. Eski OpenAI ayarları korunur; gpt-4o değiştirilmedi.
Bulut API ücretleri ayrıdır; yerel model için çalışan yerel servis ve yüklü model gerekir.
Anahtarlar, bağlantı profilleri ve kurallar local; yalnız aç/kapa sync. Metin+kurallar seçilen API'ye gider.
Ekranlar gerçek çalışan unpacked eklentiye aittir. Editör düzeltme yanıtı kontrollü fixture'dır; ücretli canlı API çağrısı yapılmadı.
Arayüz kontrol grubu: {ui['checkCount']}; editör kontrol sayısı: {checks}. Görseller açık/koyu temada 5 genişlikte incelendi.
Video, mağaza tanıtım görselleri ve site yayını web tasarım kaynağı geldikten sonra hazırlanacak.
PRIVACY.md bu teslim için üretilmiş kopyadır; politika kaynağı depodaki kök PRIVACY.md'dir.
'''
    (target / 'product-facts.txt').write_text(facts, encoding='utf-8')
    (target / 'BUNU-OKUYUN.txt').write_text('claude-design-prompt.txt içeriğini Claude.ai/Design mesajına yapıştırın. Bu klasördeki metin ve assets dosyalarını referans olarak verin. ZIP kabul edilmiyorsa çıkarıp dosyaları ekleyin. Düzenlenebilir site kaynaklarını ZIP olarak geri getirin. Bu paket bir web sitesi veya mağaza yükleme paketi değildir.\n', encoding='utf-8')
    hashes = {str(file.relative_to(target)): hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted(target.rglob('*')) if file.is_file()}
    (target / 'files.sha256.json').write_text(json.dumps(hashes, indent=2) + '\n')
    destination = Path(str(target) + '.zip')
    with ZipFile(destination, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(target.rglob('*')):
            if source.is_file():
                entry = ZipInfo(source.relative_to(target).as_posix(), date_time=TIMESTAMP)
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, source.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError('Tasarım ZIP CRC kontrolü başarısız.')
        for name, digest in hashes.items():
            if hashlib.sha256(archive.read(name)).hexdigest() != digest:
                raise ValueError('Tasarım dosyası kaynakla eşleşmiyor: ' + name)
    print(destination)
    print(f'{len(hashes) + 1} dosya; kaynak hash ve ZIP CRC doğrulandı.')


if __name__ == '__main__':
    prepare()
