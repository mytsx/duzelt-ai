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

OpenCode'un kullandığı [Models.dev](https://models.dev/) kaynağından alınan 3 Ekim 2026 görüntüsündeki **226 sağlayıcının tamamı** merkezi katalogda tutulur. Ollama ve llama.cpp yerel bağlantılarıyla arayüzde **228 kayıt** bulunur. Sağlayıcı seçimini açıp aynı listenin içinden arama yapabilir; OpenRouter dahil uyumlu API'leri veya kendi bağlantınızı seçebilirsiniz.

Katalogda bulunmak, gerçek hesabınızla çalışmanın veya her modelin metin düzeltmeye uygunluğunun doğrulandığı anlamına gelmez. **225 kayıt** için bağlantı protokolü ve kimlik yöntemi uygulanır. GitHub Copilot, GitLab Duo ve v0 kayıtları açıklamalarıyla görünür; bu ürünlerin gerekli oturum/ajan akışı için doğrulanmış adaptör bulunmadığından doğrudan seçilemez. Görsel, ses, gerçek zamanlı ve özel araç akışı gerektiren modeller düzeltme adaylarından ayrılır. Bedrock ve Vertex gibi servislerde bölgesel erişim ve model/protokol sınırları vardır. Ayrıntılar [sağlayıcı araştırmasında](docs/providers-research.md) ve [özel bağlantı notlarında](docs/provider-edge-notes.md) açıklanır.

IBM watsonx, IBM Cloud anahtarını IAM erişim belirtecine dönüştürerek proje veya alan kimliğiyle bağlanır. SAP AI Core, servis anahtarındaki Client ID/secret ve OAuth adresiyle bağlanır; varsayılan Orchestration V2 farklı model aileleri için ortak metin yolunu kullanır. SAP'de doğrudan OpenAI deployment seçeneği de vardır. Bu bağlantılar kendi hesabınızdaki deployment, kaynak grubu, bölge ve model yetkilerini gerektirir.

Model kataloğu eklentiyle birlikte gelir; arayüz açılırken Models.dev'den veri veya uzak SDK indirilmez. Bulut bağlantılarında **Modelleri getir**, kaydedilmiş sağlayıcının desteklenen model-listesi API'sini kullanır; bu yol uygulanmamışsa yerleşik kayıtlar gösterilir. Yerel sağlayıcı seçilince adres için Chrome izni verildikten sonra çalışan sunucunun modelleri otomatik listelenir. Kayıtlı yerel bağlantıyla ayarlar açıldığında yalnız önceden izin verilmiş adresten liste alınır. Modelin tam adını/deployment kimliğini elle de girebilirsiniz. **Bağlantıyı test et** kaydedilmiş bağlantıyı kullanır.

Formun altındaki durum, seçiminizin kaydedilmediğini, bilgilerinizin eksik olduğunu veya bağlantının kayıtlı ve etkin olduğunu gösterir. **Kaydet ve kullan** sağlayıcı/model/adres seçimini etkinleştirir. **Kuralları kaydet** özel promptu ayrıca kaydeder; **Varsayılanı yükle** yalnız formu değiştirir. Bağlantı testi formdaki taslağı kullanmaz; hangi kayıtlı sağlayıcı/modelin test edileceği düğmenin yanında açıklanır.

Bağlantı kaydedilirken seçilen API adresi ve gerekiyorsa kimlik doğrulama adresi için Chrome izni istenir. Yeni bir özel bağlantı adresini kullanmadan önce ekranda gösterilen hedefleri kontrol edin. Özel servisler HTTPS; yerel servisler localhost/loopback HTTP kullanabilir. Metin seçtiğiniz model bağlantısına, kimlik bilgileri ilgili sağlayıcının API veya belirteç servisine gönderilir.

### Ollama ve llama.cpp ile yerel kullanım

Ayarlar ekranındaki **Bilgisayarınızda çalıştırın** bölümünde **Ollama** veya **llama.cpp** kartını seçin. Yerel sunucu adresi doğrudan görünür; bu bağlantılarda API anahtarı gerekmez. Ollama için varsayılan adres `http://127.0.0.1:11434/v1`, llama.cpp için `http://127.0.0.1:8080/v1` adresidir. `localhost` da kullanılabilir.

