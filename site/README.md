# AI Türkçe Metin Düzeltici — statik site

Cloudflare Workers Static Assets için sade statik site. Çerçeve, paket bağımlılığı, sunucu, dış font, analitik veya CDN JavaScript yoktur. JavaScript kapalıyken bütün metinler ve mağaza/destek/gizlilik bağlantıları çalışır.

## Dosyalar

| Dosya | Amaç |
| --- | --- |
| `index.html` | Ana sayfa: giriş, açıklayıcı örnek, akış, editörler, kurulum, ücret ve veri, gerçek arayüz, video (gizli), SSS, destek. |
| `privacy/index.html` | `PRIVACY.md` metni, `<!-- privacy:start -->` ve `<!-- privacy:end -->` arasında. |
| `support/index.html` | Kurulum ve sorun giderme; hata tablosu 760 px altında kartlara dönüşür. |
| `404.html` | Bulunamadı sayfası. İç içe adreslerde çalışması için yolları köke göre mutlaktır (`/assets/...`). |
| `assets/css/site.css` | Tek stil dosyası; tasarım değişkenleri en üstte. |
| `assets/js/config.js` | Bağlantılar, sürümler ve video alanları. **`lib/product-config.js` + `manifest.json` kaynağından üretilir.** |
| `assets/js/site.js` | Bağlantı eşitleme, mobil menü, örnek etkileşimi, video (yalnız tıklamayla), içindekiler. |
| `assets/img/` | Gerçek ekranlar, ikonlar, yerel video kapağı, paylaşım görseli. |
| `_preview/video.html` | `video: null` iken video bileşeninin yayımlanmayan önizlemesi. |
| `_headers` | Güvenlik başlıkları (CSP: yalnız `self`; çerçeve yalnız `youtube-nocookie.com`) ve önbellek. |
| `.assetsignore` | `README.md` ve `_preview/` yayına alınmaz. |
| `robots.txt`, `sitemap.xml` | `https://duzelt.yerli.dev/` hedefli. |

## Görseller

| Dosya | Kaynak | Not |
| --- | --- | --- |
| `icon16.png`, `icon48.png`, `icon128.png` | `icons/` (manifest) | Hazırlıkta manifestle eşitlenir. `../favicon.ico` bu üç PNG'yi (16/48/128) yeniden örneklemeden içerir. |
| `popup-light.png`, `popup-dark.png` | 3.4.0 arayüzü | 380 × 522, olduğu gibi gösterilir. |
| `options-openrouter.png`, `options-desktop.png` | 3.4.0 arayüzü | 1440 × 2359. Sayfada CSS ile bir bölgesi gösterilir; dosya değiştirilmez. "Tam boyutta aç" özgün dosyaya gider. |
| `editor-before.png`, `editor-preview.png`, `editor-accepted.png` | `output/playwright/editors/quill-*.png` | 1440 × 1000, gerçek Quill 2.0.3, kontrollü örnek yanıt. Sayfada `.crop-editor` / `.crop-preview` bölgesi gösterilir. Dosya eksikse etiketli yer tutucu görünür. |
| `video-cover.png` | `store/youtube/thumbnail-1280x720.png` | 1280 × 720 gerçek ürün videosunun kapağı. Oynat düğmesi HTML'dir; görsele çizilmez. |
| `og-image.png` | Bu tasarım | 1200 × 630 paylaşım görseli. |

`options-mobile.png` bilerek kullanılmadı: dar ekranda ayarların telefon görüntüsünü göstermek, eklentinin telefonda çalıştığı izlenimini verebilir.

Kırpma bölgeleri `site.css` içinde: `.crop-connection`, `.crop-rules`, `.crop-editor`, `.crop-preview` (`--cx`, `--cy`, `--cw`, `--ch` piksel; `--iw` görüntü genişliği). Ekran düzeni değişirse yalnız bu dört sayıyı güncelleyin.

## Tasarım değişkenleri

