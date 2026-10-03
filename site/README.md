# AI Türkçe Metin Düzeltici — web sitesi

Cloudflare Workers Static Assets üzerinde sade site. Dış font ve analitik yoktur. Geri bildirim API'si aynı `duzelt-site` Worker'ında uygulanır; e-posta teslimi sunucu tarafında Nodemailer `10.0.14` kullanır. Canlı geri bildirim teslimi aşağıdaki durum kaydıyla ayrıca doğrulanır. Form doğrulaması için Cloudflare Turnstile betiği yüklenir. JavaScript kapalıyken metinler, mağaza/destek/gizlilik bağlantıları ve e-posta/GitHub seçenekleri çalışır; form gönderimi JavaScript gerektirir.

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
| `assets/js/feedback.js` | Geri bildirim formu, kullanıcı açınca Turnstile doğrulaması ve gönderim durumları. |
| `../worker/` | Geri bildirim doğrulaması, kuyruk tüketimi ve SMTP/HTML e-posta; eklenti ZIP'ine girmez. |
| `assets/img/` | Gerçek ekranlar, ikonlar, yerel video kapağı, paylaşım görseli. |
| `_preview/video.html` | `video: null` iken video bileşeninin yayımlanmayan önizlemesi. |
| `_headers` | Güvenlik başlıkları ve önbellek; YouTube çerçevesi tıklama sonrasında, Turnstile doğrulaması form kullanılırken yüklenir. |
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

3 Ekim 2026'da ayrı `duzelt-site` Worker'ı `https://duzelt.yerli.dev/` alanında yayımlandı; ana/destek/gizlilik sayfaları HTTPS 200, dokümantasyon ve önizleme yolları 404 olarak doğrulandı. Asıl yapılandırma `../wrangler.site.jsonc` dosyasıdır. `npm run site:prepare` kaynakları eşitler, `npm run site:check` drift/test/syntax/dry-run kontrol eder. `site:deploy` bu kontrollerden sonra yayımlar. Mevcut GitHub bağlantısı `mytsx/duzelt-ai` / `main` / `/` olarak kaydedildi; gerçek uzak build sonucu `../evidence/delivery-results.json` içinde ayrıca tutulur.

## Kontrol listesi

- 320, 390, 768, 1024, 1440 px; açık ve koyu tema.
- Klavye: atlama bağlantısı, menü (Escape kapatır), SSS, örnek düğmeleri, görünür odak halkası.
- JavaScript kapalı: menü bağlantıları satır olarak görünür, örnek statik kalır, video gizli kalır.


## Geri bildirim kurulumu ve işletimi

**4 Ekim 2026 durumu:** Form kodu ve Turnstile SDK düzeltmesi (`01ab2ef`, `6c96419`) main'e pushlandı; mevcut Workers Builds üzerinden otomatik build/deploy başarılı. Bu turdaki Worker sürümü `94e7bfa1…` ile başlıyor. Canlı yapılandırma HTTP 200 / `enabled: true`, `/.env` HTTP 404. İlk gerçek POST HTTP 503 döndüğü için gerçek kuyruk kabulü ve e-posta teslimi tamamlandı sayılmıyor. Worker uyumluluk düzeltmesi yerel workerd testiyle hazır; yeniden yayın ve canlı doğrulama bekliyor.

Yerel test, canlı gönderim ve posta kutusu sonuçları aşağıdaki tabloda ayrı izlenir:

| Kontrol | Sonuç |
| --- | --- |
| Sunucu birim testleri | 33/33; taklit SMTP/Turnstile/Queue, bağımsız tekrar başarılı. |
| Form arayüzü | 37/37 Chromium; 8 tema/genişlik birleşimi, 13 görsel incelemesi. |
| Genel site | 58 kontrol, 40 tema/genişlik ölçümü; `pageErrors: []`. |
| E-posta şablonu | 390/768 px'de iki örnek, 4/4 render kontrolü; gelen kutusu testi değil. |
| Yerel SMTP ön kontrolü | TLS sertifikası + auth başarılı; e-posta gönderilmedi. |
| Turnstile | Yalnız `duzelt.yerli.dev` widget'ı; gerçek belirteç ayrı Siteverify işleminde doğru hostname/action ile kabul edildi. |
| Canlı form kabulü | İlk deneme HTTP 503; düzeltme ve başarılı 202 denemesi bekliyor. |
| Worker SMTP / gelen kutusu | Henüz doğrulanmadı. |

Gerçek Chrome'da 320, 390, 768 ve 1440 px genişliklerde yatay taşma görülmedi; e-posta alternatifi görünür kaldı. Bu canlı kontrol sırasında güncel SDK kodu önbellek kapatılarak yüklendi; eski önbelleğin giderilmesi ayrıca tamamlanacak.

