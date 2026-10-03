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

3 Ekim 2026'da Google'ın mevcut mağaza sayfası HTTP 200 ile doğrulandı: öğe kimliği `gnkhgnhdokinbamhokpljgafapfjhjhl`, yayın sürümü `3.3.0`, son mağaza güncellemesi 27 Kasım 2025. Aynı öğeye bakım sürümü `3.4.0` yüklendi ve gerçek geliştirici panelinden incelemeye gönderildi. Sonuç **İncelenmeyi bekliyor**; onay sonrası otomatik yayın seçeneği açıktır. Bu, 3.4.0'ın kamuya yayımlandığı anlamına gelmez. GitHub varsayılan dalı `main`; release listesi boş. Kaynak kayıt: [current-state.json](current-state.json), [submission.json](../store/submission.json).

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

Paketleyici regresyonları **7/7 geçti**: yalnız kullanılan çalışma dosyaları, CSS/getURL/importScripts bağımlılıkları, eksik dosya, dar izin listesi/yol dışına çıkma, sembolik bağlantı, dinamik/uzak kod reddi ve dosya zamanları değişse de aynı ZIP çıktısı. Paket **19 çalışma dosyası** içerir; sağlayıcı kataloğu ve merkezi servis bu listeye dahildir. `lib/crypto-js.min.js`, kaynak metadata önbelleği ve test dosyaları alınmaz. Manifest/CRC/içerik ve kaynak değişmeden tekrarlanan üretimin aynı ZIP'i vermesi doğrulandı. `dist/duzelt-ai-3.4.0.zip` güncel kaynakla iki kez üretildi; SHA-256: `974ae8d6008fc75289796521a2800936ff81d0004d19a360e3b852de9f01223b`. ZIP içeriği kaynak dosyalarla birebir karşılaştırıldı.

Gerçek paketlenmemiş eklentinin yeni popup/ayarlar kontrolü Chromium **151.0.7922.34** ile **36/36 geçti**. Kanıt dosyası: [ui-results.json](../evidence/ui-results.json); ayrıntılı kaynak `output/playwright/ui-results.json`. Sağlayıcı seçimi/anahtar/prompt kaydı, eski OpenAI kaydının korunması, ayrı profiller, model araması, desteklenmeyen kayıtların durumu, kaydedilmiş bağlantıyla test, IBM/SAP dinamik alanları ve iki origin izni, sır alanlarının maskelenmesi, tokenın depoya yazılmaması, toggle ve sabit bağlantılar kapsanır. Sağlayıcı listesindeki arama ile Home/End/Escape klavye akışı; Ollama seçiminde otomatik keşif; taslak URL değişince eski sonuçların uygulanmaması; komut kopyalama; bağlantı hatası/403/boş liste davranışı doğrulandı. İlk açılışta izin yoksa GET yapılmaz; izin varsa kayıtlı model korunur ve liste kapalı kalır. Chrome'un yerel API izin penceresinin sonucu fixture ile taklit edildi; gerçek kullanıcının izin kabulü bu koşuda doğrulanmadı. Bu arayüz koşusunda gerçek sağlayıcı ağ isteği **0**.

Açık/koyu tema için **320/390/768/1024/1440 px** ayarlar görselleri ve iki popup görseli gerçek görüntü olarak incelendi. Başlık, alan, Türkçe açıklama, düğme, klavye odağı ve popup yüksekliği kontrol edildi; kırpılma/üst üste binme görülmedi. Bu sonuç son arayüz kaynaklarına ve kaydedilmiş ekran görüntülerine aittir.

Gerçek editör tarayıcı testinde **127/127**, bootstrap kontrolünde **7/7 geçti**; sayfa hatası yok. Altı sürümün tamamında native undo, yazım/kelime ekleme-çıkarma, kalın/italik/bağlantı/liste korunması, iptal/devre dışı bırakma ve bekleyen/önizlenen metnin değişmesi kapsanır. Test gerçek manifestin MAIN/ISOLATED betiklerini ve merkezi arka plan servisini kullanır; taşıma katmanı taklit edilir, gerçek sağlayıcı isteği **0**. Kanıt: [editor-results.json](../evidence/editor-results.json), ayrıntılı kayıt `output/playwright/editors/results.json`.

