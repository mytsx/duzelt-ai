# AI Türkçe Metin Düzeltici — ses yönü

Okunacak onaylı metin `narration.tr.txt` içindedir (55 sözcük). Hedef 25–40 saniyedir. Metin ürün adıyla açılır, gerçek Düzelt → inceleme → kabul/iptal akışını anlatır ve Chrome Web Store çağrısıyla kapanır.

Türkçe, güven veren, canlı ama bağırmayan profesyonel reklam anlatımı. Konuşma temposunu koruyun; “Düzelt”, “inceleyin” ve “karar verin” ifadelerine hafif vurgu verin. Cümleler arasında kısa doğal durak bırakın. Kusursuz sonuç, ücretsiz bulut kullanımı veya tüm sitelerde çalışma vaadi eklemeyin. Teknik yöntem ve test ayrıntıları ses metnine girmez.

Mevcut ElevenLabs hesabında Starter planı ve 39.328 kalan kredi, 3 Ekim 2026'da üretim öncesi arayüzden doğrulandı. Mustafa Silici — Energetic Commercial sesi, Eleven v4, Türkçe, %50 stability ve %75 similarity ile tek üretim yapıldı; üretimin içerdiği iki alternatif indirildi. 476 kredi kullanıldı, kalan bakiye 38.852 olarak gözlendi. İlk `[confident]` ve son `[confident, upbeat]` etiketleri üretim metnindedir; temiz altyazı kaynağında etiket yoktur. Üretim tekrar edilmedi.

Ücretli planda üretilecek standart kayıt için [ElevenLabs ticari kullanım açıklaması](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) esas alınır. Plan doğrulaması kaydın üretildiği zamanı kapsamalıdır; üçüncü taraf hakları ve hizmet şartları geçerlidir.

İlk kayıt 30,1975, ikinci kayıt 29,231 saniyedir. İlk alternatif onaylı metnin tamamını içerir ve cümleler arasında belirgin duraklar sunar; 32 saniyelik videoda 0,35 saniye ses başlangıcıyla kullanılır. Sözcük zamanları mevcut yerel faster-whisper-base modeliyle çıkarıldı; ses dalgasındaki −35 dBFS / en az 0,12 saniye duraklarla karşılaştırıldı. ASR yazımı altyazıya aktarılmaz; altyazı metni onaylı temiz metinden alınır.

Sahneler sabit kamerayla gösterilir. Gerçek Quill görüntüsündeki düzeltme kontrollü örnek yanıttır; canlı model kalitesini temsil etmez. Özgün enstrümantal fon konuşma sırasında otomatik kısılır. Kesirli zoom/pan yoktur. Altyazı ayrı SRT dosyasıdır; arayüz düğmelerinin veya örnek metnin üstünü kapatmaz.

Teslim: 1920×1080, 30 fps, H.264, AAC, Türkçe SRT, YouTube için 3840×2160 küçük resim ve site için 1280×720 kapak. Tam çözümleme, yazı sınırları, kaynak hashleri, ses seviyesi, tepe ve konuşma/fon farkı kayıt altına alınır. Bu ajan arayüzünde ses girdisi desteklenmediği için estetik dinleme veya baştan sona insan dinlemesi yapılmış sayılmaz; otomatik medya kontrolleri ve görsel inceleme bundan ayrı kaydedilir.
