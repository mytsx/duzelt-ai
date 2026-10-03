# Bakım notları — 3.4.0

Güncel çalışma planı [TODO.md](TODO.md), test kanıtları [docs/testing.md](docs/testing.md) dosyasındadır. Kamu mağaza sürümü 3.3.0; 3.4.0 yerel bakım sürümüdür.

## Tamamlanan bakım

- [x] Düzeltme düğmesini desteklenen zengin metin editörleriyle sınırla; normal input/textarea alanlarına ekleme.
- [x] CKEditor 4/5, Summernote, TinyMCE ve Quill için önizleme, kabul/iptal, biçim korunması ve native undo davranışını doğrula: 127 editör ve 7 bootstrap kontrolü.
- [x] Eski OpenAI anahtarını, özel promptu ve aç/kapa ayarını koru; prompt geçmişi özelliği sunulmaz.
- [x] Anahtar/prompt/profilleri local, aç/kapa durumunu sync alanında tut; API isteklerini merkezi arka plan servisinden gönder.
- [x] 228 sağlayıcı kaydını göster; 225 bağlantı profilini destekle. Copilot, GitLab Duo ve v0 için özel giriş/iş akışı sınırını açıkla.
- [x] Ollama ve llama.cpp kartlarını görünür yap; yerel adresi göster, anahtar alanını gizle.
- [x] Kullanıcı Ollama'yı seçince izin isteyip taslak adresten modelleri getir. İlk açılışta yalnız verilmiş izinle keşif yap; gerekirse Modelleri getir adımını göster. Keşif sırasında etkin sağlayıcı ve kayıtlı profilleri koru.
- [x] Native `/api/tags` model etiketlerini koru; yetenek bilgisi varsa embedding-only kayıtları önerilerden çıkar. Model seçilip Kaydet denmeden düzeltme bağlantısını değiştirme.
- [x] `ollama serve`, `ollama list` ve isteğe bağlı model yükleme komutunu göster; origin komutunu gerçek eklenti kimliğiyle hazırla.
- [x] Merkezi ve bağımsız sağlayıcı testlerinde 188/188 kontrolü tamamla; 7.804 katalog modeli ve 2 yerel örnek için istek oluşturmayı doğrula.
- [x] Gerçek eklenti arayüzünde 29/29 kontrolü tamamla: seçim içi arama/klavye, otomatik Ollama keşfi, izin/boş liste/hata, adres değişiminde eski sonuç ve komut kopyalama.
- [x] 30 katalog ve 7 paket regresyonunu doğrula; eklenti paketini yalnız 19 çalışma dosyasıyla hazırla.
- [x] Gerçek uygulama ekranları ve ürün sınırlarıyla 22 dosyalık Claude Design referans kitini hazırla.

## Açık kontroller ve tasarım teslimi

- [ ] Kullanıcının kendi Chrome kurulum kimliğini ve gerçek bağlantı izinlerini doğrula; Ollama origin ayarını o kimlikle eşleştir.
- [ ] Son kaynaklardan eklenti paketini yeniden üretip güncel SHA-256 kaydını tamamla.
- [ ] Kullanıcıdan Claude Design site kaynak ZIP'ini bekle. Bu dosya gelmeden site tasarımı/yayını, video veya mağaza tanıtım görseli üretme.
- [ ] Gelen tasarımı entegre ettikten sonra canlı site, video ve mağaza paneli/inceleme/yayın adımlarını ayrı doğrula.

Yerel test başarısı gerçek Chrome izni, belirli CMS veya mağaza yayın onayı anlamına gelmez.
