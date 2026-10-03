# Doğrulama ve kanıt sınırları

Son güncelleme: 3 Ekim 2026

Bu kayıt, bakım testlerini, gerçek uygulama doğrulamasını ve yayın durumunu ayrı tutar. Tamamlanmamış bir kontrol, başarılı olarak sunulmaz.

## Kanıt sınıfları

| Kontrol | Neyi doğrular? | Neyi doğrulamaz? |
| --- | --- | --- |
| Kaynak ve manifest incelemesi | İzinler, veri akışı, saklama alanları ve kodun hedeflediği entegrasyonlar. | Gerçek editör veya belirli CMS üzerinde çalışma. |
| Taklit API yanıtlarıyla yerel test | Protokol ailelerinin istek/yanıt sözleşmesi, izin/kimlik ayrımı, zaman aşımı ve geçersiz yanıt davranışı. | Gerçek sağlayıcı hesabı, faturalandırma, bütün modellerin erişimi veya Türkçe düzeltme kalitesi. |
| Kaynak kataloğu ve URL/gövde taraması | Bütün kaynak sağlayıcılarının taşınması, model eleme/alan eşlemesi ve örnek profillerle istek oluşturulabilmesi. | Sağlayıcıya ağ isteği, hesap yetkisi, endpoint'in canlı cevabı veya fiyatı. |
| Gerçek editörle tarayıcı testi | Test edilen editör sürümünün düğme/önizleme/iptal/kabul ve veri modeli davranışı. | Aynı editörü kullanan bütün siteler. |
| ZIP doğrulaması | Paket içeriği, kök manifest, çalışma bağımlılıkları, CRC ve tekrarlanabilirlik. | Chrome Web Store onayı. |
| Uzak build ve canlı HTTPS | İncelenen commit'in otomatik build/deploy'u ve canlı sayfa içeriği. | Yerel testin veya mağaza incelemesinin tamamlandığı. |
| Mağaza sayfası ve paneli | Kamuya açık yayın sürümü; ayrıca panel doğrulanırsa kayıtlı/incelemede/yayınlanmış durumu. | Yerel paketin veya kayıtlı taslağın herkes için yayınlandığı. |

## Mevcut durum

3 Ekim 2026'da Google'ın mevcut mağaza sayfası HTTP 200 ile doğrulandı: öğe kimliği `gnkhgnhdokinbamhokpljgafapfjhjhl`, yayın sürümü `3.3.0`, son mağaza güncellemesi 27 Kasım 2025. Yerel bakım sürümü `3.4.0`; aynı öğe için hazırlanıyor. Geliştirici paneli henüz doğrulanmadı ve yeni paket mağazaya gönderilmedi. GitHub varsayılan dalı `main`; release listesi boş. Kaynak kayıt: [current-state.json](current-state.json).

Gerçek, yerel classic editör kurulumlarıyla test edilen sürümler: CKEditor 4 **4.22.1**, CKEditor 5 **48.5.2**, Summernote **0.9.1** (jQuery **3.7.1**), TinyMCE **8.9.2**, Quill **2.0.3** ve **1.3.7**. Editör desteği bu sürüm/kurulumlarla sınırlıdır. WordPress, Drupal, Joomla ve Notion için ayrıca platform testi yoktur; cross-origin iframe, CKEditor 5 çok köklü/işbirlikçi kurulumlar ve Markdown/XML veri işlemcileri doğrulanmadı.

## Yerel komutlar

```sh
npm ci
npx playwright install chromium
npm run test:provider
node tests/provider-edge-evidence.cjs
node tests/editor-bootstrap.mjs
npm run test:editors
npm run test:ui
python3 -m unittest discover -s tests -p 'test_package_store.py'
python3 -m unittest discover -s tests -p 'test_provider_catalog.py'
python3 tools/package-store.py
```

API testleri sahte anahtar/metin ve taklit servis yanıtları kullanır; gerçek hesap, kişisel sır veya ücretli istek kullanılmaz. Paket testleri geçici örnek çalışma klasörlerini kullanır; gerçek kullanıcı ayarlarını okumaz.

Paketleyici regresyonları **7/7 geçti**: yalnız kullanılan çalışma dosyaları, CSS/getURL/importScripts bağımlılıkları, eksik dosya, dar izin listesi/yol dışına çıkma, sembolik bağlantı, dinamik/uzak kod reddi ve dosya zamanları değişse de aynı ZIP çıktısı. Son paket **19 çalışma dosyası** içerir; sağlayıcı kataloğu ve merkezi servis bu listeye dahildir. `lib/crypto-js.min.js`, kaynak metadata önbelleği ve test dosyaları alınmaz. Manifest/CRC/içerik doğrulandı, kaynak değişmeden tekrarlanan üretim aynı ZIP'i verdi. `dist/duzelt-ai-3.4.0.zip` SHA-256: `c72e73e20a9e048b9f3a708624df48a5336a5f2c47f6efd87f7023078eafe4fc`. Çalışma kaynağı değişirse bu paket yeniden üretilmelidir.

