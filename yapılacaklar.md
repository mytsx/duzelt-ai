# Bakım notları — 3.4.0

Güncel çalışma planı [TODO.md](TODO.md), test kanıtları [docs/testing.md](docs/testing.md) dosyasındadır. 7 Ekim 2026'da kamu mağaza sürümü ve ayrı temiz Chrome profiline resmî kurulum **3.4.0** olarak doğrulandı; yerel bakım sürümü de 3.4.0. Gerçek bulut/yerel ilk düzeltme **NOT RUN**, ülke/bölge doğrulanmadı: [#7 kaydı](docs/first-correction.md).

## Tamamlanan bakım

- [x] Düzeltme düğmesini desteklenen zengin metin editörleriyle sınırla; normal input/textarea alanlarına ekleme.
- [x] CKEditor 4/5, Summernote, TinyMCE ve Quill için önizleme, kabul/iptal, biçim korunması ve native undo davranışını doğrula: 127 editör ve 7 bootstrap kontrolü.
- [x] Eski OpenAI anahtarını, özel promptu ve aç/kapa ayarını koru; prompt geçmişi özelliği sunulmaz.
- [x] Anahtar/prompt/profilleri local, aç/kapa durumunu sync alanında tut; API isteklerini merkezi arka plan servisinden gönder.
- [x] 228 sağlayıcı kaydını göster; 225 bağlantı profilini destekle. Copilot, GitLab Duo ve v0 için özel giriş/iş akışı sınırını açıkla.
- [x] Ollama ve llama.cpp kartlarını görünür yap; yerel adresi göster, anahtar alanını gizle.
- [x] Kullanıcı Ollama'yı seçince izin isteyip taslak adresten modelleri getir. İlk açılışta yalnız verilmiş izinle keşif yap; gerekirse Modelleri getir adımını göster. Keşif sırasında etkin sağlayıcı ve kayıtlı profilleri koru.
- [x] Native `/api/tags` model etiketlerini koru; yetenek bilgisi varsa embedding-only kayıtları önerilerden çıkar. Model seçilip Kaydet denmeden düzeltme bağlantısını değiştirme.
- [x] Ollama için gerçek eklenti kimliğini içeren tek izinli başlatma komutunu, model listesi ve isteğe bağlı yükleme komutunu göster.
- [x] Merkezi ve bağımsız sağlayıcı testlerinde 188/188 kontrolü tamamla; 7.804 katalog modeli ve 2 yerel örnek için istek oluşturmayı doğrula.
- [x] Gerçek eklenti arayüzünde 36/36 kontrolü tamamla: seçim içi arama/klavye, otomatik Ollama keşfi, izin/boş liste/hata, adres değişiminde eski sonuç ve komut kopyalama.
- [x] 30 katalog ve 7 paket regresyonunu doğrula; eklenti paketini yalnız 19 çalışma dosyasıyla hazırla.
- [x] Gerçek uygulama ekranları ve ürün sınırlarıyla 22 dosyalık Claude Design referans kitini hazırla.

## Ayarlar arayüzü bakımı

- [x] Rehberde çalışan Ollama'yı durdurmayı başlatmadan önce anlat; aynı komutta eklenti origin izniyle başlat.
- [x] Kod/Kopyala satırlarını ve okları hizala; tek Modelleri getir düğmesi, kısa Kaydet ve kullan metni ve görünür kayıt durumunu hazırla.
- [x] Rehber açıkken dar/geniş ekran, doğru panoya kopyalama, bağlantı/prompt taslağı ve kaydetme sonrası durum testlerini tamamla.
- [x] Son UI 36/36 ve rehber açıkken beş genişlik/açık-koyu görselleriyle test/görsel kanıtlarını ve paketleri yenile.

## Tarihsel hazırlık listesi — 3 Ekim tesliminden önce

Aşağıdaki kutular önceki hazırlık planını korur; güncel tamamlanma durumu [TODO.md](TODO.md) ve [docs/testing.md](docs/testing.md) içindedir. Paket, tasarım ve yayın teslimlerini hâlâ bekleyen işler olarak yorumlamayın.

- [ ] Kullanıcının kendi Chrome kurulum kimliğini ve gerçek bağlantı izinlerini doğrula; Ollama origin ayarını o kimlikle eşleştir.
- [ ] Son kaynaklardan eklenti paketini yeniden üretip güncel SHA-256 kaydını tamamla.
- [ ] Kullanıcıdan Claude Design site kaynak ZIP'ini bekle. Bu dosya gelmeden site tasarımı/yayını, video veya mağaza tanıtım görseli üretme.
- [ ] Gelen tasarımı entegre ettikten sonra canlı site, video ve mağaza paneli/inceleme/yayın adımlarını ayrı doğrula.

Yerel test başarısı gerçek Chrome izni, belirli CMS veya mağaza yayın onayı anlamına gelmez.
