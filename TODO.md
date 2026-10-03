# AI Türkçe Metin Düzeltici — bakım ve sunum

## 1. Tasarım aracına devir (önce)
- [x] Kullanıcı kapsamı, AGENTS.md, CLAUDE.md, manifest, README ve PRIVACY okundu.
- [x] Yerel değişiklikler ve Git durumu kontrol edildi; başlangıç çalışma ağacı temiz, ana dal main.
- [x] Kamu mağaza öğesi ve CRX manifesti: gnkhgnhdokinbamhokpljgafapfjhjhl, yayın 3.3.0; mevcut geliştirici paneli gerçek Chrome arayüzünde doğrulandı.
- [x] Editör desteğini gerçek editörlerle test et; platform iddialarını ayır.
- [x] Gizlilik metnini gerçek veri akışına göre düzelt.
- [x] Gerçek arayüz ekran görüntülerini ve mevcut ikonları tasarım paketi için hazırla.
- [x] Claude Design için eksiksiz promptu ve 22 dosyalık tasarım referans paketini hazırla.
- [x] Kullanıcı web tasarım dosyalarını 3 Ekim 2026'da site/ altında getirdi; özgün tasarım output/site-design-original-2026-10-03/ içinde yedeklendi. Entegrasyon, yayın, video ve mağaza görselleri aşaması başladı.

## 2. Tasarımdan bağımsız bakım
- [x] CKEditor 4/5, Summernote, TinyMCE, Quill veri modeliyle uyumlu uygula; 127 gerçek tarayıcı ve 7 bootstrap kontrolü geçti.
- [x] Dinamik ekleme, yinelenen butonlar, gözlemci yükü, aç/kapa davranışını düzelt ve test et.
- [x] Geç yanıtın değişmiş metni ezmesini, iptal/disable sonrası uygulamayı engelle.
- [x] HTML güvenliği, biçimler, Türkçe karakterler ve kelime ekleme/çıkarma senaryolarını test et.
- [x] API zaman aşımı, kota/rate limit, bağlantı ve bozuk yanıt hatalarını güvenli biçimde ele al.
- [x] Anahtar/metin/prompt log sızıntısını gider; mevcut ayar anahtarlarını koru.
- [x] Popup ve ayarların erişilebilirliğini, uzun metin ve açık/koyu temayı düzelt.
- [x] Yerel 3.4.0 sürümü ve tek bağlantı yapılandırmasını hazırla.
- [x] Tekrarlanabilir ZIP paketleme ve manifest/CRC/dosya doğrulamasını tamamla; 19 çalışma dosyası, 7 paket testi.
- [x] README destek iddialarını ve sağlayıcı API ücretinin ayrı olduğunu düzelt.
- [x] Anlamlı Türkçe commitlerle main'e pushla; son kaynak, doğrulama ve paket teslimi evidence/delivery-results.json içinde sürümlenir.

## 2b. Kullanıcının genişlettiği kapsam: çoklu sağlayıcı ve yeni arayüz
- [x] OpenCode/Models.dev ve sağlayıcıların resmî belgeleriyle tüm katalog/protokol/kimlik doğrulama eşlemesini araştır.
- [x] Merkezi katalog, güncelleme aracı ve 12 protokol adaptörünü oluştur; 228 kayıt, 225 bağlantı profili. Üç özel ürünün giriş/çalışma sınırları açıklandı.
- [x] API anahtarı ve kısa ömürlü token kullanan bulut servislerini destekle; IBM IAM, SAP OAuth/Orchestration ve abonelik sınırlarını kaydet.
- [x] Eski OpenAI anahtarı, özel prompt ve aç/kapa ayarlarını kayıpsız taşı.
- [x] Yalnız seçilen servise istek gönder; API ve gerekiyorsa belirteç adresleri için ayrı isteğe bağlı Chrome izni, yönlendirme/URL/anahtar güvenliği.
- [x] Sağlayıcı/model/anahtar/bağlantı ayarlarını tek profesyonel, modern ve erişilebilir arayüzde yönet.
- [x] Anlamlı animasyonlar, açık/koyu tema, hareket azaltma ve mobil kontroller.
- [x] 188 sağlayıcı, 30 katalog ve 29 arayüz kontrolü; 7.804 model kaydı + 2 yerel örneğin istek oluşturma taraması geçti.
- [x] Gizlilik, README ve Claude Design promptunu yeni sağlayıcı kapsamıyla güncelle; eski ekran referanslarını yenile.