Gerçek paketlenmemiş eklentinin yeni popup/ayarlar kontrolü Chromium **151.0.7922.34** ile **19/19 geçti**. Kanıt dosyası: [ui-results.json](../evidence/ui-results.json); ayrıntılı kaynak `output/playwright/ui-results.json`. Sağlayıcı seçimi/anahtar/prompt kaydı, eski OpenAI kaydının korunması, ayrı profiller, model araması, desteklenmeyen kayıtların durumu, kullanıcı eylemiyle model yenileme/test, IBM/SAP dinamik alanları ve iki origin izni, sır alanlarının maskelenmesi, tokenın depoya yazılmaması, toggle, sabit bağlantılar ve klavye akışları kapsanır. Chrome'un yerel API izin penceresinin sonucu fixture ile taklit edildi; gerçek kullanıcının izin kabulü bu koşuda doğrulanmadı. Gerçek sağlayıcı ağ isteği **0**.

Açık/koyu tema için **320/390/768/1024/1440 px** ayarlar görselleri ve iki popup görseli gerçek görüntü olarak incelendi. Başlık, alan, Türkçe açıklama, düğme, klavye odağı ve popup yüksekliği kontrol edildi; kırpılma/üst üste binme görülmedi. Bu sonuç son arayüz kaynaklarına ve kaydedilmiş ekran görüntülerine aittir.

Gerçek editör tarayıcı testinde **127/127**, bootstrap kontrolünde **7/7 geçti**; sayfa hatası yok. Altı sürümün tamamında native undo, yazım/kelime ekleme-çıkarma, kalın/italik/bağlantı/liste korunması, iptal/devre dışı bırakma ve bekleyen/önizlenen metnin değişmesi kapsanır. Test gerçek manifestin MAIN/ISOLATED betiklerini ve merkezi arka plan servisini kullanır; taşıma katmanı taklit edilir, gerçek sağlayıcı isteği **0**. Kanıt: [editor-results.json](../evidence/editor-results.json), ayrıntılı kayıt `output/playwright/editors/results.json`.

Merkezi ve bağımsız sağlayıcı testleri **155/155 geçti**: 12 çalışma protokolü, API hata ayrımları, her HTTP isteğinde 25 saniye sınırı, strict JSON sonucu, depolama/izin/yönlendirme sınırları, Azure model/deployment ayrımı, Mantle Responses/model keşfi ve IBM IAM/SAP OAuth-Orchestration kapsanır. Bu toplamın içinde **40** bağımsız kimlik/izin/gizlilik regresyonu vardır. Tam katalogdaki **225** protokol sağlayıcısı için **7.806** URL/gövde fixture'ı oluşturuldu: **7.804** seçilebilir katalog model kaydı + katalog modeli olmayan iki yerel sağlayıcı için manuel örnek. SAP native OpenAI ayrıca özel fixture ile sınanır. Kanıt: [provider-edge-review.json](../evidence/provider-edge-review.json); ağ çağrısı **0**, çözülemeyen adres şablonu veya kimlik sınırını aşan override yok. Bu, canlı hesap veya bütün modellerin metin kalitesi testi değildir. SAP X.509/mTLS ve IBM yazılım/deployment/gateway ürünleri bu kimlik sözleşmesinin dışındadır.

Katalog hazırlığında **30/30** kalıcı regresyon testi geçti (`tests/test_provider_catalog.py`); 226 kaynak sağlayıcısı eksiksiz taşındı, tarih/SHA-256/MIT lisansı, model/URL/alan sınırları, IBM IAM/SAP OAuth-Orchestration profil sözleşmesi, tekrarlanabilir çıktı ve paket bağımlılıkları doğrulandı. İlk kaynak taramasının kanıtı `output/provider-research/catalog-validation.json` eski 223 sağlayıcı aşamasına aittir; güncel katalogda 225 protokol sağlayıcısı ve 7.804 seçilebilir model adayı vardır. Kalıcı test ve tekrar komutu [providers-research.md](providers-research.md) dosyasındadır.

## Sağlayıcı entegrasyonu ve model kararı