Merkezi ve bağımsız sağlayıcı testleri **188/188 geçti**: 12 çalışma protokolü, API hata ayrımları, her HTTP isteğinde 25 saniye sınırı, strict JSON sonucu, depolama/izin/yönlendirme sınırları, Azure model/deployment ayrımı, Mantle Responses/model keşfi, IBM IAM/SAP OAuth-Orchestration ve yerel model keşfi kapsanır. Ollama native liste/JSON Schema, isteğe bağlı yetenek filtresi, proxy kökü, anahtarsız GET, taslak keşfin ayarlar sayfası/loopback/izin sınırı ve kayıtlı ayarlara dokunmaması kontrol edilir. Bu toplamın içinde **40** bağımsız kimlik/izin/gizlilik regresyonu vardır. Tam katalogdaki **225** protokol sağlayıcısı için **7.806** URL/gövde fixture'ı oluşturuldu: **7.804** seçilebilir katalog model kaydı + katalog modeli olmayan iki yerel sağlayıcı için manuel örnek. SAP native OpenAI ayrıca özel fixture ile sınanır. Kanıt: [provider-results.json](../evidence/provider-results.json), [provider-edge-review.json](../evidence/provider-edge-review.json); ağ çağrısı **0**, çözülemeyen adres şablonu veya kimlik sınırını aşan override yok. Bu, canlı hesap veya bütün modellerin metin kalitesi testi değildir. SAP X.509/mTLS ve IBM yazılım/deployment/gateway ürünleri bu kimlik sözleşmesinin dışındadır.

Gerçek yerel model listesi ayrıca doğrulandı: güncel `ProviderService.discoverLocalModels`, `http://127.0.0.1:11434/api/tags` adresinden **HTTP 200** aldı ve `qwen2.5:7b` modelini listeledi. Authorization başlığı, inference/bulut çağrısı veya kayıtlı ayarlarda okuma/yazma yoktu. Bu koşu Node ortamında gerçek Ollama GET isteği kullandı; Chrome izin sonucu taklit edildi, gerçek tarayıcı origin'i doğrulanmadı. Kanıt: [ollama-discovery-results.json](../evidence/ollama-discovery-results.json).

Katalog hazırlığında **30/30** kalıcı regresyon testi geçti (`tests/test_provider_catalog.py`); 226 kaynak sağlayıcısı eksiksiz taşındı, tarih/SHA-256/MIT lisansı, model/URL/alan sınırları, IBM IAM/SAP OAuth-Orchestration profil sözleşmesi, tekrarlanabilir çıktı ve paket bağımlılıkları doğrulandı. İlk kaynak taramasının kanıtı `output/provider-research/catalog-validation.json` eski 223 sağlayıcı aşamasına aittir; güncel katalogda 225 protokol sağlayıcısı ve 7.804 seçilebilir model adayı vardır. Kalıcı test ve tekrar komutu [providers-research.md](providers-research.md) dosyasındadır.

## Sağlayıcı entegrasyonu ve model kararı

