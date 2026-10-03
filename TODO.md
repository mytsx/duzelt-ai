# AI Türkçe Metin Düzeltici — bakım ve sunum

## 1. Tasarım aracına devir (önce)
- [x] Kullanıcı kapsamı, AGENTS.md, CLAUDE.md, manifest, README ve PRIVACY okundu.
- [x] Yerel değişiklikler ve Git durumu kontrol edildi; başlangıç çalışma ağacı temiz, ana dal main.
- [x] Kamu mağaza öğesi ve CRX manifesti: gnkhgnhdokinbamhokpljgafapfjhjhl, yayın 3.3.0. Panel izin engeli nedeniyle henüz doğrulanmadı.
- [x] Editör desteğini gerçek editörlerle test et; platform iddialarını ayır.
- [x] Gizlilik metnini gerçek veri akışına göre düzelt.
- [x] Gerçek arayüz ekran görüntülerini ve mevcut ikonları tasarım paketi için hazırla.
- [x] Claude Design için eksiksiz promptu ve 20 dosyalık tasarım referans paketini hazırla.
- [ ] Kullanıcıdan web tasarım dosyalarını bekle. Bu aşamadan önce web tasarımı/yayını, video görseli ve mağaza tanıtım görseli üretme.

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
- [ ] Anlamlı Türkçe commitlerle main'e pushla.

## 2b. Kullanıcının genişlettiği kapsam: çoklu sağlayıcı ve yeni arayüz
- [x] OpenCode/Models.dev ve sağlayıcıların resmî belgeleriyle tüm katalog/protokol/kimlik doğrulama eşlemesini araştır.
- [x] Merkezi katalog, güncelleme aracı ve 12 protokol adaptörünü oluştur; 228 kayıt, 225 bağlantı profili. Üç özel ürünün giriş/çalışma sınırları açıklandı.
- [x] API anahtarı ve kısa ömürlü token kullanan bulut servislerini destekle; IBM IAM, SAP OAuth/Orchestration ve abonelik sınırlarını kaydet.
- [x] Eski OpenAI anahtarı, özel prompt ve aç/kapa ayarlarını kayıpsız taşı.
- [x] Yalnız seçilen servise istek gönder; API ve gerekiyorsa belirteç adresleri için ayrı isteğe bağlı Chrome izni, yönlendirme/URL/anahtar güvenliği.
- [x] Sağlayıcı/model/anahtar/bağlantı ayarlarını tek profesyonel, modern ve erişilebilir arayüzde yönet.
- [x] Anlamlı animasyonlar, açık/koyu tema, hareket azaltma ve mobil kontroller.
- [x] 155 sağlayıcı, 30 katalog ve 19 arayüz kontrolü; 7.804 model kaydı + 2 yerel örneğin istek oluşturma taraması geçti.
- [x] Gizlilik, README ve Claude Design promptunu yeni sağlayıcı kapsamıyla güncelle; eski ekran referanslarını yenile.

## 3. Tasarım tesliminden sonra
- [ ] Gelen site tasarımını site/ altında entegre et; /privacy/ ve /support/ bağla.
- [ ] Tek politika kaynağı, manifest sürümü/ikon eşlemesi, sosyal görsel/favicon/robots/sitemap/404 hazırla.
- [ ] 320, 390, 768, 1024, 1440 px görsel tarayıcı, klavye ve hareket azaltma kontrolü yap.
- [ ] duzelt.yerli.dev DNS/Worker sahipliğini doğrula; ayrı Worker ve Workers Builds kur.
- [ ] Yerel kontrol, gerçek main push uzak build ve canlı HTTPS yayınını ayrı doğrula.
- [ ] Video senaryosu/storyboard, ElevenLabs canlı plan/ses koşulları/kredi kontrolü.
- [ ] 25–40 saniye gerçek ürün videosu, seslendirme, özgün müzik, zamanlanmış SRT ve küçük resim hazırla.
- [ ] Video 1080p/H.264/30fps/AAC, senkron ve baştan sona görsel/işitsel kalite kontrolü.
- [ ] Mevcut @yerlideveloper kanalına liste dışı yükle; HD/telif/SRT/küçük resim doğrula.
- [ ] YouTube nocookie oynatıcıyı yalnız tıklamayla yükle; süre/erişilebilir isim eşle.
- [ ] Mevcut mağaza öğesini yeni paket ve doğru açıklama/gizlilik/izin beyanlarıyla güncelle.
- [ ] Mağaza incelemesine gönder; onay sonrası otomatik yayın durumunu gerçekte doğrula.
- [ ] Geçici sekmeleri/sunucuları temizle; nihai bağlantılar ve dosya yollarını teslim et.

## Kanıt sınırları
- Anahtar gerektirmeyen deterministik API testleri gerçek sağlayıcı/model erişimi veya düzeltme kalitesini kanıtlamaz. Gerçek hesapla API çağrısı yapılmadı.
- Seçici veya DOM maketi testi, belirli CMS/platform desteği ya da gerçek editör veri modeli kanıtı değildir.
- Yerel test, uzak build, canlı site ve mağaza incelemesi ayrı durumlarla raporlanır.
