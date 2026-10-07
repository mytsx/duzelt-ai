# #7: mağaza ve ilk düzeltme doğrulaması

Kontrol tarihi: **7 Ekim 2026**. [Issue #7](https://github.com/mytsx/duzelt-ai/issues/7) açık; yorum yok, açık PR yok. Mevcut altı PR 2025 tarihli ve kapalı/birleştirilmiş; bu yeni doğrulama işini tamamlamıyor.

## Kamu mağazası ve yayımlanan paket

[Resmî mağaza öğesi](https://chromewebstore.google.com/detail/gnkhgnhdokinbamhokpljgafapfjhjhl) oturum çerezi kullanılmayan HTTP GET ile **200** döndü. Yanıtta ürün başlığı, **Add to Chrome**, sürüm **3.4.0** ve güncelleme tarihi **4 Ekim 2026** var. Google'ın resmî update servisinden indirilen CRX3 paketinin manifesti de 3.4.0; asgari Chrome sürümü 111.

Paket kurulmadı veya eklenti olarak çalıştırılmadı. Statik CRC/içerik kontrolünde 19 çalışma dosyası, Google'ın manifestte eklediği `update_url` dışında, başlangıç commit'i `db2bccfef35c7964be3bae406289001ec800b43a` ile eşleşti. CRX SHA-256: `65d5d58b070ddea6a6a046fc008f52a162ccfbc5a5318cd863718506b33a6f1e`. Bu dalın Gemini bağlantı düzeltmesi ve ürün metadata değişikliği bu yayımlanmış pakette bulunmaz. Kanıt: [store-public-check-2026-10-07.json](../evidence/store-public-check-2026-10-07.json).

Bu HTTP/CRX sonucu temiz Chrome profili, ülke/bölge veya gerçek kurulum kanıtı değildir. Web okuma aracı mağazayı/landing'i açamadı; Chrome tarayıcı aracı yeni sekme açılmasına izin vermedi. Mağaza ekran görüntüsü alınamadı; Chrome sürümü ve bölge **bilinmiyor**. 6 Ekim oturumsuz bulut tarayıcısındaki erişim hatası bütün bölgelerde kaldırılma olarak yorumlanamaz.

[Canlı landing](https://duzelt.yerli.dev/) HTTP 200 döndü ve hâlâ mağazada 3.3.0 sunulduğunu yazıyordu. Yerel kaynakta bu eski bilgi 3.4.0 ve kontrol tarihiyle güncellendi; site dağıtımı yapılmadı. Ekranlar ve mevcut editör matrisi 3.4.0 yerel testlerine dayandırıldı; mağazadan kurulan sürümle tekrar test edildiği iddia edilmiyor. Demo, video ve editör tablosu yeniden üretilmedi. Normal input/textarea, doğrulanmamış CMS platformları ve güvenli biçim eşlemesi yapılamadığında düz metin uyarısı sınırları korundu.

## Kurulumsuz sentetik ilk kullanım

`npm run test:first-correction`, gerçek kaynak JS'lerini sıradan geçici Chromium sayfalarında çalıştırır. Chrome depolama/izin API'leri bellekte taklit edilir; arka plan kodu Node VM içinde sahte taşıma katmanı kullanır. Editör, Quill API'sine benzeyen küçük bir makettir; gerçek Quill veya CMS testi değildir. Eklenti kurulumu, kalıcı profil, gerçek izin, anahtar ve sağlayıcı ağ isteği yoktur.

Yerel kaynak ve indirilen 3.4.0 paketinden çıkarılan kaynak ayrı koşularda **24/24** geçti. Boş ilk açılış, eksik anahtar, reddedilen/kaldırılan izin, model keşfi/kayıt, bağlantı testi, sentetik OpenAI/Ollama/llama.cpp düzeltmesi, önizleme/kabul/iptal/Escape, değişmiş metnin korunması, geçersiz/HTML görünen yanıt, düz metin uyarısı ve popup toggle kapsanır. Sonuçlar: [yerel fixture](../evidence/first-correction-fixture-local.json), [yayımlanan kaynak fixture](../evidence/first-correction-fixture-published.json). Görseller `output/playwright/first-correction-fixture/` altında **SENTETİK TEST** başlığı taşır; mağaza kurulumu görseli değildir.

Yeniden koşum:

```sh
npm run test:first-correction
# Yalnız statik olarak çıkarılmış kamu paketi kaynakları için:
DUZELT_SOURCE_ROOT=/tmp/duzelt-issue7-published DUZELT_FIXTURE_LABEL=published npm run test:first-correction
```

## Gerçek ortamda kalan kontroller

Yerel destek kontrolleri: sağlayıcı **191/191**, bootstrap **7/7**, paket **7/7**, katalog **30/30**, site hazırlık **14/14** ve yerel site tarayıcı testi **58/58** geçti. [Site kaydı](../evidence/site-ui-results-2026-10-07.json) 40 genişlik/tema/sayfa kontrolü ve sıfır gerçek dış isteği ayırır. Yerel 19 dosyalı çalışma ZIP'i CRC/referans kontrolüyle üretildi; SHA-256 `a334c1448f8837a5bb1e6713891b6c84c7ecb6e5cb1c98dff8753c4ffdc87f18`. Bu paket yayımlanmış CRX değildir ve yüklenmedi.

| Kabul ölçütü | Sonuç |
| --- | --- |
| Temiz, oturumsuz Chrome'da mağaza görünürlüğü/kurulumu; tarih, Chrome sürümü, ülke/bölge | **NOT RUN**. HTTP/CRX kontrolü tamamlandı; tarayıcı/kurulum sonucu eksik. |
| Mağazadan kurulan sürümle bir bulut ve bir yerel bağlantıda ilk düzeltme, kabul/iptal | **NOT RUN**. Sentetik kaynak testleri bu ölçütü tamamlamaz. |
| Rehber, ekran ve editör matrisi sürüm açıklaması | Yerel kaynak güncellendi; dağıtım yapılmadı. Gerçek kurulum sonrası fark varsa tekrar güncellenmeli. |
| Mevcut demo ve tabloyu yeniden yapmama | Korundu. |

Gereken en küçük kullanıcı adımı: ayrı, temiz bir Chrome profilinde resmî öğenin kurulumuna açık onay verin veya kurulumu kendiniz tamamlayın. Kurulum, depolama ve `api.openai.com` bağlantısına ek olarak HTTP/HTTPS sayfalarında editör betiklerini çalıştırır. Ek API/yerel endpoint izinleri ayrıca seçilen adresi kapsar. Mevcut kişisel tarayıcı profiline dokunulmadı; yeni anahtar/belirteç veya güvenlik izni oluşturulmadı.

Onaylı profilde kullanıcının seçtiği mevcut bulut bağlantısını ve çalışan Ollama/llama.cpp servisini Ayarlar üzerinden yapılandırın; anahtarı sohbete, kayda veya görsellere eklemeyin. Yeni servis/model kurulumu bu çalışmanın parçası değil. Her bağlantıda **Bağlantıyı test et → sentetik örneği Düzelt → önizle → İptal → yeniden Düzelt → Kabul Et** sırasını uygulayın. Bulut testi gerçek ve ücret doğurabilecek bir istek gönderir; yalnız örnek metin kullanın. Tarih, ülke/bölge, Chrome/eklenti/editör sürümü ve görünür sonucu kaydedin. Sır alanları görsel dışında kalsın.

İlk kullanım çözüm bağlantıları: [izin ve kaydet/test](https://duzelt.yerli.dev/support/#kaydet-test), [yerel sunucu](https://duzelt.yerli.dev/support/#yerel-sunucu), [düğme görünmemesi](https://duzelt.yerli.dev/support/#dugme-gorunmuyor). Push, PR, merge, site/mağaza yayını ve #8 pilot/outreach bu yerel çalışmada yapılmadı.