Mevcut `gpt-4o` ve `temperature: 0.3` korundu. Resmî [GPT-4o belgesi](https://developers.openai.com/api/docs/models/gpt-4o) mevcut modelin Chat Completions desteğini doğrular. Karşılaştırmalı Türkçe kalite deneyi yapılmadığı için model değişikliği gerekçesi bulunmadı. Güncel kullanım fiyatı OpenAI'nin model sayfasından kontrol edilmelidir; eklenti/API ücretleri ayrıdır.

OpenAI/gpt-4o JSON modu korundu; bütün ailelerde özel prompta da `corrected_text` sözleşmesi için JSON talimatı eklenir. Boş/geçersiz/kesilmiş yanıt uygulanmaz. JSON/format alanları model ve protokol desteğine göre kullanılır. API anahtarı/metin/prompt ve ham servis hataları loglara taşınmaz; hata türleri sabit Türkçe mesajlara çevrilir. Eski yerel anahtar korunur; yeni sağlayıcı profilleri de local'dir, yalnız açma/kapatma sync'tir. Chrome destekliyorsa `TRUSTED_CONTEXTS` uygulanır. OpenAI chat ve Responses yolundaki `store: false`, bütün servis/gateway'ler için sıfır saklama garantisi değildir.

Her HTTP isteğinin zaman aşımı **25 saniyedir**; gövde okuması bu süreye dahildir. IBM/SAP için token değişimi ve inference ayrı HTTP sınırları kullanır; toplam işlem yaklaşık 50 saniyeye çıkabilir. Bu süre, MV3 servis işçisinin uzun süren fetch nedeniyle kapanmasından önce anlaşılır hata döndürmek için seçildi; [Chrome servis işçisi yaşam döngüsü](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) belgesi incelendi.

## Yerel model bağlantısı

Sağlayıcı araması açılan seçim listesinde bulunur; Ollama ve llama.cpp ayrıca görünür kartlardan seçilir. Yerel adres açık, anahtar alanı gizlidir. Kullanıcı Ollama'yı seçtiğinde Chrome bağlantı izni istenir ve izin verilirse taslak adresten modeller otomatik alınır. Ayarlar ilk açıldığında yalnız önceden verilmiş izinle otomatik keşif yapılır; izin yoksa **Modelleri getir** düğmesiyle devam edilir. Model seçimi **Kaydet ve kullan** ile etkinleşir; keşif sırasında kaydedilmiş sağlayıcı ve diğer profiller değişmez. Model bilinmiyorsa adresi boş modelle kaydetme → modelleri getirme → model seçip tekrar kaydetme de mümkündür.

Ollama native `/api/tags`, llama.cpp uyumlu `/v1/models` kullanır. Ollama listesinde isteğe bağlı `capabilities` varsa embedding-only kayıtlar elenir; yetenek alanı olmayan kayıtlar korunur. Yerel non-cloud Ollama düzeltmesi `temperature: 0.2` ve zorunlu `corrected_text` alanıyla JSON Schema kullanır; bulut/uzak dal JSON object biçimindedir. Bu taşıma ve doğrulayıcı davranışı taklit servis yanıtlarıyla test edilir.

**Ollama’yı nasıl bağlarım?** rehberi önce çalışan sunucuyu durdurmayı anlatır: Terminalde Ctrl+C, uygulamada Çıkış; yalnız Homebrew servisiyle başladıysa `brew services stop ollama`. Kapalıysa başlatma adımına geçilir. Arayüz, gerçek `chrome.runtime.id` ile eklenti origin iznini de içeren tek komut hazırlar:

```sh
OLLAMA_ORIGINS=chrome-extension://EKLENTI_KIMLIGI ollama serve
```

Ekrandaki tam komut kopyalanıp Terminalde çalıştırılır; o Terminal açık kalır. Ardından tek **Modelleri getir** düğmesiyle model seçilir ve **Kaydet ve kullan** ile etkinleştirilir. “Address already in use” eski sunucunun hâlâ açık olduğunu gösterir. Liste boşsa başka bir Terminalde `ollama list`, gerekirse model adı girilerek `ollama pull <model-adı>` kullanılır. [Resmî CLI komutları](https://docs.ollama.com/cli). Chrome bağlantı izni ve Ollama'nın origin izni ayrı koşullardır. [Ollama origin ayarı](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama). Kullanıcının gerçek Chrome kurulum kimliği/izin penceresi doğrulanmadı.

## Ayarlar arayüzü bakım kontrolleri

Son 36/36 arayüz koşusu bu hizalama, rehber ve kayıt durumlarını da kapsar. Ağ, izin ve pano sonuçları test profiline ait fixture değerleridir; gerçek sağlayıcıya istek gönderilmez.

- [x] Ollama rehberi açıkken 320, 390, 768, 1024 ve 1440 px genişliklerde açık/koyu tema, kod/Kopyala satırları, uzun origin komutu, düğme metni ve taşma kontrolü.
- [x] Tek Modelleri getir düğmesi; ortak ok/kopyalama ikonlarının merkezlenmesi, klavye odağı, açık/kapalı ok durumu ve azaltılmış hareket.
- [x] Panoya giden metnin ekrandaki tam komutla eşleşmesi; gerçek eklenti kimliği, satır kaydırmadan etkilenmeme, kopyalama başarı/ret mesajı ve düğmenin genişliğinin değişmemesi.
- [x] Yeni profil, eksik model/bilgi, kaydedilmemiş değişiklik, kayıtlı fakat etkin olmayan bağlantı ve kayıtlı/etkin bağlantının doğru açıklanması. Form değişikliği etkin bağlantıyı kendiliğinden değiştirmesin.
- [x] Kaydetme/izin sonucu beklenirken yeni form değişikliği veya sağlayıcı geçişinin yanlışlıkla kaydedildi/hazır gösterilmemesi; başarısız kayıt taslak olarak kalsın.
- [x] Özel prompt yükleme/kaydetme başlangıç değerinin korunması; Varsayılanı yükle yalnız taslağı değiştirsin, Kuralları kaydet başarılı olunca kayıt durumu güncellensin. Test hangi kayıtlı model/promptu kullanacağını açıkça anlatsın.

## Yerel testlerde kapsanan kabul kontrolleri

- [x] Popup açma/kapatma, düğmelerin eklenmesi/kaldırılması ve dinamik editör davranışı.
- [x] Sağlayıcı profili/anahtar/prompt kaydı, eski kullanıcı kaydı ve kaydedilmiş değerlerle test akışı.
- [x] Taklit servis yanıtlarında bağlantı, kota, rate limit, zaman aşımı ve geçersiz/kesilmiş JSON.
- [x] Listelenen altı classic editör kurulumu: düğme, diff, iptal, kabul, veri modeli ve native undo.
- [x] Çoklu/dinamik editör, bekleyen istekte/önizlemede metin değişmesi ve stale sonucun uygulanmaması.
- [x] Türkçe karakterler, kelime ekleme/çıkarma, biçimli paragraflar/listeler/bağlantılar.
- [x] HTML güvenliği, tehlikeli bağlantı/olay özniteliklerinin temizlenmesi ve model metninin HTML olarak çalıştırılmaması.
- [x] Normal input/textarea alanlarına düğme eklenmemesi.
- [x] Ollama/llama.cpp kartları, anahtarsız yerel adres, tam model etiketi, boş modelle adres kaydı ve diğer sağlayıcı profillerinin korunması.
- [x] Taslak model keşfinin yalnız ayarlar sayfasına açık olması, izin/loopback kontrolü ve kayıt okumadan/yazmadan çalışması.

## Ayrıca gerekli gerçek ortam kontrolleri

- [ ] Kullanıcının kendi Chrome profilinde seçilen API origin'i için gerçek izin penceresi, kabul/ret ve izin kaldırma.
- [ ] Kullanıcının kendi Chrome kurulumundan yerel sunucuya bağlantı, origin izni ve model listesinin alınması.
- [ ] Gerçek bulut hesabı/anahtarı/bölgesi ile model erişimi ve faturalandırma. Yerel fixture başarısı bu kontrolün yerine geçmez.
- [ ] Belirli bir WordPress/Drupal/Joomla/Notion veya diğer üretim sitesinin kendi editör kurulumuyla uyumluluk.
- [x] Son arayüzün bütün ekran görüntülerinde gerçek görsel inceleme sonucu.
- [x] Canlı site: 3 Ekim 2026 ayrı duzelt-site Worker, ana/destek/gizlilik HTTPS200, 9 route/CSP kontrolü. `evidence/site-live-results.json` ilk manuel dağıtımı kaydeder.
- [ ] Gerçek main push'una ait uzak Workers Builds sonucu.
- [x] Chrome Web Store geliştirici paneli, paket ve incelemeye gönderme sonucu doğrulandı; 3.4.0 incelemesi bekleniyor, kamu yayını ayrı süreçtir.

## Tasarım ve yayın aşaması

Claude Design dosyaları 3 Ekim 2026'da `site/` altında geldi. Özgün teslim yedeği `output/site-design-original-2026-10-03/` içinde korundu; tasarım dili korunarak güncel ayar görselleri, politika ve bağlantılar entegre edildi.

Claude Design referans kiti **22 dosya** içerir; Ollama masaüstü/dar ekran referansları da dahildir. Bu kit bir site tasarımı veya mağaza eklenti paketi değildir; artık kaynak teslimini bekleyen bir kapı yoktur.

`tests/site-browser.mjs` final kaynaklarla **58/58 geçti**: 320, 390, 768, 1024 ve 1440 px genişliklerde dört sayfa/açık-koyu tema, klavye erişimi, hareket azaltma, JavaScript kapalı görünüm, TOC ve açıklayıcı örnek kontrol edilir. Video için geçerli/geçersiz URL, sonlu süre, kullanıcı etkileşimi ve başlangıçta uzak istek yapılmaması yerel fixture ile sınanır; bu gerçek YouTube oynatma kanıtı değildir. Son kaynak/hash/görsel kontrol sonucu `evidence/site-ui-results.json` içinde tutulur. Ayrı gerçek YouTube kontrolünde q4k1awKQu1w video sayfası liste dışı olarak açıldı; oynatma ilerlemesi, 1080p HD seçeneği ve manuel Türkçe altyazı görüntüsü doğrulandı. Kayıtlı özel kapak/ürün listesi ile tamamlanmış HD ve sorunsuz telif kontrolü Studio arayüzünde görüldü.

Final video 32 saniye, 1920×1080 H.264/30 fps/AAC; 960 kare ve bütün dosya decode geçti. Lisanslı ElevenLabs kayıt kaynak hash'i, yerel ASR ve gerçek duraklar, 11 cue Türkçe SRT, sabit sahneler ve bütün geçiş kareleri `store/video/qa.json` ile kayıtlıdır. Final AAC −17,67 LUFS/−1,71 dBTP, konuşma/fon alt yüzde10 farkı19,79 dB. Ses girdisi desteklenmediğinden insan tarafından baştan sona dinleme doğrulanmış değildir. YouTube HD/telif sonucu ile mağaza inceleme durumu ayrı kaydedilir.

Kod teslimi `f635ca2e2a16af0b48069d57ae81a0fc4cc0564e` gerçek `main` push'ıyla Cloudflare Workers Builds `05e5cf7e-70ec-4bfd-bf6a-3b2f487b9184` işini tetikledi. Uzak kaynak eşleme ve 14 hazırlık testi geçti; build/deploy **23 saniyede başarılı** oldu. Yayın sürümü `a23b86aa-f6f7-4923-bb4f-5347ec3bb343`, özel alan adı `duzelt.yerli.dev`. Canlı Chrome'da tanıtım düğmesi tıklandıktan sonra youtube-nocookie oynatıcı açıldı; 0:00'dan 0:32'ye ilerleyip tamamlandı. İlk oynatma sessiz ve Türkçe altyazı açık başladı. Bu, yerel video fixture'ından ayrı gerçek gömme kanıtıdır; canlı HTTP/kaynak özetleri [site-live-results.json](../evidence/site-live-results.json) içindedir.