Mevcut `duzelt-site` Worker'ı korunur. `/api/*` istekleri `worker/` koduna, diğer istekler `ASSETS` binding'ine gider. `nodejs_compat` sunucudaki SMTP istemcisi içindir. Eklentinin model API akışı bu sunucuya taşınmaz. Kalbur Worker'ı, widget'ı ve kuyrukları değiştirilmez; yeni kaynak adları Düzelt'e aittir.

### Yerel alanlar ve secret aktarımı

Proje kökündeki `.env` yalnız sahibinin okuyabildiği `0600` izinli ve Git dışında bir dosyadır. Canlı Worker'a gerekli 11 alan şifreli secret olarak aktarılmıştır; değerler belge veya çıktıya yazılmaz. `.env.example` gerçek şifre içermez. SMTP sunucusu, kullanıcı ve şifre servis sağlayıcının verdiği bilgilerle doldurulur; tahmin edilmez. Mevcut alanlar kullanıcının değerleriyle korunur. Turnstile alanları ilk hazırlık aşamasında boş kalabilir; üretim widget'ı yalnız `duzelt.yerli.dev` alanına bağlandıktan sonra doldurulur.

| Alan | Anlam |
| --- | --- |
| `SMTP_HOST` | Sertifika adıyla uyumlu SMTP sunucu hostname'i. |
| `SMTP_PORT` | Sağlayıcının söylediği port. |
| `SMTP_SECURE` | `465` için doğrudan TLS: `true`; `587` için STARTTLS: `false`. Sağlayıcının talimatı esas alınır. |
| `SMTP_REQUIRE_TLS` | `true`; şifreli bağlantı zorunlu, bu alan TLS'yi kapatma seçeneği değildir. |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP kimlik bilgileri; kullanıcı adı gönderenden farklı olabilir. |
| `MAIL_FROM`, `MAIL_TO` | Sunucudaki sabit gönderen/alıcı. Kullanıcının değişiklikleri korunur. |
| `TURNSTILE_SITE_KEY` | Widget'ın herkese açık site anahtarı. |
| `TURNSTILE_SECRET_KEY` | Yalnız sunucudaki doğrulama sırrı. |

