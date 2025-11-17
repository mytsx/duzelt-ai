# Repository Guidelines

## Project Structure & Module Organization
- `manifest.json` tanımlarını kontrol edin; sürüm ve izin güncellemeleri burada yönetilir.
- Çalışan kod dört ana dizine ayrılır: `background/` (OpenAI servis işçileri), `content/` (sayfa enjeksiyonu ve diff modali), `popup/` (hızlı aç/kapa arayüzü) ve `options/` (API anahtarı ve genel ayarlar). Yardımcı kütüphaneler `lib/`, görseller `icons/`, prompt taslakları `prompts/` dizinindedir.
- Testler manuel doğrulama akışlarıyla `README.md` ve `yapılacaklar.md` notlarında belgelenir; otomatik test için ayrı dizin yoktur.

## Build, Test, and Development Commands
- `npm install` – üçüncü parti araçlar eklenirse (örn. paketleme scriptleri) gereklidir; şu an bağımlılık yoktur.
- `zip -r dist.zip manifest.json background content popup options lib icons` – Chrome Web Store’a yüklemek için paket oluşturur.
- `npm run lint` veya `eslint "**/*.js"` – depoda eslint yapılandırması yok; komutu çalıştırmadan önce proje kökünde `.eslintrc` oluşturmanız gerekir.

## Coding Style & Naming Conventions
- Düz JavaScript (ES2020) ve sade CSS kullanılır; modül sistemi yoktur. 4 boşluklu girinti ve tek tırnak tercih edilir.
- Değişkenler `camelCase`, sabitler `UPPER_SNAKE_CASE` olarak yazılır (`STORAGE_KEYS`, `CONFIG`).
- Dosya adları küçük harf ve tireli (`content.js`, `popup.html`). Yeni servisler için `background/` altında ayrı dosyalar oluşturun.

## Testing Guidelines
- Birleştirmeden önce manuel senaryolar çalıştırın: popup toggle, ayarlar sayfası kaydet/test, içerik betiğinde farklı editörlerde “Düzelt” akışı.
- Hata ayıklamak için `chrome://extensions` → “Service worker” loglarını ve içerik betiği konsolunu takip edin.

## Commit & Pull Request Guidelines
- Geçmişte `type: summary (version)` kalıbı kullanılıyor (`feat`, `fix`, `chore`, `docs`). Aynı konvansiyonu koruyun.
- Her PR açıklamasında: kapsam özetini, kullanıcı etkisini, manuel test adımlarını ve varsa ekran görüntülerini belirtin. API anahtarı veya gizli bilgileri asla PR’a eklemeyin.

## Security & Configuration Tips
- OpenAI anahtarlarını yalnızca `options/` arayüzü üzerinden girin; kaynak kod içine gömmeyin. Depoda API çağrılarını yöneten tek nokta `background/openai-provider.js` olmalıdır.
- Yeni harici hizmetler eklerken izin listesine `manifest.json` içinde net host kalıpları ekleyin ve gereksiz izinleri kaldırın.
