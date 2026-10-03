# AI Türkçe Metin Düzeltici

Chrome'daki uyumlu zengin metin editörlerine Türkçe düzeltme düğmesi ekler. Kullanıcı **Düzelt → değişiklikleri incele → Kabul Et** akışıyla sonuca karar verir; **İptal** asıl metni korur.

Eklenti yazım, noktalama ve resmî yazışma üslubu için seçtiğiniz yapay zekâ sağlayıcısından öneri alır. Sonucu kullanmadan önce gözden geçirin; kusursuz doğruluk, resmî kurum onayı veya mevzuata uyum garantisi verilmez.

**Yerel bakım sürümü: 3.4.0.** 3 Ekim 2026'da doğrulanan [mevcut Chrome Web Store öğesi](https://chromewebstore.google.com/detail/ai-t%C3%BCrk%C3%A7e-metin-d%C3%BCzeltici/gnkhgnhdokinbamhokpljgafapfjhjhl) **3.3.0** sunuyor. Yeni paket henüz mağazaya gönderilmedi; [durum kaydı](docs/current-state.json) bu iki sürümü ayrı tutar.

## Gereksinimler ve ücret

- Masaüstü Chrome **111 veya üzeri** ve desteklenen bir zengin metin editörü gerekir. Normal `input` ve `textarea` alanlarına düğme eklenmez.
- **Ayarlar** sayfasında sağlayıcıyı, metin modelini ve gerekiyorsa kendi API anahtarınızı veya erişim belirtecinizi kaydedin. Bulut servisleri hesap/bölge/proje bilgisi, yerel servisler çalışan bir sunucu gerektirebilir.
- Sağlayıcı API kullanımı eklentiden ayrı ücretlendirilir. **Bağlantıyı test et** düğmesi de kaydedilmiş bağlantıya gerçek bir düzeltme isteği yapar; bakiye ve kota durumunuzu sağlayıcı hesabınızdan kontrol edin.
- Çalışma sürümünün tek kaynağı [manifest.json](manifest.json) dosyasıdır. Mevcut kullanıcıların OpenAI anahtarı ve varsayılan `gpt-4o` modeli korunur; bu modelin sıcaklığı `0.3` değeridir.

## Sağlayıcı ve model seçimi

OpenCode'un kullandığı [Models.dev](https://models.dev/) kaynağından alınan 3 Ekim 2026 görüntüsündeki **226 sağlayıcının tamamı** merkezi katalogda tutulur. Ollama ve llama.cpp yerel bağlantılarıyla arayüzde **228 kayıt** bulunur. Arama alanı ve sağlayıcı listesiyle sağlayıcıyı bulabilir; OpenRouter dahil uyumlu API'leri veya kendi bağlantınızı seçebilirsiniz.

Katalogda bulunmak, gerçek hesabınızla çalışmanın veya her modelin metin düzeltmeye uygunluğunun doğrulandığı anlamına gelmez. **225 kayıt** için bağlantı protokolü ve kimlik yöntemi uygulanır. GitHub Copilot, GitLab Duo ve v0 kayıtları açıklamalarıyla görünür; bu ürünlerin gerekli oturum/ajan akışı için doğrulanmış adaptör bulunmadığından doğrudan seçilemez. Görsel, ses, gerçek zamanlı ve özel araç akışı gerektiren modeller düzeltme adaylarından ayrılır. Bedrock ve Vertex gibi servislerde bölgesel erişim ve model/protokol sınırları vardır. Ayrıntılar [sağlayıcı araştırmasında](docs/providers-research.md) ve [özel bağlantı notlarında](docs/provider-edge-notes.md) açıklanır.

IBM watsonx, IBM Cloud anahtarını IAM erişim belirtecine dönüştürerek proje veya alan kimliğiyle bağlanır. SAP AI Core, servis anahtarındaki Client ID/secret ve OAuth adresiyle bağlanır; varsayılan Orchestration V2 farklı model aileleri için ortak metin yolunu kullanır. SAP'de doğrudan OpenAI deployment seçeneği de vardır. Bu bağlantılar kendi hesabınızdaki deployment, kaynak grubu, bölge ve model yetkilerini gerektirir.

Model kataloğu eklentiyle birlikte gelir; arayüz açılırken Models.dev'den veri veya uzak SDK indirilmez. **Modelleri yenile** işlemi yalnız tıkladığınızda, kaydedilmiş sağlayıcının desteklenen model-listesi API'sini kullanır; bu yol uygulanmamışsa yerleşik kayıtlar gösterilir. Modelin tam adını/deployment kimliğini elle de girebilirsiniz. Hesabınızın erişimi **Bağlantıyı test et** ile ayrıca doğrulanır.

