# Mağaza ve video görsel kaynakları

3 Ekim 2026'da resmî [Chrome Web Store görsel kılavuzu](https://developer.chrome.com/docs/webstore/images/) ve [mağaza listeleme alanları](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/) kontrol edildi.

- Mağaza ekran görüntüleri: 1280×800, en az 1, en çok 5. Burada beş tam yüzey RGB PNG üretilir.
- Küçük tanıtım: 440×280 PNG, zorunlu.
- Büyük / marquee tanıtım: 1400×560 PNG, isteğe bağlı.
- Mevcut 128×128 ürün ikonu korunur.
- Video: 1920×1080, 30 fps, H.264 + AAC. YouTube küçük resmi: 3840×2160 ve site kapağı için 1280×720.

Görsel dil gelen sitenin #485cd0 mavisi, #f3f4f8 açık zemini, keskin köşeler, görünür grid ve sade sistem yazısıdır. Ekran görüntüleri gerçek çalışan eklentiden alınmıştır. Quill önerisi kontrollü test yanıtıdır; canlı model kalitesi veya her sitede destek iddiası değildir. Anahtarlar ve kişisel metin gösterilmez. Kaynaklar `store/video/source/` içinde saklanır; kırpma koordinatları ve metinler `tools/prepare-media.py` ile yeniden üretilebilir.

Tanıtım görselleri arayüz ekran görüntüsünden ayrıdır: küçük alanda mevcut marka ikonu ve değişiklik işaretleri, büyük alanda kısa ürün adı ve karar akışı kullanılır. Eski 920×680 boyutu güncel resmî listede yoktur; bu boyutta gereksiz çıktı üretilmez.

[YouTube küçük resim kılavuzu](https://support.google.com/youtube/answer/72431?hl=en), 3 Ekim 2026'da açılan sayfada 3840×2160 önerir; en az 640 piksel genişlik ve 16:9 oran verir. Bu yüzden yüksek çözünürlüklü sürüm ayrıca üretildi. İki PNG de masaüstü 50 MB ve mobil 2 MB sınırlarının altındadır; arayüz kırpması gerçek kaynak PNG'den alınır, başlık yazısı yüksek çözünürlükte yeniden çizilir.
