# AI Türkçe Metin Düzeltici - Chrome Extension

Web sayfalarındaki tüm text input alanlarına AI destekli Türkçe metin düzeltme butonu ekleyen Chrome Extension.

## Özellikler

- Otomatik buton enjeksiyonu (textarea, input, contenteditable)
- OpenAI (gpt-4o) ve OpenWebUI desteği
- Diff gösterimi ile düzeltme önizleme
- Dinamik içerik desteği (MutationObserver)
- Türkçe resmi yazışma kurallarına uygun düzeltme

## Kurulum

### 1. Chrome'a Yükleme

1. Chrome'da `chrome://extensions/` sayfasını açın
2. Sağ üstte "Developer mode" seçeneğini aktif edin
3. "Load unpacked" butonuna tıklayın
4. Bu klasörü seçin

### 2. Ayarları Yapılandırma

1. Extension ikonuna tıklayın
2. "⚙️ Ayarlar" butonuna tıklayın
3. Provider seçin (OpenAI veya OpenWebUI)
4. API key'inizi girin
5. "Kaydet" butonuna tıklayın
6. "API Bağlantısını Test Et" ile test edin

## Kullanım

1. Herhangi bir web sitesindeki text alanına tıklayın
2. Sağ üstte görünen "🤖 Düzelt" butonuna tıklayın
3. Düzeltilmiş metni önizleyin
4. "Kabul Et" veya "İptal" seçin

## Desteklenen Siteler

Extension tüm web sitelerinde çalışır:
- Gmail
- Notion
- Google Docs
- LinkedIn
- Twitter/X
- MigemPortal
- Ve diğer tüm web siteleri

## Proje Yapısı

```
.
├── manifest.json              # Extension yapılandırması
├── icons/                     # Extension ikonları
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content/
│   ├── content.js            # DOM manipulation, buton ekleme
│   └── content.css           # Buton ve diff stilleri
├── background/
│   ├── background.js         # API istekleri
│   ├── openai-provider.js    # OpenAI API client
│   └── openwebui-provider.js # OpenWebUI API client
├── popup/
│   ├── popup.html            # Quick toggle UI
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html          # Ayarlar sayfası
│   ├── options.js
│   └── options.css
├── lib/
│   ├── crypto-js.min.js      # Encryption
│   └── diff.min.js           # Metin karşılaştırma
└── prompts/
    └── turkish-official.txt  # Türkçe resmi yazışma promptu
```

## Teknik Detaylar

- **Manifest Version**: 3
- **Permissions**: storage, activeTab
- **Host Permissions**: OpenAI API, localhost (OpenWebUI için)
- **Content Security Policy**: Güvenli, XSS korumalı

## Geliştirme

### Debug

```
chrome://extensions/ → Extension → "Inspect views: service worker"
```

Console'da hatalar ve loglar görülebilir.

### Güncelleme

Değişiklik yaptıktan sonra:
1. `chrome://extensions/` sayfasında extension'ın yanındaki "Reload" butonuna tıklayın
2. Sayfayı yenileyin (F5)

## Güvenlik

- API key'ler Chrome'un güvenli storage'ında saklanır
- Manifest V3 güvenlik standartları
- Content Security Policy koruması
- XSS koruması

## Lisans

Bu proje eğitim amaçlıdır.

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## Sorun Giderme

### "Extension yüklenmiyor"
- Developer mode aktif mi kontrol edin
- Manifest.json dosyasının geçerli olduğundan emin olun

### "API hatası alıyorum"
- API key'in doğru girildiğini kontrol edin
- OpenAI hesabınızda kredi olduğundan emin olun
- Network bağlantınızı kontrol edin

### "Butonlar görünmüyor"
- Extension'ın aktif olduğunu popup'tan kontrol edin
- Sayfayı yenileyin (F5)
- Console'da hata olup olmadığını kontrol edin

## İletişim

Sorularınız için issue açabilirsiniz.
