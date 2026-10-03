# 3.4.0 inceleme ve manuel doğrulama

Mevcut öğe: `gnkhgnhdokinbamhokpljgafapfjhjhl`. Test hesabı veya üreticiye ait API anahtarı pakete eklenmez.

1. Masaüstü Chrome 111+ üzerinde ZIP'i inceleyin; manifest köktedir. Eklenti popup'ında açma/kapatma ve Ayarlar bağlantısını kontrol edin.
2. Ayarlar sayfasında sağlayıcı seçim listesini açın, arama yapın. OpenRouter ve yerel Ollama/llama.cpp seçenekleri görünür; model araması ve elle kimlik girişi vardır.
3. Kendi test API hesabınızın erişim bilgilerini girin, Kaydet ve kullan ile yalnız gösterilen hedefe Chrome bağlantı izni verin. Bağlantıyı test et kaydedilmiş ayarlarla gerçek API isteği yapar; sağlayıcı ücret/kota koşulları geçerlidir.
4. Yerel alternatifte Ollama'yı kurup bir metin modeli yükleyin. Ayarlardaki Ollama rehberinin mevcut eklenti kimliğiyle oluşturduğu komutu kullanın; daha önce çalışan sunucuyu önce durdurun. Yerel adres iznini verip Modelleri getir, model seçimi ve Kaydet ve kullan akışını kontrol edin. Eklenti komut çalıştırmaz.
5. Uyumlu editöre Türkçe örnek metin yazıp Düzelt'e basın. Öneride eklenen/çıkarılan metinleri inceleyin. İptal asıl metni korur, Kabul Et öneriyi uygular. İşlem sırasında metni değiştirmeniz durumunda geç yanıtın yeni metni ezmediğini kontrol edin.
6. Yerel gerçek editör fixture'ları için README'deki `npm run test:editors` ve `npm run test:ui` akışları kullanılabilir. Bu fixture'lar kontrollü yanıt kullanır; gerçek sağlayıcı hesabı/kalite testi sayılmaz. Harici editör demo sitelerinin erişim ve API politikaları eklentiye ait değildir.
7. Mevcut 3.3.0 kurulumunun OpenAI anahtarını, özel promptunu ve açma/kapatma ayarını 3.4.0 güncellemesinden sonra kontrol edin; aynı öğe güncellenir.

Yerel test sonuçları `evidence/` altında; platform desteği sınırları `docs/testing.md` içinde açıklanır. Tam API anahtarı, özel prompt veya gerçek özel metin log/inceleme notlarına yazılmaz.
