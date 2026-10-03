# AI Türkçe Metin Düzeltici — Gizlilik Politikası

Son güncelleme: 3 Ekim 2026

Bu politika, Mehmet Yerli tarafından geliştirilen AI Türkçe Metin Düzeltici Chrome eklentisinin veri işlemesini açıklar. Politikanın tek kaynak dosyası budur; web sitesindeki kopya bu dosyadan üretilecektir.

## Eklenti ne yapar?

Eklenti, uyumlu zengin metin editörlerinde Türkçe metin düzeltme isteği göndermenizi ve sonucu kabul etmeden önce değişiklikleri incelemenizi sağlar. Düzeltme isteği sizin düğmeye basmanızla gönderilir; eklenti web sayfalarındaki metinleri arka planda otomatik olarak yapay zekâ servislerine göndermez. Ayarlardan bir sağlayıcı, gateway veya yerel sunucu seçebilirsiniz.

## Chrome profilinizde tutulan veriler

- **Sağlayıcı bağlantıları:** `chrome.storage.local` içindeki `ai_provider_config` alanında etkin sağlayıcı ve ayrı sağlayıcı profilleri tutulur. Bu profiller seçilen model, API adresi/protokolü, API anahtarı veya erişim belirteci ile gerektiğinde bölge, proje/alan, hesap, gateway, kaynak grubu veya deployment adı gibi bağlantı alanlarını içerir. SAP bağlantısında Client ID, client secret ve OAuth token adresi de bu profilde tutulur. Eklenti bunları Chrome Sync'e kaydetmez.
- **Eski OpenAI kaydı:** Mevcut kurulumların `openai_api_key` yerel anahtarı korunur; yeni profil yoksa OpenAI bağlantısı bu değerden okunur. OpenAI anahtarı kaydedildiğinde yeni profil ile bu eski anahtar uyumlu tutulur.
- **Özel sistem promptu:** `chrome.storage.local` içindeki `custom_system_prompt` alanında tutulur. Boş veya varsayılan prompt kaydedildiğinde özel değer kaldırılır ve uygulamanın varsayılan kuralları kullanılır.
- **Açma/kapatma durumu:** `chrome.storage.sync` içindeki `ai_corrector_enabled` alanında tutulur. Chrome senkronizasyonu açıksa bu ayar Google hesabınız üzerinden diğer cihazlarınızla eşitlenebilir; yalnız bu cihazda kalacağı söylenemez.

Yerel saklama, Chrome profilinizin depolama alanını kullanır. Eklenti anahtar ve prompt için ayrıca şifreleme uygulamaz. Chrome destekliyorsa yerel depoya erişim eklentinin güvenilir sayfaları ve servis işçisiyle sınırlandırılır.

## Seçtiğiniz bağlantıya gönderilen veriler

**Düzelt** düğmesine bastığınızda, ilgili editörden çıkarılan metin ve varsayılan ya da kaydettiğiniz özel sistem promptu, tarayıcınızdaki eklenti servis işçisi tarafından etkin sağlayıcının API adresine gönderilir. Doğrudan API bağlantısında gereken anahtar/erişim belirteci aynı isteğin kimlik doğrulama başlığında kullanılır; anahtarın hiçbir yere gönderilmediği söylenemez. IBM/SAP bağlantıları önce aşağıdaki belirteç değişimini yapar. Model ve gerekli bulut bağlantı alanları da API sözleşmesine göre istek adresinde veya gövdesinde kullanılır.

IBM watsonx seçildiğinde IBM Cloud API anahtarı IBM IAM'ın `https://iam.cloud.ibm.com/identity/token` adresine gönderilir. SAP AI Core seçildiğinde Client ID ve client secret, servis anahtarından sizin girdiğiniz OAuth token adresine gönderilir. Bu kimlik istekleri editör metni veya sistem promptunu içermez. Dönen kısa ömürlü Bearer belirteci ilgili model API'sinde kullanılır; her işlemde yeniden alınır, yalnız işlem belleğinde tutulur ve kalıcı depoya yazılmaz.

Uzak bağlantılar HTTPS kullanır. Yerel bağlantıda localhost/loopback HTTP desteklenir. Bir gateway veya yerel proxy seçerseniz bu servis isteği başka bir sağlayıcıya yönlendirebilir; bunu o servisin yapılandırması ve koşulları belirler. Eklenti, gateway'in veya yerel sunucunun kendi kayıt/aktarım davranışını yönetmez.

Gönderdiğiniz metin veya özel prompt kişisel ya da gizli bilgi içerebilir. Seçtiğiniz servisle paylaşmak istemediğiniz içerikleri düzeltme isteğine eklemeyin. Sonuç, editöre uygulanmadan önce tarayıcınızda önizlenir; uygulanması için sizin kabul etmeniz gerekir.

**Bağlantıyı test et** işlemi de seçilen sağlayıcıya gerçek düzeltme isteği gönderir. İstek, kaydedilmiş bağlantı bilgileri ve kaydedilmiş sistem promptuyla birlikte sabit bir test metnini kullanır. Özel promptunuz kişisel bilgi içeriyorsa testte de iletilir. Bu işlem sağlayıcının kullanım ücretine tabi olabilir; formdaki kaydedilmemiş değişiklikler teste dahil edilmez.

