# #7: mağaza ve ilk düzeltme doğrulaması

Kontrol tarihi: **7 Ekim 2026**. [Issue #7](https://github.com/mytsx/duzelt-ai/issues/7) açık; yorum yok, açık PR yok. Mevcut altı PR 2025 tarihli ve kapalı/birleştirilmiş; bu yeni doğrulama işini tamamlamıyor.

## Kamu mağazası ve yayımlanan paket

[Resmî mağaza öğesi](https://chromewebstore.google.com/detail/gnkhgnhdokinbamhokpljgafapfjhjhl) oturum çerezi kullanılmayan HTTP GET ile **200** döndü. Yanıtta ürün başlığı, **Add to Chrome**, sürüm **3.4.0** ve güncelleme tarihi **4 Ekim 2026** var. Google'ın resmî update servisinden indirilen CRX3 paketinin manifesti de 3.4.0; asgari Chrome sürümü 111.

İlk HTTP/CRX aşamasında paket kurulmadı veya eklenti olarak çalıştırılmadı. Statik CRC/içerik kontrolünde 19 çalışma dosyası, Google'ın manifestte eklediği `update_url` dışında, başlangıç commit'i `db2bccfef35c7964be3bae406289001ec800b43a` ile eşleşti. CRX SHA-256: `65d5d58b070ddea6a6a046fc008f52a162ccfbc5a5318cd863718506b33a6f1e`. Bu dalın Gemini bağlantı düzeltmesi ve ürün metadata değişikliği bu yayımlanmış pakette bulunmaz. Kanıt: [store-public-check-2026-10-07.json](../evidence/store-public-check-2026-10-07.json).

Bu HTTP/CRX sonucu kendi başına temiz Chrome profili, ülke/bölge veya gerçek kurulum kanıtı değildir. İlk web/tarayıcı araçları mağazayı açamadı; daha sonra aşağıdaki onaylı native Chrome kurulumu tamamlandı. 6 Ekim oturumsuz bulut tarayıcısındaki erişim hatası bütün bölgelerde kaldırılma olarak yorumlanamaz.

[Canlı landing](https://duzelt.yerli.dev/) HTTP 200 döndü ve hâlâ mağazada 3.3.0 sunulduğunu yazıyordu. Yerel kaynakta bu eski bilgi 3.4.0 ve kontrol tarihiyle güncellendi; site dağıtımı yapılmadı. Ekranlar ve mevcut editör matrisi 3.4.0 yerel testlerine dayandırıldı; mağazadan kurulan sürümle tekrar test edildiği iddia edilmiyor. Demo, video ve editör tablosu yeniden üretilmedi. Normal input/textarea, doğrulanmamış CMS platformları ve güvenli biçim eşlemesi yapılamadığında düz metin uyarısı sınırları korundu.

## Onaylı gerçek mağaza kurulumu ve anahtarsız ilk kullanım

7 Ekim 2026'da kullanıcının açık kurulum onayıyla Chrome UI üzerinden ayrı **Duzelt Issue7 Test 2026-10-07** profili oluşturuldu; **Oturumu kapalı tut** seçildi, hesap/senkronizasyon/ithalat yapılmadı. `chrome://version/` **154.0.8037.98** resmî arm64 ve macOS **27.0.1 (26A434)** gösterdi. Mağaza **Oturum açın**, **Chrome'a ekle**, **3.4.0**, **4 Ekim 2026** gösterdi. Dil Türkçe; ülke/bölge ekranda yok ve **doğrulanmadı**. Türkçe arayüz ülke kanıtı sayılmaz.

Kurulum penceresi **Web sitelerindeki tüm verilerinizi okuma ve değiştirme** uyarısını gösterdi; bu erişim kullanıcı onayının kapsamındaydı. Beklenmedik/ek sağlayıcı izin penceresi yoktu. Kurulumdan sonra mağaza **Chrome'dan kaldır** gösterdi. `chrome://extensions/?id=gnkhgnhdokinbamhokpljgafapfjhjhl` aynı ID, **3.4.0**, **Açık**, kaynak **Chrome Web Store** ve geliştirici modu kapalı durumunu doğruladı. Paketlenmemiş eklenti yüklenmedi; yerel dal düzeltmeleri bu kurulu sürümde yok.

İlk popup **Ayar gerekli**, OpenAI/gpt-4o ve etkin düğme durumunu gösterdi. Ayarlarda anahtar boş/maskeli, varsayılan kurallar ve **Bağlantı bilgileri eksik** görüldü. Anahtar girmeden bağlantı testi **API anahtarı / erişim tokenı girilmemiş. Ayarlardan kaydedin.** hatasını verdi. Boş anahtarla varsayılan bağlantı kaydedildi; arayüz açıkça eksik giriş bilgilerini tamamlama uyarısı verdi. Kayıt sonrası test aynı hatayı verdi; başarılı sağlayıcı bağlantısı sayılmadı.

[Yerel sayfa](../tests/fixtures/store-keyless-editor.html) yalnız loopback HTTP üzerinde sunuldu. Sayfa Quill biçiminde **sentetik bir editör API'si** sağlar; eklenti JS'i, Chrome API taklidi, sağlayıcı yanıtı veya arka plan/fetch değişikliği içermez. Gerçek mağaza eklentisi tek **Düzelt** düğmesi ekledi. Native tıklama aynı eksik anahtar alertini verdi. Alert kapatılınca sayfanın DOM gözlemi HTML'in birebir aynı, modalın yok ve düğmenin tekrar etkin olduğunu gösterdi. Normal input/textarea için düğme yoktu. Popup toggle kapandığında içerik düğmesi kaldırıldı, açılınca tek düğme geri geldi. Bu negatif kontrol gerçek Quill/CMS uyumluluğu veya başarılı önizleme/kabul/iptal testi değildir.

Kanıt: [store-install-2026-10-07.json](../evidence/store-install-2026-10-07.json). Bu kayıt anahtarsız aşamanın tarihsel sonucudur. Native ekran görüntüleri araç çıktısında incelendi; yerel görsel dosyası veya Library artifact'i oluşturulmadı. Gerçek sağlayıcı ağ trafiği ölçülmedi; eksik anahtarın fetch öncesi kontrolü statik kaynakta doğrulanmıştır, bu koşu için ölçülmüş sıfır ağ iddiası yoktur. Bu aşamanın geçici sayfa sekmesi ve sunucusu kapatıldı; profil o sırada anahtar boş olarak bırakıldı. Kullanıcı daha sonra aşağıdaki bulut bağlantısını kendisi kaydetti.

Chrome odağı bir kez kişisel pencereye değişti; orada eylem yapılmadı. Otomatik onay denetimi sonraki tam erişilebilirlik okumasını kişisel hesap içeriğinin açığa çıkma riskiyle reddetti. Kullanıcı test profilini öne getirdikten sonra profil tekrar doğrulanıp devam edildi; odak değişiminin kaynağı bilinmiyor.

## Gerçek mağaza sürümünde OpenRouter ve Quill

Aynı test profilinde kullanıcı mevcut anahtarını **kendisi** Ayarlar üzerinden girip kaydetti; agent anahtarı okumadı veya girmedi. Maskeli ekran gözleminde **OpenRouter / google/gemini-3.8-flash**, `https://openrouter.ai/api/v1`, **Kayıtlı ve etkin** ve kullanıcının çalıştırdığı mevcut **Bağlantı başarılı** sonucu doğrulandı. Agent bağlantı testini tekrar çalıştırmadı; yeni izin veya anahtar oluşturmadı. Anahtar bulunabilecek tam erişilebilirlik ağacı otomatik onay denetimince reddedildi; kullanıcının güvenli ekran devrinden sonra yalnız maskeli screenshot ile bu bölüm kontrol edildi.

[Gerçek Quill sayfası](../tests/fixtures/store-first-correction.html), resmî npm paketinden SHA-512 bütünlüğü doğrulanmış **Quill 2.0.3** JS/CSS ile yalnız `127.0.0.1:8769` üzerinde sunuldu. Paket kurulumu/lifecycle yok; eklenti betiği, Chrome API taklidi ve sağlayıcı mock'u yok. Yalnız kısa yapay Türkçe metin, kalın/italik, yerel bağlantı, madde listesi ve görünür `<b>örnek</b>` kod örneği kullanıldı. Bu, önceki küçük Quill API maketinden ayrı gerçek editör testidir; bir CMS doğrulaması değildir.

İlk agent **Düzelt** isteği **Sağlayıcı isteği zaman aşımına uğradı. Lütfen yeniden deneyin.** hatası verdi; önizleme açılmadı, semantic HTML/Delta JSON/editör DOM HTML başlangıçla aynı ve düğme yeniden etkin kaldı. Kullanıcı manuel yeniden denediğinde gerçek önizleme açıldı. Agent **İptal** seçince üç başlangıç karşılaştırması yine aynı kaldı. Agent'in ikinci ve son düzeltme isteği de önizleme açtı; **Kabul et** sonucu uyguladı. Her iki önizleme biçimler güvenle eşleştirilemediği için düz metin uygulanacağı ve biçimlerin/bağlantıların kaldırılacağı uyarısını gösterdi. Kabul gerçekten kalın/italik, bağlantı, semantik liste ve kod biçimini kaldırdı; biçim koruma başarısı iddia edilmiyor.

Kabul edilen semantic HTML'de `<b>örnek</b>` **`&lt;b&gt;örnek&lt;/b&gt;`** olarak görünür metin kaldı. Bu tek örnek genel saldırgan HTML güvenliği testi değildir. Ardından fixture düğmesinin çağırdığı gerçek **Quill history.undo()** özgün metin, kalın/italik/bağlantı/liste/kod biçimleri ve üç HTML/Delta karşılaştırmasını birebir geri getirdi; klavye Cmd+Z testi yapılmadı. Yerel gözlemde üç Düzelt tıklaması (agent 2 + kullanıcı 1), iki önizleme, bir iptal/bir kabul ve en fazla bir eşzamanlı modal var. Devre dışı düğmeye tekrar tıklama girişimi modalın açıldığı ana denk geldi; busy-pointer sayacı 0 kaldığından eşzamanlı tekrar istek engellemesi **doğrulanmadı**.

Kanıt: [store-first-correction-2026-10-07.json](../evidence/store-first-correction-2026-10-07.json). Gerçek ağ çağrı sayısı, token kullanımı ve faturalanan ücret ölçülmedi; UI sayaçları bunların yerine geçmez. Kullanıcının mevcut 5 USD bakiyesi sınırıyla iki agent isteği yapıldı, bakiye yüklenmedi. [OpenRouter model endpoint bilgisi](https://openrouter.ai/api/v1/models/google/gemini-3.8-flash/endpoints) ve [reasoning ücretlendirmesi](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) kamu kaynaklarından kontrol edildi; yayımlı OpenRouter isteklerinde çıktı token sınırı yok, 25 saniyelik zaman aşımı ücret sınırı değildir. Native ekranlar araç çıktısında incelendi; kaydedilmiş görsel/Library ID yok. Kurulu mağaza paketi ve fetch işlevi değiştirilmedi. Yeniden hazırlama ve dar loopback sunucu komutları [fixture rehberinde](../tests/fixtures/README.md).

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
| Temiz, oturumsuz Chrome'da mağaza görünürlüğü/kurulumu; tarih, Chrome sürümü, ülke/bölge | **Kurulum PASS**: 7 Ekim 2026, Chrome 154.0.8037.98, resmî 3.4.0. **Ülke/bölge doğrulanmadı**. |
| Kurulu mağaza sürümünde anahtarsız popup/ayarlar/hata/toggle | **PASS**. İçerik hata yolu sentetik editör API'sinde; gerçek editör/sağlayıcı başarı testi değildir. |
| Mağazadan kurulan sürümle bulut ilk düzeltme, kabul/iptal | **PASS, yeniden deneme sonrası**: OpenRouter / google/gemini-3.8-flash ve gerçek Quill 2.0.3. İlk zaman aşımı korundu; kabul düz metin uyarısıyla, Quill geri alma da doğrulandı. |
| Mağazadan kurulan sürümle yerel ilk düzeltme, kabul/iptal | **NOT RUN**. Sentetik kaynak testleri bu ölçütü tamamlamaz. |
| Rehber, ekran ve editör matrisi sürüm açıklaması | Yerel kaynak güncellendi; dağıtım yapılmadı. Gerçek kurulum sonrası fark varsa tekrar güncellenmeli. |
| Mevcut demo ve tabloyu yeniden yapmama | Korundu. |

Kurulum ve bulut anahtarı/model/ücretli yapay metin testi kullanıcı onayıyla tamamlandı; aynı onaylar tekrar istenmez. #7'nin tamamı hâlâ açık: ülke/bölge ayrıca doğrulanmalı. Mevcut çalışan Ollama/llama.cpp bağlantısı için tam hedef origin/model ve **ayrı ek endpoint izni onayı** gerekir; kurulum onayı bunu kapsamaz. Yeni anahtar/belirteç veya yerel model servisi oluşturulmadı; agent ek sağlayıcı host izni istemedi/vermedi.

Kalan yerel testte ayrıca onaylanan mevcut çalışan Ollama/llama.cpp servisini kullanın. Yeni servis/model kurulumu bu çalışmanın parçası değil. **Bağlantıyı test et → örnek metni Düzelt → önizle → İptal → yeniden Düzelt → Kabul Et** sırasını gerçek editörde uygulayın. Tarih, ülke/bölge, Chrome/eklenti/editör sürümü ve görünür sonucu kaydedin. Sır alanları görsel dışında kalsın.

İlk kullanım çözüm bağlantıları: [izin ve kaydet/test](https://duzelt.yerli.dev/support/#kaydet-test), [yerel sunucu](https://duzelt.yerli.dev/support/#yerel-sunucu), [düğme görünmemesi](https://duzelt.yerli.dev/support/#dugme-gorunmuyor). Push, PR, merge, site/mağaza yayını ve #8 pilot/outreach bu yerel çalışmada yapılmadı.