Mevcut `gpt-4o` ve `temperature: 0.3` korundu. Resmî [GPT-4o belgesi](https://developers.openai.com/api/docs/models/gpt-4o) mevcut modelin Chat Completions desteğini doğrular. Karşılaştırmalı Türkçe kalite deneyi yapılmadığı için model değişikliği gerekçesi bulunmadı. Güncel kullanım fiyatı OpenAI'nin model sayfasından kontrol edilmelidir; eklenti/API ücretleri ayrıdır.

OpenAI/gpt-4o JSON modu korundu; bütün ailelerde özel prompta da `corrected_text` sözleşmesi için JSON talimatı eklenir. Boş/geçersiz/kesilmiş yanıt uygulanmaz. JSON/format alanları model ve protokol desteğine göre kullanılır. API anahtarı/metin/prompt ve ham servis hataları loglara taşınmaz; hata türleri sabit Türkçe mesajlara çevrilir. Eski yerel anahtar korunur; yeni sağlayıcı profilleri de local'dir, yalnız açma/kapatma sync'tir. Chrome destekliyorsa `TRUSTED_CONTEXTS` uygulanır. OpenAI chat ve Responses yolundaki `store: false`, bütün servis/gateway'ler için sıfır saklama garantisi değildir.

Her HTTP isteğinin zaman aşımı **25 saniyedir**; gövde okuması bu süreye dahildir. IBM/SAP için token değişimi ve inference ayrı HTTP sınırları kullanır; toplam işlem yaklaşık 50 saniyeye çıkabilir. Bu süre, MV3 servis işçisinin uzun süren fetch nedeniyle kapanmasından önce anlaşılır hata döndürmek için seçildi; [Chrome servis işçisi yaşam döngüsü](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) belgesi incelendi.

## Yerel testlerde kapsanan kabul kontrolleri

- [x] Popup açma/kapatma, düğmelerin eklenmesi/kaldırılması ve dinamik editör davranışı.
- [x] Sağlayıcı profili/anahtar/prompt kaydı, eski kullanıcı kaydı ve kaydedilmiş değerlerle test akışı.
- [x] Taklit servis yanıtlarında bağlantı, kota, rate limit, zaman aşımı ve geçersiz/kesilmiş JSON.
- [x] Listelenen altı classic editör kurulumu: düğme, diff, iptal, kabul, veri modeli ve native undo.
- [x] Çoklu/dinamik editör, bekleyen istekte/önizlemede metin değişmesi ve stale sonucun uygulanmaması.
- [x] Türkçe karakterler, kelime ekleme/çıkarma, biçimli paragraflar/listeler/bağlantılar.
- [x] HTML güvenliği, tehlikeli bağlantı/olay özniteliklerinin temizlenmesi ve model metninin HTML olarak çalıştırılmaması.
- [x] Normal input/textarea alanlarına düğme eklenmemesi.

## Ayrıca gerekli gerçek ortam kontrolleri

- [ ] Kullanıcının kendi Chrome profilinde seçilen API origin'i için gerçek izin penceresi, kabul/ret ve izin kaldırma.
- [ ] Gerçek sağlayıcı hesabı/anahtarı/bölgesi ile model erişimi, faturalandırma ve Türkçe düzeltme kalitesi. Yerel fixture başarısı bu kontrolün yerine geçmez.
- [ ] Belirli bir WordPress/Drupal/Joomla/Notion veya diğer üretim sitesinin kendi editör kurulumuyla uyumluluk.
- [x] Son arayüzün bütün ekran görüntülerinde gerçek görsel inceleme sonucu.
- [ ] Uzak build/canlı site ve Chrome Web Store geliştirici paneli/inceleme/yayın sonucu.

## Tasarım ve yayın aşaması

Claude Design dosyaları henüz gelmedi. Bu aşamadan önce site tasarımı/yayını, video görselleri veya mağaza tanıtım görselleri tamamlanmış sayılmaz.

Tasarım geldiğinde 320, 390, 768, 1024 ve 1440 px genişliklerde gerçek tarayıcı görsel kontrolü; klavye erişimi; hareket azaltma; yalnız tıklama sonrası YouTube oynatıcı yükleme; güncel süre/erişilebilir düğme adı kontrol edilir. Ardından gerçek `main` push'u için uzak build ve canlı HTTPS kanıtları kaydedilir.

Video kontrolü, 1920×1080 H.264/30 fps/AAC biçimini, Türkçe SRT'yi, ses/müzik seviyelerini, gerçek sözcük/durak senkronunu ve baştan sona izleme/dinlemeyi kapsar. YouTube HD/telif sonucu ile mağaza inceleme durumu ayrı kaydedilir.