Ollama kartını seçin ve Chrome bağlantı iznini verin. Sunucu çalışıyorsa yüklü metin modelleri seçim listesinde görünür; modeli seçip **Kaydet ve kullan** düğmesine basın. Model listesini almak etkin sağlayıcınızı değiştirmez ve bağlantıyı önceden kaydetmenizi gerektirmez. Adresi değiştirdiğinizde **Modelleri getir** ile yeni adresten liste alın. Model adını biliyorsanız elle de girebilirsiniz. Ollama'nın model listesinde yetenek bilgisi varsa yalnız embedding üreten modeller ayrılır.

**Ollama’yı nasıl bağlarım?** rehberinde önce çalışan Ollama'yı durdurun: Terminal için Ctrl+C, uygulama için Çıkış; yalnız Homebrew servisiyle başladıysa `brew services stop ollama`. Kapalıysa doğrudan başlatma adımına geçin. Rehberdeki eklenti izinli tek başlatma komutunu **Kopyala** ile alıp Terminal'de çalıştırın ve o Terminal'i açık bırakın. Ardından **Modelleri getir**, model seçimi ve **Kaydet ve kullan** ile devam edin. Eklenti bilgisayarınızda komut çalıştırmaz. Liste boşsa başka bir Terminal'de `ollama list` ile yüklü modelleri kontrol edin.