## 2c. Yerel model ve seçim kolaylığı
- [x] Sağlayıcı aramasını seçim listesinin içine taşı; model listesi ve elle ID girişini tek kontrolde birleştir.
- [x] Ollama/llama.cpp kartlarını, açık adres alanını ve anahtarsız bağlantıyı göster.
- [x] İzinli yerel sunucudan modelleri otomatik listele; taslak keşfi kayıtlı sağlayıcıyı değiştirmeden yap.
- [x] Kapalı sunucu/erişim reddi/boş liste için kopyalanabilir komut ve sonraki adımı göster.
- [x] Son UI 36/36 ve sağlayıcı 188/188; gerçek yerel model-listesi GET HTTP 200.
- [ ] Kullanıcının kendi Chrome kurulumundan host/origin iznini ve yerel bağlantıyı doğrula.

## 2d. Ayarlar arayüzü ve kurulum rehberi
- [x] Ollama rehberini durdurma → eklenti izinli tek başlatma komutu → model seçimi ve kaydetme akışına göre düzenle.
- [x] Kod/Kopyala satırlarını aynı grid içinde hizala; dar ekranda tek kolona geçir. Okları ortak SVG/CSS biçimiyle göster.
- [x] Tek Modelleri getir düğmesi, kısa Kaydet ve kullan metni ve görünür taslak/kayıtlı durum alanlarını hazırla.
- [x] Bağlantı ve prompt kaydının başlangıç değerlerini, kaydetme sonrası durumunu ve eşzamanlı form değişikliklerini regresyon testleriyle doğrula.
- [x] Rehber açıkken farklı genişliklerde kod/Kopyala hizasını, panoya giden tam komutu, klavye odağını ve kaydetme durumlarını gerçek eklenti arayüzünde doğrula.
- [x] Son UI 36/36 ve açık/koyu beş genişlik görsellerini doğrula; test/görsel kanıtlarını ve paket kaynaklarını yenile.

## 3. Tasarım tesliminden sonra
- [x] Gelen site tasarımını site/ altında entegre et; /privacy/ ve /support/ bağla. Özgün kaynak yedeği korundu.
- [x] Tek politika kaynağı, manifest sürümü/ikon eşlemesi, sosyal görsel/favicon/robots/sitemap/404 hazırla; 14 hazırlık testi ve kaynak drift kontrolü geçti.
- [x] 320, 390, 768, 1024, 1440 px görsel tarayıcı, klavye ve hareket azaltma kontrolü yap; final kaynaklarla 58/58 geçti.
- [x] duzelt.yerli.dev DNS/Worker sahipliğini doğrula; ayrı assets-only duzelt-site Worker yayımlandı, mevcut GitHub bağlantısıyla main Workers Builds kaydedildi.
- [x] Yerel kontrol, gerçek main push uzak build ve canlı HTTPS yayınını ayrı doğrula. Kod teslimi f635ca2; Cloudflare 05e5cf7e build/deploy başarılı; canlı tanıtım oynatma tamamlandı.
- [x] Video senaryosu/storyboard, ElevenLabs canlı plan/ses koşulları/kredi kontrolü. Aktif Starter planında tek 476 kredi üretimi, 38.852 kredi kaldı; yeni ödeme yok.
- [x] 32 saniye gerçek ürün videosu, lisanslı seslendirme, özgün müzik, zamanlanmış 11 cue Türkçe SRT ve 1280/3840 kapak hazırla.
- [x] Video 1080p/H.264/30fps/AAC, tam decode, gerçek sözcük/durak senkronu, ses seviyeleri ve bütün sahne/geçiş karelerinin görsel kontrolü.
- [ ] Baştan sona insan dinlemesi: araç ses girdisi desteklemediğinden tamamlanmış sayılmaz; oynatılabilir final dosya kullanıcıya açıldı.
- [x] Mevcut @yerlideveloper kanalına liste dışı yükle; HD/telif/SRT/küçük resim doğrula. Video q4k1awKQu1w, ürün oynatma listesi PLcynHQ4VkUWY.
- [x] YouTube nocookie oynatıcıyı yalnız tıklamayla yükle; süre/erişilebilir isim eşle. Yerel etkileşim testleri geçti; canlı gömme kontrolü ayrı kaydedilir.
- [x] Mevcut mağaza öğesini yeni paket ve doğru açıklama/gizlilik/izin beyanlarıyla güncelle.
- [x] Mağaza için 5 gerçek 1280×800 ekran, 440×280/1400×560 promosyon, açıklama/veri/izin beyanı ve inceleme notlarını hazırla.
- [x] Mağaza incelemesine gönder; otomatik yayın seçeneğini final gönderim ekranında doğrula. Panel: İncelenmeyi bekliyor; 3.4.0 henüz yayımlanmış değildir.
- [x] Geçici sekmeleri/sunucuları temizle; canlı site, video ve mağaza gönderimini teslim et. Kullanıcının mevcut sekmeleri ve yerel model servisi korunur.