Bağlantı kaydedilirken seçilen API adresi ve gerekiyorsa kimlik doğrulama adresi için Chrome izni istenir. Yeni bir özel bağlantı adresini kullanmadan önce ekranda gösterilen hedefleri kontrol edin. Özel servisler HTTPS; yerel servisler localhost/loopback HTTP kullanabilir. Metin seçtiğiniz model bağlantısına, kimlik bilgileri ilgili sağlayıcının API veya belirteç servisine gönderilir.

## Editör desteği ve sınırlar

Yerel tarayıcı doğrulaması CKEditor **4.22.1**, CKEditor **48.5.2** (CKEditor 5), Summernote **0.9.1**, TinyMCE **8.9.2** ve Quill **2.0.3 / 1.3.7** classic kurulumlarıyla yapılır. Entegrasyonun test durumu, kanıtı ve sınırları [test kayıtlarında](docs/testing.md) belirtilir. Bir editörün test edilmesi, onu kullanan bütün sitelerin desteklendiğini kanıtlamaz.

WordPress, Drupal, Joomla, Notion veya başka bir platform için genel destek iddiası yoktur. Sayfanın editör kurulumu, sürümü, iframe yapısı ve özelleştirmeleri uyumluluğu etkileyebilir. Özellikle Notion'ın Quill kullandığı varsayılmaz.

Biçimli metinlerin uygulanması editörün veri modeliyle birlikte test edilmelidir. Paragraf, liste, kalın/italik metin, bağlantı ve kelime ekleme/çıkarma durumlarında son önizlemeyi inceleyin. Güvenli biçim eşlemesi yapılamayan durumda eklenti uyarı verir; biçimlerin her durumda korunacağı vaat edilmez.

## Kurulum ve kullanım