Ollama bağlantısı [resmî OpenAI uyumlu API](https://docs.ollama.com/api/openai-compatibility) üzerinden yapılır. Varsayılan bağlantı localhost/loopback kullanır; farklı origin veya ağ erişimi gerekiyorsa Ollama'nın kendi erişim ayarları ayrıca geçerlidir.

Chrome'un bağlantı izni ve Ollama'nın origin izni ayrı koşullardır. Rehberdeki başlatma komutu [resmî origin ayarını](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama) kendi eklenti kimliğiyle birlikte hazırlar: `OLLAMA_ORIGINS=chrome-extension://EKLENTI_KIMLIGI ollama serve`. Ekrandaki tam komutu kopyalayın; kimliği elle bulmanız gerekmez. “Address already in use” çıkarsa eski Ollama süreci hâlâ çalışıyordur; önce durdurun.

## Editör desteği ve sınırlar

Yerel tarayıcı doğrulaması CKEditor **4.22.1**, CKEditor **48.5.2** (CKEditor 5), Summernote **0.9.1**, TinyMCE **8.9.2** ve Quill **2.0.3 / 1.3.7** classic kurulumlarıyla yapılır. Entegrasyonun test durumu, kanıtı ve sınırları [test kayıtlarında](docs/testing.md) belirtilir. Bir editörün test edilmesi, onu kullanan bütün sitelerin desteklendiğini kanıtlamaz.

WordPress, Drupal, Joomla, Notion veya başka bir platform için genel destek iddiası yoktur. Sayfanın editör kurulumu, sürümü, iframe yapısı ve özelleştirmeleri uyumluluğu etkileyebilir. Özellikle Notion'ın Quill kullandığı varsayılmaz.

Biçimli metinlerin uygulanması editörün veri modeliyle birlikte test edilmelidir. Paragraf, liste, kalın/italik metin, bağlantı ve kelime ekleme/çıkarma durumlarında son önizlemeyi inceleyin. Güvenli biçim eşlemesi yapılamayan durumda eklenti uyarı verir; biçimlerin her durumda korunacağı vaat edilmez.

## Kurulum ve kullanım

Normal kurulum için [yayınlanmış mağaza öğesini](https://chromewebstore.google.com/detail/ai-t%C3%BCrk%C3%A7e-metin-d%C3%BCzeltici/gnkhgnhdokinbamhokpljgafapfjhjhl) kullanın. Aynı öğenin kimliği ve kurulu kullanıcıların güncelleme yolu korunur. Kaynaktan yerel deneme için:

1. Chrome'da `chrome://extensions/` sayfasında **Geliştirici modu** seçeneğini açın.
2. **Paketlenmemiş öğe yükle** ile bu proje klasörünü seçin.
3. Eklenti simgesinden **Ayarlar** sayfasını açın; sağlayıcı, model ve bağlantı bilgileriyle **Kaydet ve kullan** düğmesine basıp seçilen adres için Chrome izni verin. Eski OpenAI kaydı varsayılan bağlantı olarak okunur.
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

## Web sitesi ve yayın

Claude Design kaynakları `site/` altında entegre edildi. [duzelt.yerli.dev](https://duzelt.yerli.dev/), [destek](https://duzelt.yerli.dev/support/) ve [gizlilik](https://duzelt.yerli.dev/privacy/) 3 Ekim 2026'da canlı HTTPS ile doğrulandı. Site yalnız statik varlık sunan ayrı `duzelt-site` Worker'ıdır; eklenti API isteği veya kullanıcı anahtarı bu siteye gönderilmez.

Bağlantılar `lib/product-config.js`, sürüm/ikonlar `manifest.json`, politika `PRIVACY.md` kaynağından hazırlanır. `site/assets/js/config.js` ve sitedeki politika kopyası elle düzenlenmez. İkon, güncel popup/ayar ekranları, HTML bağlantıları, favicon, robots ve sitemap aynı hazırlık adımında eşitlenir.

```sh
npm ci
npm run site:prepare
npm run site:preview
npm run site:test:browser
npm run site:check
npm run site:deploy
```

Önizleme yalnız `127.0.0.1:8787` adresinde çalışır. Dağıtım yapılandırması `wrangler.site.jsonc` dosyasındadır. Cloudflare Workers Builds mevcut `mytsx/duzelt-ai` deposunun `main` dalına bağlıdır; kök `/`, kontrol `npm run site:check`, yayın `npm run site:deploy`, preview build kapalıdır. `f635ca2` kod tesliminin gerçek main push'ı, başarılı uzak build/deploy ve canlı site ayrı ayrı doğrulandı; sonuçlar [teslim kaydında](evidence/delivery-results.json) tutulur.

## Video ve mağaza gönderimi

32 saniyelik Türkçe tanıtımın kaynakları ve gerçek ekranları `store/video/`, beş mağaza ekranı `store/screenshots/`, promosyonlar `store/promos/`, YouTube kapak ve açıklaması `store/youtube/` altındadır. MP4, ses ve Türkçe SRT yerel `output/video/licensed/` klasöründedir; eklenti çalışma ZIP'ine ve Git'e dahil edilmez. Üretim ve sınırlı kalite kanıtı [video notlarında](store/video/RENDER.md) ve [QA kaydında](store/video/qa.json) bulunur.

ElevenLabs Starter planından alınan lisanslı kayıt, gerçek sözcük/durak zamanları ve özgün fon müziği kullanıldı. Kod çözümleme, ses seviyeleri, altyazı ve bütün sahne/geçiş kareleri kontrol edildi. Araç ses girdisi desteklemediğinden baştan sona insan dinlemesi tamamlanmış sayılmaz.

[Tanıtım videosu](https://youtu.be/q4k1awKQu1w) mevcut Yerli Developer kanalında liste dışı yayımlandı. Kayıtlı özel kapak, ürüne ait oynatma listesi, tamamlanmış HD işlemi, manuel Türkçe altyazı ve sorunsuz telif kontrolü gerçek YouTube arayüzünde doğrulandı. Merkezi yapılandırmadaki bu adresi kullanan site oynatıcıyı yalnız kullanıcı tıklamasıyla yükler; ses kapalı ve Türkçe altyazı tercihli başlar.

Mevcut mağaza öğesine 3.4.0 paketi, beş yeni ekran görüntüsü, iki promosyon görseli, video/site/destek bağlantıları ve güncel gizlilik/izin beyanları kaydedildi. 3 Ekim 2026'da **incelemeye gönderildi**; panel **İncelenmeyi bekliyor** gösterdi. İncelemeyi geçtikten sonra otomatik yayın seçeneği açıktır. Kamuya sunulan 3.3.0 ile incelemedeki 3.4.0 ayrı tutulur; gönderim kaydı [store/submission.json](store/submission.json) içindedir.

Özgün Claude Design teslimi yerel `output/site-design-original-2026-10-03/` klasöründe yedeklidir. Eski tasarım referans kiti `npm run design:kit` ile yeniden üretilebilir; site ve mağaza çalışma paketi birbirinden ayrıdır.

## Destek

Geliştirici: **Mehmet Yerli** · [iletisim@mehmetyerli.com](mailto:iletisim@mehmetyerli.com) · [Yerli.dev](https://yerli.dev/)

[Sorun bildir](https://github.com/mytsx/duzelt-ai/issues) · [Kaynak kod](https://github.com/mytsx/duzelt-ai)

Sorun bildirirken Chrome/eklenti/editör sürümünü ve kişisel bilgi içermeyen yeniden üretme adımlarını paylaşın. API anahtarınızı, özel promptunuzu veya gerçek özel metninizi paylaşmayın.