Gerçek değerleri komut argümanına, kabuk geçmişine, ekran görüntüsüne, loga veya Git'e yazmayın. Mevcut Worker'ın Cloudflare secret mekanizmasını kullanın; [Wrangler secret aktarımı](https://developers.cloudflare.com/workers/configuration/secrets/) için yalnız gerekli alanları standart girişten veren ve hiçbir değeri yazdırmayan yöntem seçin. Toplu aktarıma ilgisiz `.env` alanları eklenmez. `.env` site varlıklarına, Worker derleme çıktısına ve eklenti ZIP'ine kopyalanmaz. Secret'lar kurulunca sonraki yayınların mevcut secret binding'lerini koruduğunu doğrulayın; sırları build-time HTML/JS değişkenlerine dönüştürmeyin.

`SMTP_SECURE=false` şifresiz e-posta demek değildir: STARTTLS zorunludur. SMTP istemcisi `requireTLS: true`, `rejectUnauthorized: true` ve SMTP hostname'ini koruyan bağlantı kullanır. Sertifika kontrolünü kapatmak çözüm değildir. [Nodemailer TLS/STARTTLS seçenekleri](https://nodemailer.com/smtp).

`FEEDBACK_IP_HASH_KEY`, operatör tarafından güvenli rastgele üretilen en az 32 karakterlik ayrı Worker secret'ıdır; kullanıcının SMTP alanı değildir. IP rate-limit anahtarı bu sırla HMAC olarak üretilir. Anahtarı kaynağa veya tarayıcıya taşımayın.

### Worker, Turnstile ve kuyruk ayarları

`SITE_ORIGIN=https://duzelt.yerli.dev`, `worker/feedback.mjs` içindeki sunucu sabitidir; `FEEDBACK_ENABLED` Wrangler yapılandırmasındaki etkinlik anahtarıdır. Form yalnız gerekli alanlar, Queue ve rate-limit binding'leri hazırken açılır. `/api/feedback/config` yalnız etkinlik durumu ve public sitekey döndürür; SMTP/Turnstile secret'ı istemciye verilmez. Üretim action'ı istemci ve sunucuda `feedback` değeridir. Turnstile Siteverify sonucu `success`, tam hostname ve action ile doğrulanır. Token tek kullanımlıktır; hata veya süresi dolma sonrasında yenilenir. Sunucudaki Siteverify isteği `redirect: manual` kullanır ve bütün 3xx yanıtları reddeder; doğrulama sırrı yönlendirme hedefine aktarılmaz. Tarayıcıya özgü istek seçenekleri sunucu çağrısına eklenmez. [Sunucu doğrulaması](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

- Ana kuyruk: `duzelt-feedback`; binding `FEEDBACK_QUEUE`.
- Başarısız kuyruk: `duzelt-feedback-dlq`; ana tüketicide `dead_letter_queue`.
- Tüketici: `duzelt-site`; SMTP başarısından sonra ACK, hata halinde sınırlı gecikmeyle retry; `max_retries: 3`.
- Her kuyruk: ayrı ayrı `86.400` saniye mesaj saklaması. Free planda kuyruk saklaması 24 saattir; Paid planda değiştirilebilir. DLQ'nun varsayılanını kullanmak yerine onun ayarını da doğrulayın. [Queues sınırları](https://developers.cloudflare.com/queues/platform/limits/), [başarısız mesaj kuyruğu](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/).
- `FEEDBACK_RATE_LIMITER`: IP özeti için dakikada 5 deneme. `FEEDBACK_GLOBAL_LIMITER`: uygulama anahtarı için dakikada 60 gönderim. Düzelt namespace'leri `2026100303` / `2026100304` olup Kalbur'dan ayrıdır. Sayaçlar Cloudflare konumu bazlı ve yaklaşık çalışır; bunlar kesin küresel kota değildir. Ortak IP kullanan ziyaretçiler aynı IP sınırını paylaşabilir. [Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Origin, JSON içerik tipi, gerçek akışta 16 KiB gövde, 4.000 karakter mesaj ve gizli tuzak alanı kontrol edilir. Yanıt e-postası, sürüm ve tarayıcı isteğe bağlı, elle girilen alanlardır. Keyfî alıcı alanı kabul edilmez. E-posta başlıkları kullanıcı girdisinden türetilmez; e-posta yalnız Reply-To olarak kullanılır.

### Kabul, SMTP ve gelen kutusu kanıtı

API alanları `type`, `message`, `replyEmail`, `appVersion`, `browser`, `website` (tuzak alanı) ve `turnstileToken` ile sınırlıdır. `GET /api/feedback/config`, `{ enabled, siteKey, action }` döndürür. Token ve IP kuyruk kaydına eklenmez; kayda UUID ve tarih eklenir.

Üç teslim aşamasını ayrı değerlendirin:

1. `202 { accepted: true, id, message }`: ana kuyruğa yazma başarılı.
2. `feedback_smtp_accepted`: SMTP sunucusu e-postayı kabul etti; ardından Queue ACK verilir.
3. Gelen kutusunda görünme: ayrıca posta kutusu erişimiyle kontrol edilir.

SMTP sunucusunun kabul etmesi tek başına gelen kutusunda görünme kanıtı değildir. [En az bir kez teslim](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) nedeniyle aynı kayıt tekrar işlenebilir; e-postadaki tam kayıt kimliği ve Message-ID ile eşleştirin. Kuyruk kabulünü “e-posta teslim edildi” diye göstermeyin. Oluşturulmasının üzerinden 24 saat geçen kayıt SMTP'ye tekrar gönderilmez; tüketici kaydı ACK ile kapatır. Ana ve DLQ bağımsız süreleri nedeniyle toplam kuyruk saklaması en çok 48 saate çıkabilir.

Kontrollü testler açıkça test olarak işaretlenmiş, az sayıda bildirimle ve sunucudaki sabit `MAIL_TO` hedefine yapılır. Testte üç sonuç ayrı kaydedilir: form/kuyruk kabulü, SMTP sunucusu kabulü ve erişilebiliyorsa gelen kutusunda okunaklı görünüm. Gelen kutusuna erişilmediyse bunu bekleyen doğrulama olarak bırakın. HTML kaçışı, düz metin alternatifi, boş alanların gizlenmesi, Europe/Istanbul tarih ve Reply-To davranışı ayrıca kontrol edilir; mesajda uzak font, izleme pikseli veya dış görsel yoktur.

### Arıza ve silme işlemleri

`feedback_accept_failed` / `feedback_delivery_failed` olaylarını ve kuyruk birikimini kontrol edin. `feedback_smtp_accepted` yalnız SMTP sunucusu kabulünü gösterir. Uygulama loguna yalnız olay adı, kayıt kimliği ve sınırlandırılmış hata sınıfı yazılır; mesaj/e-posta/ham IP/token/şifre yazılmaz. `invocation_logs:false`, `redact_query_string:true` ve trace kapalı ayarı, otomatik istek URL/header/IP kaydını bu uygulamanın log/trace çıktısına eklemez; allowlist console olayları tutulur. Canlı hesapta mevcut Workers Paid planı doğrulandı; Workers Logs en çok 7 gün saklanır. Free plana geçilirse resmî tablo 3 gündür; politika ve işletim kaydını yeni plana göre eşitleyin. Kuyruk saklamasıyla log saklaması farklıdır. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

SMTP sorunu varsa 24 saatlik DLQ süresi dolmadan giderin. Başarısız kayıtları açmak veya yeniden göndermek kişisel veri erişimidir; içeriği açık loga dökmeyin. Hata kuyruğunda tekrar gönderme otomatik sınırsız döngüye dönüştürülmez. Ana ve DLQ'daki süre dolan mesajlar otomatik silinir; kuyruğun süresinin dolması posta kutusundaki e-postayı silmez.

Geliştiricinin posta kutusundaki bildirim ve yanıtları talep kapandıktan sonra en geç 30 gün içinde elle silin. Aylık kontrol yapın; silinmişler/çöp kutusu ve destek yazışmasının ek kopyalarını da gözden geçirin. Bu bir otomatik posta silme görevi değildir. Bir silme talebini tam kayıt kimliğiyle eşleştirin; kullanıcıya uygulanan işlemi ve kalan sağlayıcı sınırlarını açıkça bildirin.

Turnstile/SMTP arızasında `FEEDBACK_ENABLED=false` ile yeni gönderimleri durdurun. E-posta ve GitHub alternatifleri görünür kalır. Worker sürümüne geri dönmek, kuyrukta bekleyen mesajları veya posta kopyalarını kendiliğinden silmez; gizlilik ve form durumu fiilî veri akışıyla uyumlu tutulur. Mevcut `main` → Workers Builds düzeniyle yayın yapılır; ikinci bir CI/yayın düzeni kurulmaz.

### Yeni form için kontrol listesi

Yerel Chromium form turu **37/37** geçti: dört genişlik × iki tema, klavye/etiket/durum, çevrimdışı mesaj koruma ve eş zamanlı gönderim engeli. İzole fixture kullanılır; gerçek CAPTCHA/SMTP çağrısı yoktur. 13 form PNG'sinin görsel incelemesi tamamlandı. [Form kanıtı](../evidence/feedback-ui-results.json).

Mevcut site akışı **58 kontrol**, **40 tema/genişlik ölçümü** ve `pageErrors: []` ile geçti. 72 site görüntüsü yakalandı; raporun genel görsel inceleme durumu ayrıca izlenir. [Site kanıtı](../evidence/feedback-site-ui-results.json).

HTML e-posta örnekleri 390/768 px'de 4/4 kontrolle taşmadan render edildi. Kuyruk panellerinde ana ve DLQ saklaması ayrı ayrı **86.400 saniye** olarak doğrulandı; bu, tüketicinin SMTP teslim kanıtı değildir. [E-posta görünümü](../evidence/feedback-email-render-results.json).

Sunucu birim testleri: `node --test tests/feedback.test.mjs` — **33/33 geçti**, bağımsız tekrar da başarılı. Doğrulama/stream gövde sınırı/Origin, HMAC, Turnstile yanıtları, rate-limit reddi, kuyruğu bekleyen 202 yanıtı, sabit alıcı/Reply-To, HTML kaçışı, ACK/retry, özel veri içermeyen log ve 24 saatlik job sınırı kapsanır. Testler taklit SMTP/Turnstile/Queue kullanır; gerçek TLS el sıkışması, gerçek token tekrar kullanımı, Cloudflare DLQ yönlendirmesi veya gelen kutusu kanıtı değildir. Üretimdeki Siteverify modülü ayrıca yerel workerd içinde, dış istek göndermeyen fixture ile denenir: desteklenen Request seçenekleri ve 3xx reddi doğrulanır. SMTP bağlantı zaman aşımı kaynakta ayarlanır; sürenin gerçekten dolması bu birim turunda denenmez.

- 320, 390, 768 ve 1440 px; klavye odağı, etiketler, teknik bilgiler açılır alanı ve erişilebilir durum mesajları.
- E-postasız gönderim, hata/ağ kesintisinde mesajın korunması, yinelenen gönderimin engellenmesi ve görünür e-posta alternatifi.
- Doğrulama/boyut/Origin/içerik tipi, Turnstile hostname/action/süre ve hız sınırı.
- Queue arızası, SMTP retry/ACK, sabit alıcı, Reply-To, HTML kaçışı ve düz metin e-posta.
- `.env`/secret'ların Git, site varlıkları, dry-run çıktısı ve eklenti ZIP'i dışında kaldığı.
- Canlı form kabulü, SMTP kabulü, varsa gelen kutusu; gerçek main push sonrası uzak build ve yayın.