Normal kurulum için [yayınlanmış mağaza öğesini](https://chromewebstore.google.com/detail/ai-t%C3%BCrk%C3%A7e-metin-d%C3%BCzeltici/gnkhgnhdokinbamhokpljgafapfjhjhl) kullanın. Aynı öğenin kimliği ve kurulu kullanıcıların güncelleme yolu korunur. Kaynaktan yerel deneme için:

1. Chrome'da `chrome://extensions/` sayfasında **Geliştirici modu** seçeneğini açın.
2. **Paketlenmemiş öğe yükle** ile bu proje klasörünü seçin.
3. Eklenti simgesinden **Ayarlar** sayfasını açın; sağlayıcı, model ve bağlantı bilgilerini kaydedip seçilen adres için Chrome izni verin. Eski OpenAI kaydı varsayılan bağlantı olarak okunur.
4. İsterseniz sistem promptunu özelleştirip kaydedin. Boş prompt veya kaydedilmiş varsayılan metin, uygulamanın güncel varsayılan kurallarını kullanır.
5. Bağlantıyı test edin. Bu işlem, seçilen sağlayıcının kaydedilmiş bağlantı bilgilerini ve kaydedilmiş promptu kullanır; formdaki kaydedilmemiş değişiklikler teste dahil edilmez.
6. Uyumlu editörde metninizi yazın, **Düzelt** düğmesine basın ve değişiklikleri inceleyin. **Kabul Et** sonucu uygular; **İptal** veya Escape önizlemeyi kapatır.

Açma/kapatma durumu popup'tan yönetilir. Eklenti güncellenirken mevcut ayar anahtarları korunur.

## Verileriniz

- Sağlayıcı profilleri, anahtarlar/erişim belirteçleri, SAP Client ID/secret, seçilen model/API adresi ve özel sistem promptu `chrome.storage.local` içinde bu Chrome profiline kaydedilir. Eklenti bunları Chrome Sync'e yazmaz; ayrıca kendi şifreleme katmanını uygulamaz. IBM/SAP kimlik değişiminde alınan kısa ömürlü belirteç kalıcı depoya yazılmaz.
- Açma/kapatma ayarı `chrome.storage.sync` içindedir; Chrome senkronizasyonu açıksa cihazlar arasında eşitlenebilir.
- Düzeltme sırasında editörün metni ve sistem promptu etkin sağlayıcıya gönderilir. Gerekli anahtar/erişim belirteci istekte kimlik doğrulaması için kullanılır; IBM/SAP önce kendi belirteç servisiyle kimlik değişimi yapar. Yerel bir sunucu seçilirse istek bu sunucuya gider; sunucunun başka hizmetlere yönlendirme davranışını kullanıcı yönetir.
- Eklenti geliştiricisinin sunucusuna metin/anahtar gönderen, reklam, analitik veya telemetri özelliği bulunmaz. Seçilen sağlayıcının ve varsa gateway'in veri işleme koşulları ayrıca geçerlidir.

Ayrıntılı ve tek kaynak politika: [PRIVACY.md](PRIVACY.md).

## Geliştirme ve doğrulama

Eklenti çalışma dosyaları düz JavaScript ve CSS kullanır; derleme gerektirmez. Değişiklik sonrası `chrome://extensions/` üzerinden eklentiyi yeniden yükleyin ve test sayfasını yenileyin.

```sh
npm run test:provider
node tests/editor-bootstrap.mjs
npm run test:editors
npm run test:ui
python3 -m unittest discover -s tests -p 'test_package_store.py'
python3 -m unittest discover -s tests -p 'test_provider_catalog.py'
python3 tools/package-store.py
```

Paketleme için `npm run package:store` da kullanılabilir. Tarayıcı testleri için proje geliştirme bağımlılıklarını `npm ci`, test tarayıcısını `npx playwright install chromium` ile hazırlayın. Arayüz testinde Chrome'un yerel izin penceresinin sonucu fixture ile taklit edilir; gerçek kullanıcı izni ayrıca denenmelidir. Yerel taklit API testi, gerçek sağlayıcı hesabı/kalite testi, gerçek editör testi, uzak build, canlı site ve mağaza incelemesi ayrı kanıt sınıflarıdır; ayrıntılar [docs/testing.md](docs/testing.md) dosyasındadır.

Paketleyici manifestteki referansları ve yerel çalışma bağımlılıklarını takip ederek `dist/duzelt-ai-<sürüm>.zip` üretir. Manifest ZIP kökünde bulunur; referanslar, dosya içerikleri ve CRC doğrulanır. Sabit zaman damgası, dosya izinleri ve sıralama aynı kaynaklardan tekrarlanabilir çıktı sağlar; `.zip.sha256` dosyası sağlama toplamını içerir. Kullanılmayan kütüphaneler, site/test/video kaynakları, `.git`, `node_modules` ve ayar dosyaları pakete girmez.

## Dizinler

| Dizin / dosya | Amaç |
| --- | --- |
| `background/` | Mesaj yönetimi ve servis işçisindeki merkezi sağlayıcı isteği; etkin ağ akışı `provider-service.js` üzerinden yürür. |
| `content/` | Editör entegrasyonları, düzeltme düğmesi ve değişiklik önizlemesi. |
| `popup/`, `options/` | Açma/kapatma, etkin sağlayıcı/model ve bağlantı/prompt ayarları. |
| `lib/`, `icons/` | Statik sağlayıcı kataloğu, çalışma kütüphaneleri, ortak bağlantılar ve ikonlar. |
| `tools/`, `tests/`, `docs/` | Paketleme, doğrulama ve test kanıtları. |
| `PRIVACY.md` | Gizlilik politikasının tek kaynak dosyası. |
| `TODO.md` | Bakım ve tasarım teslimiyle birlikte ilerleyen yayın işleri. |

Katalog hazırlama aracı `tools/update-provider-catalog.py` yalnız yerel geliştirme sırasında kullanılır; kaynak tarihi, SHA-256 değeri ve MIT lisansı üretilmiş dosyada bulunur. Kaynağı yenilemek eklentiyi yayımlamaz veya kullanıcı adına API isteği yapmaz. Tekrarlanabilir hazırlık ve tüm sağlayıcı dökümü [docs/providers-research.md](docs/providers-research.md) dosyasındadır.

Web sitesi tasarımı Claude Design'dan geldikten sonra `site/` altında entegre edilecektir. Cloudflare yayını, video görselleri ve mağaza tanıtım görselleri bu tasarım aşamasını bekler. Popup bağlantıları bu sırada mevcut depo/destek/gizlilik adreslerini kullanır; tek bağlantı yapılandırması `lib/product-config.js` dosyasındadır.

Claude Design'a [hazır promptu](design/claude-design-prompt.txt) yapıştırın. `npm run design:kit`, güncel test/görsel kanıtlarını kontrol ederek ikonlar, gerçek uygulama ekranları, gizlilik metni ve ürün sınırlarıyla `output/claude-design-kit-3.4.0.zip` üretir. Bu paketteki referans dosyalarını tasarım aracına verin; düzenlenebilir `site/` kaynaklarını ZIP olarak geri getirin. Tasarım kiti mağazaya yüklenecek eklenti paketinden ayrıdır.

## Destek

Geliştirici: **Mehmet Yerli** · [iletisim@mehmetyerli.com](mailto:iletisim@mehmetyerli.com) · [Yerli.dev](https://yerli.dev/)

[Sorun bildir](https://github.com/mytsx/duzelt-ai/issues) · [Kaynak kod](https://github.com/mytsx/duzelt-ai)

Sorun bildirirken Chrome/eklenti/editör sürümünü ve kişisel bilgi içermeyen yeniden üretme adımlarını paylaşın. API anahtarınızı, özel promptunuzu veya gerçek özel metninizi paylaşmayın.