Bulut bağlantılarında **Modelleri getir** düğmesine bastığınızda kaydedilmiş API adresine anahtar/belirteçle model-listesi isteği gönderilir. Yerel sağlayıcıyı seçtiğinizde bağlantı izni verdiğiniz localhost/loopback adresinden modeller otomatik alınır. Kayıtlı yerel bağlantının ayarları açılırken yalnız önceden izin verilmiş adresten liste istenir. Yerel **Modelleri getir** işlemi formda girdiğiniz adresi kullanabilir; bu işlem etkin sağlayıcınızı veya kayıtlı bağlantınızı değiştirmez ve kimlik bilgisi göndermez. Bu model-listesi isteklerinde editör metni veya sistem promptu gönderilmez. Model-listesi yolu uygulanmamış bağlantılarda eklentiyle birlikte gelen katalog gösterilir. Models.dev kataloğu eklentiye yerel hazırlıkta eklenir; normal kullanımda Models.dev'e anahtar, prompt veya metin gönderilmez ve uzak SDK/kod indirilmez.

OpenAI'ye Chat Completions ile gönderilen isteklerde ve Responses biçimindeki isteklerde `store: false` kullanılır. Diğer sağlayıcıların chat isteklerine veya diğer protokollere bu alan eklenmez. Uyumlu bir API bu alanı desteklemeyebilir; alanın gönderilmesi bütün servislerde veri saklamama garantisi vermez. Güvenlik kayıtları, gateway kayıtları ve hesabınıza uygulanan koşullar ayrıca geçerlidir. OpenAI özelinde güncel ayrıntılar [API veri kontrolleri](https://developers.openai.com/api/docs/guides/your-data) belgesindedir.

Bağlantı kaydı/testi sırasında Chrome'dan seçilen API adresi ve gerekiyorsa IBM IAM veya SAP OAuth adresi için izin istenir. İzin verilmeyen adrese düzeltme/kimlik isteği gönderilmez. Eklenti kimlik doğrulama içeren API isteklerinde yönlendirmeyi izlemez; tarayıcı çerezleri ve sayfanın referrer bilgisi isteğe eklenmez.

## Geliştiriciye aktarım ve geçici veriler

Eklenti, metninizi, API anahtarınızı veya özel promptunuzu geliştiricinin sunucusuna göndermez. Reklam, analitik, izleme ve telemetri işlevi içermez. Tarayıcı geçmişini veya çerezleri toplamaya yönelik bir özellik bulunmaz.

Düzeltme metni, API yanıtı ve değişiklik önizlemesi işlem süresince bellekte ve sayfanın önizleme arayüzünde bulunur; eklenti bunlar için kalıcı geçmiş oluşturmaz. Kabul ettiğiniz metin, kullandığınız web sitesinin editörüne yazılır. Bu sitenin metni kaydetmesi ve işlemesi, sitenin kendi koşullarına tabidir.

Destek için e-posta gönderir veya GitHub'da sorun açarsanız, sizin paylaştığınız iletişim bilgileri ve açıklamalar bu kanallar üzerinden iletilir. Herkese açık GitHub sorunlarına anahtar, özel prompt veya özel metin eklemeyin.

## Verilerinizi yönetme

Bir sağlayıcının anahtarını ayarlardan değiştirebilir veya boş kaydederek o profilin anahtar değerini temizleyebilirsiniz. Sağlayıcı değiştirmek diğer kayıtlı profilleri/anahtarları silmez. Özel promptu boş kaydetmek ya da varsayılanı yükleyip kaydetmek, özel prompt kaydını kaldırır. Açma/kapatma düğmesi, eklentinin ilgili sayfalardaki düğmelerini yönetir; ayarları silmez.

Chrome'dan eklentiyi kaldırmak, o Chrome profilindeki eklenti depolamasını kaldırır. Başka cihazlarınızın Chrome Sync durumunu ayrıca kontrol edin. Bir sağlayıcıya daha önce iletilmiş veriler üzerindeki saklama veya silme işlemleri eklentiden yönetilemez; ilgili servis hesabınızın kontrollerini kullanın.

## Güvenlik ve veri kullanım amacı

Uzak API istekleri HTTPS, kullanıcı tarafından seçilen yerel servisler loopback HTTP kullanabilir. Anahtar, düzeltilecek metin ve prompt hata mesajlarına veya uygulama loglarına yazılmaz. Saklanan anahtar, cihazınız ve Chrome profilinizin güvenliğine de bağlıdır.

Eklenti bağlantı bilgilerini sizin başlattığınız metin düzeltme, bağlantı testi ve model listesini yenileme için kullanır; geliştirici bunları satmaz, reklam amacıyla kullanmaz veya başka amaçlarla toplayan bir sistem işletmez. Seçilen servise aktarım, bu kullanıcı tarafından istenen işlevi gerçekleştirmek içindir.

## Üçüncü taraflar ve değişiklikler

Seçilen sağlayıcı, gateway veya yerel sunucunun hizmet ve veri işleme koşulları ayrıca geçerlidir. Chrome depolaması ve senkronizasyonu Google'ın tarayıcı özelliklerine bağlıdır. Bu politika, bu hizmetler için sıfır saklama veya belirli bir mevzuata tam uyum garantisi vermez.

Eklentinin veri akışı değişirse bu dosya, mağaza beyanları ve web sitesindeki politika birlikte güncellenir. Son güncelleme tarihi sayfanın başında gösterilir.

## İletişim

Geliştirici: Mehmet Yerli

- [iletisim@mehmetyerli.com](mailto:iletisim@mehmetyerli.com)
- [Destek ve sorun bildirimi](https://github.com/mytsx/duzelt-ai/issues)
- [Kaynak kod](https://github.com/mytsx/duzelt-ai)
- [Yerli.dev](https://yerli.dev/)