## 4. Site üzerinden e-posta geri bildirimi

4 Ekim 2026: form yayımlandı; 6 açık TEST bildirimi HTTP 202 ile kabul edildi. İlk 4 için SMTP kabul kaydı, ilk 2 ve son 2 olmak üzere 4 mesaj için Gmail gelen kutusu kanıtı var. Önceki canlı denemede aynı belirteç yeniden kabul edildi; kök neden kesinleşmedi. Ek Durable Object korumasının yerel testleri geçti, canlı tekrar reddi henüz bekliyor. [Canlı sonuçlar](evidence/feedback-live-results.json).

- [x] Kalbur'un Worker, form ve test kaynaklarını salt okunur incele; `.env` ve credential dosyalarını açma.
- [x] İki aşamalı kurulum sınırını ve gerekli SMTP/Turnstile alanlarını belirle; ilk aşamada uygulama/yayın yapmadan dur.
- [x] Gizlilik ve işletim belgelerine manuel alanlar, Cloudflare/SMTP veri akışı, kuyruk kabulü/teslim ayrımı ve saklama-silme düzenini ekle.
- [x] Mevcut destek sayfası ve GitHub bağlantısını koruyarak formu, e-posta alternatifini ve erişilebilir durum mesajlarını ekle; API alanlarıyla kaynak sözleşmesi eşleşti.
- [x] Mesajı hata halinde koru; yinelenen gönderim, boş isteğe bağlı alanlar, 320/390/768/1440 px ve klavye davranışlarını doğrula; 37/37 izole Chromium kontrolü, 8 tema/genişlik birleşimi.
- [x] Düzelt için yalnız `duzelt.yerli.dev` alanına bağlı managed Turnstile widget'ı oluştur.
- [x] `duzelt-feedback` / `duzelt-feedback-dlq` canlı kuyruklarını ve her birinde 86.400 saniye saklamayı ayrı doğrula; her iki panelde 86.400 saniye görüldü.
- [x] Sunucu kaynaklarında Origin/içerik tipi, 16 KiB gövde, 4.000 karakter mesaj, tuzak alanı, HMAC IP özeti ve Turnstile token/hostname/action kontrollerini uygula; kaynak salt okunur gözden geçirildi.
- [x] Sunucu kontrollerini `npm run test:feedback` ile doğrula; Durable Object korumasıyla 39/39. Gerçek yerel workerd, eş zamanlı kullanım, yeniden başlatma, süre dolması ve alarm silmesini kapsar; canlı doğrulama ayrı tutulur.
- [x] Canlı yapılandırmayı doğrula: `/api/feedback/config` HTTP 200 ve `enabled: true`; `/.env` HTTP 404.
- [x] Gerçek widget belirtecini ayrı Siteverify işleminde doğru hostname/action ile doğrula; bu sonuç Worker POST kabulü değildir.
- [x] Canlı Chrome'da 320/390/768/1440 px yatay taşma ve görünür e-posta alternatifini kontrol et; güncel SDK için önbellek kapalıydı.
- [x] Eski SDK dosyası için içerik özetli betik adresi üret; 3/3 hedefli önbellek kontrolünü çalıştır. Önceki 37 form kontrolünü URL değişikliği sonrası yeniden çalıştırılmış diye sunma.
- [x] Canlı Chrome'da normal önbellekle güncel `feedback.js` dosyasını ve formun hazır olmasını doğrula; JavaScript hatası görülmedi.
- [x] Worker uyumluluk düzeltmesi sonrası gerçek POST HTTP 202 kuyruk kabulünü doğrula; 6 TEST bildirimi kabul edildi.
- [x] Worker SMTP kabulünü ve gelen kutusunu ayrı doğrula; ilk 4 SMTP kaydı, toplam 4 gelen kutusu kanıtı var. Bütün 6 mesaj için aynı kanıt düzeyi iddia edilmez.
- [x] IP başına 5/dk ve uygulama anahtarına 60/dk binding'lerini ve taklit reddetme testlerini doğrula; sınır yaklaşık ve Cloudflare konumu bazlıdır. Canlı kısa denemede HTTP 429 görülmedi; eşik ölçümü yapılmış sayılmaz.
- [x] Canlı yanlış Origin, içerik tipi ve büyük gövde isteklerini reddet; sırasıyla HTTP 403, 415 ve 413 görüldü.
- [x] Token HMAC'ı ile nesne kimliği, atomik SQLite kullanım kaydı ve 24 saatlik silme alarmını uygula; `FEEDBACK_TOKEN_GUARD` / `FeedbackTokenGuard`. Ham token/IP/mesaj/e-posta depoya girmez; 30 güne kadar platform kurtarma geçmişi belgelenir.
- [ ] Yeni korumayı yayımla; aynı geçerli belirtecin ikinci kullanımında HTTP 400 ve yeni kuyruk kaydı olmamasını canlı doğrula. Koruma arızasında HTTP 503 davranışını yerel sonuçla karıştırma.
- [ ] Yeni koruma sonrası son kontrollü TEST bildiriminin kuyruk, SMTP ve gelen kutusu sonuçlarını ayrı doğrula.
- [x] Yerel testlerde sabit gönderen/alıcı, yalnız Reply-To, TLS seçenekleri, retry/ACK ve kayıt kimliğiyle izleme akışını doğrula. Gerçek DLQ yönlendirmesi bekliyor.
- [x] Yerel SMTP ön kontrolü (`transporter.verify()`): TLS sertifikası ve kimlik doğrulaması başarılı; e-posta gönderilmedi.
- [x] Gerekli 11 alanı mevcut Worker'a şifreli secret olarak aktar; değerleri gösterme. Yerel `.env` 0600 izinli ve Git dışında, sızıntı kontrolü bulgusuz.
- [x] Son derleme/paket turunda secret ve `.env` dışlama kontrollerini yenile; 7/7 paket testi, `.env` 0600/Git dışında ve izlenen dosyalarda gizli değer sızıntısı bulgusuz.
- [x] Doğrulama, boyut/Origin, taklit Turnstile hataları, hız sınırı, kuyruk arızası, SMTP retry, HTML kaçışı, sabit alıcı ve Durable Object tekrar koruması testlerini çalıştır; 39/39.
- [x] Açıkça TEST işaretli canlı bildirimlerde kuyruk kabulünü, SMTP kabulünü ve gelen kutusu görünümünü ayrı kaydet; 6 kabul, 4 SMTP kayıtlı, 4 gelen kutusu doğrulanmış.
- [x] Form kodunu ve SDK düzeltmesini (`01ab2ef`, `6c96419`) main'e pushla; mevcut Workers Builds otomatik build/deploy başarılı. Worker sürümü `94e7bfa1…`.
- [x] Yeni gizlilik kaynağından site kopyasını üret; son `site:check` turunda 14 hazırlık ve 39 sunucu testi, syntax/drift ve Durable Object binding'li bundle dry-run geçti.
- [ ] Son Durable Object/gizlilik değişikliğinden sonra site hazırlığı, main push, uzak build ve canlı koruma sonucunu doğrula; yalnız önceki yayın kanıtıyla tamamlandı sayma.
- [ ] 24 saatlik hata kuyruğunu arıza halinde izle; kapanan talebin posta yazışmalarını en geç 30 gün içinde sil ve aylık kontrolü işlet.

## Kanıt sınırları
- Anahtar gerektirmeyen deterministik API testleri gerçek sağlayıcı/model erişimi veya düzeltme kalitesini kanıtlamaz. Gerçek hesapla API çağrısı yapılmadı.
- Seçici veya DOM maketi testi, belirli CMS/platform desteği ya da gerçek editör veri modeli kanıtı değildir.
- Yerel test, uzak build, canlı site ve mağaza incelemesi ayrı durumlarla raporlanır.
- Cloudflare, mevcut Yerli Developer ve mağaza panelleri gerçek kullanıcı hesabında doğrulandı. Mağazanın DOM betik kısıtı nedeniyle native erişilebilirlik arayüzü kullanıldı.
- YouTube şart kabulü ve eski dört mağaza görselinin kalıcı kaldırılması kullanıcı tarafından açıkça onaylandı. Kullanıcının dosya erişim iznini açmasından sonra video, kapak, altyazı, paket ve mağaza görselleri gerçek dosya seçicilerle yüklendi.
