#!/usr/bin/env python3
"""Gerçek ürün PNG'lerinden sabit video sahneleri ve mağaza medyası üretir."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'store/video/source'
SCENES = ROOT / 'output/video/scenes'
BG, INK, MUTED, BLUE = '#f3f4f8', '#191d2c', '#515665', '#485cd0'
WHITE, LINE, GREEN, RED = '#fcfcfe', '#c7cad5', '#146d34', '#b02b27'
FONT_DIR = Path('/System/Library/Fonts/Supplemental')
REGULAR = FONT_DIR / 'Arial.ttf'
BOLD = FONT_DIR / 'Arial Bold.ttf'
TEXT_BOUNDS = []


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REGULAR), size)


def text(canvas, xy, value, size=32, color=INK, bold=False, spacing=10):
    draw = ImageDraw.Draw(canvas)
    face = font(size, bold)
    bounds = draw.multiline_textbbox(xy, value, font=face, spacing=spacing)
    if bounds[0] < 0 or bounds[1] < 0 or bounds[2] > canvas.width or bounds[3] > canvas.height:
        raise ValueError(f'Text exceeds canvas: {value!r}: {bounds}')
    TEXT_BOUNDS.append({'text': value, 'bounds': bounds, 'size': size})
    draw.multiline_text(xy, value, font=face, fill=color, spacing=spacing)


def shot(canvas, name, crop, xy, width):
    source = Image.open(SOURCE / name).convert('RGB')
    area = source.crop(crop)
    height = round(area.height * width / area.width)
    area = area.resize((width, height), Image.Resampling.LANCZOS)
    if xy[0] < 0 or xy[1] < 0 or xy[0] + width > canvas.width or xy[1] + height > canvas.height:
        raise ValueError('Product image exceeds canvas: ' + name)
    canvas.paste(area, xy)
    ImageDraw.Draw(canvas).rectangle((xy[0], xy[1], xy[0]+width-1, xy[1]+height-1), outline=LINE, width=2)


def icon(canvas, xy, size=64):
    logo = Image.open(SOURCE / 'icon128.png').convert('RGBA')
    logo = logo.resize((size, size), Image.Resampling.LANCZOS)
    canvas.paste(logo, xy, logo)


def header(canvas, dark=False):
    ink, line = ('#ffffff', '#8595e4') if dark else (INK, LINE)
    pad = 96 if canvas.width == 1920 else 64
    icon(canvas, (pad, 44 if canvas.width == 1920 else 28), 56 if canvas.width == 1920 else 40)
    text(canvas, (pad + (80 if canvas.width == 1920 else 58), 49 if canvas.width == 1920 else 29), 'AI Türkçe Metin Düzeltici', 32 if canvas.width == 1920 else 23, ink, True)
    text(canvas, (canvas.width - (360 if canvas.width == 1920 else 250), 58 if canvas.width == 1920 else 35), 'Chrome eklentisi', 24 if canvas.width == 1920 else 18, ink)
    y = 140 if canvas.width == 1920 else 100
    ImageDraw.Draw(canvas).line((pad, y, canvas.width-pad, y), fill=line, width=2)


def footer(canvas, label, dark=False):
    color = '#ffffff' if dark else MUTED
    text(canvas, (96 if canvas.width == 1920 else 64, canvas.height-70 if canvas.width == 1920 else canvas.height-48), label, 22 if canvas.width == 1920 else 17, color)


def stepbar(canvas, active):
    draw = ImageDraw.Draw(canvas)
    for i, title in enumerate(('Düzelt', 'İnceleyin', 'Karar verin')):
        x = 96 + i * 574
        draw.rectangle((x, 914, x+540, 970), fill=BLUE if i == active else '#e8eaf0')
        text(canvas, (x+20, 929), f'{i+1:02d}  {title}', 26, '#ffffff' if i == active else MUTED, True)


def save(canvas, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert('RGB').save(path, format='PNG', optimize=True)


def build_scenes():
    c = Image.new('RGB', (1920, 1080), BG)
    header(c)
    text(c, (96, 228), 'Türkçe metninizi\ndüzeltin.\nKarar sizin.', 100, INK, True, 18)
    text(c, (100, 659), 'Uyumlu zengin metin editörlerinde\ndüzeltme önerileri.', 34, MUTED, False, 16)
    shot(c, 'popup-light.png', (0, 0, 380, 522), (1248, 196), 520)
    footer(c, 'Düzelt  →  İnceleyin  →  Karar verin')
    save(c, SCENES / 'scene-1.png')

    c = Image.new('RGB', (1920, 1080), BG)
    header(c)
    text(c, (96, 190), 'Uyumlu editörde Düzelt’e basın.', 66, INK, True)
    shot(c, 'editor-before.png', (160, 155, 1280, 510), (180, 353), 1560)
    stepbar(c, 0)
    footer(c, 'Gerçek Quill arayüzü · Kişisel veri içermeyen örnek metin')
    save(c, SCENES / 'scene-2.png')

    c = Image.new('RGB', (1920, 1080), BG)
    header(c)
    text(c, (96, 190), 'Değişiklikleri inceleyin.', 66, INK, True)
    shot(c, 'editor-preview.png', (320, 327, 1120, 674), (300, 310), 1320)
    stepbar(c, 1)
    footer(c, 'Gerçek arayüz · Kontrollü örnek yanıt')
    save(c, SCENES / 'scene-3.png')

    c = Image.new('RGB', (1920, 1080), BG)
    header(c)
    text(c, (96, 190), 'Kabul edin ya da iptal edin.', 66, INK, True)
    text(c, (100, 274), 'Kabul et: öneri uygulanır.     İptal: asıl metin korunur.', 30, MUTED)
    shot(c, 'editor-accepted.png', (160, 155, 1280, 510), (180, 366), 1560)
    stepbar(c, 2)
    footer(c, 'Kontrollü örnek yanıt · Bu örnekte kalın/italik, bağlantı ve liste korunmuştur.')
    save(c, SCENES / 'scene-4.png')

    c = Image.new('RGB', (1920, 1080), BG)
    header(c)
    text(c, (96, 196), 'Bulut ya da\nyerel model.', 88, INK, True, 15)
    text(c, (100, 442), 'Bağlantınızı seçin,\nmodelinizi kaydedin.', 36, MUTED, False, 16)
    text(c, (100, 638), 'Bulut için kendi erişim\nbilgileriniz gerekir.', 30, MUTED, False, 13)
    text(c, (100, 764), 'Yerel kullanım için çalışan\nservis ve yüklü model gerekir.', 28, MUTED, False, 12)
    shot(c, 'options-desktop.png', (375, 280, 1285, 790), (764, 245), 1060)
    footer(c, 'Bulut sağlayıcısının API kullanım ücreti eklentiden ayrıdır.')
    save(c, SCENES / 'scene-5.png')

    c = Image.new('RGB', (1920, 1080), BLUE)
    header(c, True)
    draw = ImageDraw.Draw(c)
    for x in (704, 1344):
        draw.line((x, 141, x, 1080), fill='#7082df', width=2)
    text(c, (96, 223), 'Düzeltin.\nİnceleyin.\nKarar verin.', 108, '#ffffff', True, 16)
    text(c, (102, 748), 'Chrome Web Store’da', 40, '#ffffff', True)
    text(c, (103, 816), 'duzelt.yerli.dev', 29, '#ffffff')
    shot(c, 'editor-preview.png', (320, 327, 1120, 674), (990, 383), 820)
    footer(c, 'AI Türkçe Metin Düzeltici · Mehmet Yerli', True)
    save(c, SCENES / 'scene-6.png')


def build_screenshots():
    entries = [
        ('01-duzelt.png', 'Uyumlu editörde Düzelt’e basın.', 'editor-before.png', (160, 155, 1280, 510), 'Gerçek Quill arayüzü · Örnek metin'),
        ('02-incele.png', 'Eklenen ve çıkarılan ifadeleri görün.', 'editor-preview.png', (320, 327, 1120, 674), 'Gerçek arayüz · Kontrollü örnek yanıt'),
        ('03-karar-ver.png', 'Kabul edin ya da iptal edin.', 'editor-accepted.png', (160, 155, 1280, 510), 'Kontrollü örnek yanıt · Biçimler bu örnekte korunmuştur.'),
    ]
    for filename, title, name, crop, note in entries:
        c = Image.new('RGB', (1280, 800), BG)
        header(c)
        text(c, (64, 133), title, 45, INK, True)
        if filename.startswith('02'):
            shot(c, name, crop, (64, 234), 1152)
        else:
            shot(c, name, crop, (64, 264), 1152)
            text(c, (64, 690), 'Düzelt  →  İnceleyin  →  Karar verin', 23, BLUE, True)
        footer(c, note)
        save(c, ROOT / 'store/screenshots' / filename)

    c = Image.new('RGB', (1280, 800), BG)
    header(c)
    text(c, (64, 140), 'Sağlayıcınızı\nve modelinizi\nseçin.', 54, INK, True, 12)
    text(c, (64, 378), 'Bulut hizmetleri ve\nyerel modeller.', 27, MUTED, False, 10)
    text(c, (64, 565), 'Kendi erişim bilgileriniz\ngerekir. Bulut API\nücreti ayrıdır.', 25, MUTED, False, 10)
    shot(c, 'options-desktop.png', (375, 280, 1285, 790), (444, 193), 772)
    footer(c, 'Gerçek ayarlar arayüzü · API anahtarı gösterilmez.')
    save(c, ROOT / 'store/screenshots/04-saglayici.png')

    c = Image.new('RGB', (1280, 800), BG)
    header(c)
    text(c, (64, 143), 'Yerel modelle\nbağlanın.', 52, INK, True, 14)
    text(c, (64, 340), 'Ollama veya llama.cpp:\nçalışan servis ve\nyüklü model gerekir.', 26, MUTED, False, 12)
    text(c, (64, 549), 'Adres → model seçimi\n→ Kaydet ve kullan', 25, BLUE, True, 12)
    shot(c, 'options-ollama-saved.png', (350, 956, 1285, 1497), (451, 180), 766)
    footer(c, 'Gerçek yerel bağlantı arayüzü · Örnek model seçimi')
    save(c, ROOT / 'store/screenshots/05-yerel-model.png')


def build_promos():
    c = Image.new('RGB', (440, 280), BLUE)
    d = ImageDraw.Draw(c)
    for x in (146, 293):
        d.line((x, 0, x, 280), fill='#6b7fe0', width=1)
    icon(c, (42, 50), 96)
    d.rectangle((180, 78, 391, 113), fill='#ffeae7')
    d.line((195, 97, 373, 97), fill=RED, width=3)
    d.rectangle((180, 129, 391, 164), fill='#e0f7e4')
    d.line((195, 155, 373, 155), fill=GREEN, width=3)
    d.line((213, 207, 273, 207), fill='#ffffff', width=5)
    d.line((273, 207, 258, 192), fill='#ffffff', width=5)
    d.line((273, 207, 258, 222), fill='#ffffff', width=5)
    d.line((323, 207, 333, 218, 355, 193), fill='#ffffff', width=5)
    save(c, ROOT / 'store/promos/small-440x280.png')

    c = Image.new('RGB', (1400, 560), BLUE)
    d = ImageDraw.Draw(c)
    for x in (467, 934):
        d.line((x, 0, x, 560), fill='#6b7fe0', width=2)
    icon(c, (64, 48), 72)
    text(c, (159, 60), 'AI Türkçe Metin Düzeltici', 31, '#ffffff', True)
    text(c, (64, 194), 'Düzeltin. İnceleyin.\nKarar verin.', 74, '#ffffff', True, 14)
    shot(c, 'editor-preview.png', (320, 327, 1120, 674), (839, 194), 496)
    text(c, (66, 469), 'Türkçe metninize öneri. Son karar size.', 25, '#ffffff')
    save(c, ROOT / 'store/promos/marquee-1400x560.png')

    for scale in (1, 3):
        c = Image.new('RGB', (1280*scale, 720*scale), BLUE)
        d = ImageDraw.Draw(c)
        for x in (427, 854):
            d.line((x*scale, 0, x*scale, 720*scale), fill='#7183df', width=2*scale)
        icon(c, (56*scale, 38*scale), 64*scale)
        text(c, (144*scale, 48*scale), 'AI Türkçe Metin Düzeltici', 28*scale, '#ffffff', True)
        text(c, (56*scale, 181*scale), 'Düzeltin.\nİnceleyin.\nKarar verin.', 84*scale, '#ffffff', True, 14*scale)
        shot(c, 'editor-preview.png', (320, 327, 1120, 674), (684*scale, 266*scale), 540*scale)
        text(c, (58*scale, 634*scale), 'Tanıtımı izle', 26*scale, '#ffffff', True)
        d.ellipse(tuple(v*scale for v in (1147, 583, 1221, 657)), fill='#ffffff')
        d.polygon(tuple((x*scale,y*scale) for x,y in ((1177, 602), (1177, 638), (1204, 620))), fill=BLUE)
        save(c, ROOT / f'store/youtube/thumbnail-{1280*scale}x{720*scale}.png')


def main():
    build_scenes()
    build_screenshots()
    build_promos()
    files = list(SCENES.glob('*.png')) + list((ROOT / 'store/screenshots').glob('*.png')) + list((ROOT / 'store/promos').glob('*.png')) + list((ROOT / 'store/youtube').glob('thumbnail-*.png'))
    report = {'product': 'AI Türkçe Metin Düzeltici', 'design': {'palette': [BG, BLUE, INK], 'camera': 'stationary', 'ui': 'real screenshots; controlled correction response'}, 'sourceSha256': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(SOURCE.glob('*.png'))}, 'outputs': {str(p.relative_to(ROOT)): {'size': Image.open(p).size, 'mode': Image.open(p).mode, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)}, 'textBoundsChecked': len(TEXT_BOUNDS), 'textBounds': TEXT_BOUNDS, 'visualReview': 'pending', 'voice': 'awaiting licensed narration; scene timing is a draft'}
    report_path = ROOT / 'store/media-build.json'
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(files)} static RGB PNGs; {len(TEXT_BOUNDS)} text bounds checked; {report_path}')


if __name__ == '__main__':
    main()