Yapı Modernist ızgara dilindedir: görünür modüler ızgara, 2 px çizgiler (`--rule`), köşe yarıçapı 0 (`--radius`), sola hizalı başlık ve düğme etiketleri. Renkler eklenti ikonunun mavisinden (#667eea, OKLCH 0.627 0.164 271.5) OKLCH'de üretilmiştir.

- `--color-accent-100 … 900`: vurgu rampası. 500 ikon rengi, 600 ana düğme (beyaz yazıyla 5.7:1), 700 küçük vurgu metni (zeminde 7.3:1).
- `--color-neutral-100 … 900`: nötr rampa.
- Roller: `--color-bg`, `--color-surface`, `--color-raised`, `--color-text`, `--color-muted`, `--color-divider`, `--color-hairline`, `--color-accent`, `--color-accent-ink`, `--color-on-accent`, `--color-field` (afiş alanı), `--color-focus`.
- Değişiklik işaretleri: `--color-added(-bg)`, `--color-removed(-bg)`, `--color-warn(-bg)`. Eklenen metin altı çizili, çıkarılan üstü çizilidir; ekran okuyucular için "eklenen/çıkarılan" etiketi CSS ile eklenir.
- Yazı: `--font-sans` (sistem fontları), `--font-mono`, `--weight-display` 800.
- Ritim: `--leading` 28 px, `--space-*`, `--edge` (kenar boşluğu), `--wrap` 1240 px.

Koyu tema işletim sistemi tercihinden gelir (`prefers-color-scheme`). Değerler iki yerde aynıdır: medya sorgusu ve `:root[data-theme="dark"]` (yalnız önizleme için `?tema=koyu` / `?tema=acik`). Eklentiye uyarlarken iki bloğu birlikte değiştirin.

Hareket: menü açılışı, örnekteki Kabul et/İptal geçişi, SSS işareti ve düğme okları. `prefers-reduced-motion: reduce` hepsini kapatır.

## Yapılandırma ve eşitleme

`config.js` tek yerden yönetilir; anahtar adları `lib/product-config.js` ile aynıdır, ek olarak `version` (manifest), `publishedVersion` (mağazada doğrulanmış sürüm), `minimumChromeVersion`, `repository`, `issues`, `videoCover`, `videoTitle` vardır.

- HTML'deki dış bağlantılar `data-link="store|email|issues|repository|developer"` taşır. JavaScript bunları `config.js`'ten yeniden yazar; HTML'deki `href` değerleri yalnız JavaScript kapalıyken kullanılan yedektir. Hazırlık betiği bu yedekleri de aynı özniteliklere göre yeniden yazabilir.
- Sürüm metinleri `data-config="version|publishedVersion|minimumChromeVersion"` taşır. `version` ile `publishedVersion` eşit olduğunda "ekranlar 3.4.0, mağazada 3.3.0" notu kendiliğinden gizlenir.
- İç bağlantılar göreli yollardır (`privacy/`, `../support/`); config gerektirmez.
- `canonical`, Open Graph ve sitemap adresleri tarayıcılar JavaScript çalıştırmadığı için HTML'de sabittir.

## Video

`video: null` iken video bölümü gizli kalır, oynatıcı açılmaz ve YouTube'a hiçbir istek yapılmaz. Video hazır olduğunda:

1. `lib/product-config.js` içinde `video` alanına YouTube adresini veya kimliğini, `videoDurationSeconds` alanına gerçek süreyi yazın; `config.js`'i yeniden üretin.
2. Bölüm görünür olur; düğme "Tanıtımı izle" ve süre (ör. 0:35) gösterir. Erişilebilir ad aynı alandan türetilir: "Tanıtımı izle, süre 35 saniye. YouTube oynatıcısı yüklenir."
3. Tıklanınca `https://www.youtube-nocookie.com/embed/…?autoplay=1&mute=1&cc_load_policy=1&cc_lang_pref=tr` yüklenir: ses kapalı başlar, Türkçe altyazı tercih edilir. Önceden preconnect, uzak küçük resim veya YouTube isteği yoktur. YouTube gömmeleri referrer gerektirdiğinden sayfa `strict-origin-when-cross-origin` kullanır.

## Gizlilik metni

`privacy/index.html` içindeki işaretler arasındaki bölüm `PRIVACY.md`'den üretilmiştir (sözcük sırası birebir kontrol edildi). Kullanılan Markdown: `#`/`##` başlık, paragraf, `-` liste, `**kalın**`, `` `kod` ``, `[bağlantı](adres)`. `##` başlıkları Türkçe karakterleri sadeleştiren kimlik alır (ör. `#eklenti-ne-yapar`). "Son güncelleme" paragrafı `class="meta"` alır. İçindekiler listesi başlıklardan çalışma anında üretilir; ayrı bir özet yoktur.

## Yayın

3 Ekim 2026'da ayrı `duzelt-site` Worker'ı `https://duzelt.yerli.dev/` alanında yayımlandı; ana/destek/gizlilik sayfaları HTTPS200, dokümantasyon ve önizleme yolları404 doğrulandı. Asıl yapılandırma `../wrangler.site.jsonc` dosyasıdır. `npm run site:prepare` kaynakları eşitler, `npm run site:check` drift/test/syntax/dry-run kontrol eder. `site:deploy` bu kontrollerden sonra yayımlar. Mevcut GitHub bağlantısı `mytsx/duzelt-ai` / `main` / `/` olarak kaydedildi; gerçek uzak build sonucu `../evidence/delivery-results.json` içinde ayrıca tutulur.

## Kontrol listesi

- 320, 390, 768, 1024, 1440 px; açık ve koyu tema.
- Klavye: atlama bağlantısı, menü (Escape kapatır), SSS, örnek düğmeleri, görünür odak halkası.
- JavaScript kapalı: menü bağlantıları satır olarak görünür, örnek statik kalır, video gizli kalır.
