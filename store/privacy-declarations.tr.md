# Mağaza veri ve izin beyanı hazırlığı

Tek amaç: Uyumlu zengin metin editöründeki Türkçe metin için kullanıcının seçtiği modelden öneri almak ve değişiklikleri kullanıcının onayına sunmak.

Bu notlar kaynak kod ve PRIVACY.md ile hazırlanmıştır. Paneldeki gerçek sorular ve mevcut beyanlar görülmeden herhangi bir kutunun kaydedildiği veya hukuki taahhüdün kabul edildiği söylenmez.

## İşlenen veriler

**Kimlik doğrulama bilgileri:** Kullanıcının kendi API anahtarı/erişim belirteci ve SAP Client ID/secret gibi bağlantı alanları yerel profilde tutulur, seçilen serviste kimlik doğrulamak için iletilir. IBM/SAP belirteç değişimi metin/prompt içermez; kısa ömürlü sonuç işlem belleğinde tutulur.

**Web sitesi içeriği:** Kullanıcı Düzelt'e bastığında ilgili editörden çıkarılan metin ve sistem promptu seçilen API'ye gönderilir. İlgili metin kişisel bilgi içerebilir; bütün metnin anonim olduğu iddia edilmez. Önizleme bellektedir, eklenti kalıcı düzeltme geçmişi oluşturmaz. Kabul edilen metni kullanılan site ayrıca kaydedebilir.

**Ayarlar:** Sağlayıcı profilleri ve özel prompt chrome.storage.local kullanır. Açma/kapatma durumu chrome.storage.sync kullanabilir. Geliştiriciye ait toplama sunucusu, reklam/analitik/telemetri yoktur. Satış, reklam amaçlı aktarım veya kredi değerlendirmesi yoktur; seçilen servise aktarım kullanıcının istediği düzeltme işlevi içindir.

Eklenti tarayıcı geçmişi/çerezleri, ödeme, konum, sağlık veya kullanıcı etkinliği toplamaya yönelik özellik içermez. Kullanıcının düzeltmek için yazdığı serbest metnin bu bilgileri içerebilmesi ayrıca gizlilik politikasında açıklanır.

## İzin gerekçeleri

- `storage`: Kullanıcının sağlayıcı, model, erişim bilgileri, özel prompt ve açma/kapatma ayarlarını korur.
- `https://api.openai.com/*`: Mevcut OpenAI kurulumunun ve güncelleme yolunun korunması için varsayılan API erişimidir.
- İsteğe bağlı `https://*/*`: Kullanıcının seçtiği çok sayıdaki bulut/gateway API ve gerektiğinde belirteç adresi için yalnız seçilen origin'e izin istenir; bütün origin'lere tek seferde ağ izni verilmez.
- İsteğe bağlı `http://localhost/*`, `http://127.0.0.1/*`, `http://[::1]/*`: Kullanıcının seçtiği yerel Ollama/llama.cpp veya uyumlu loopback servise bağlanır.
- `http://*/*`, `https://*/*` içerik betiği eşleşmeleri: Desteklenen editörleri kullanan farklı siteleri algılar ve düzeltme düğmesini ekler. Ziyaret geçmişi toplanmaz; arka planda otomatik düzeltme isteği gönderilmez.

## Uzak kod

Çalışma kodu ve sağlayıcı kataloğu pakettedir. Uzak SDK, script veya çalıştırılabilir kod indirilmez. API yanıtı düzeltme metni/veri olarak işlenir. Site ve tanıtım videosu eklenti paketine dahil edilmez.

## Gizlilik URL'si

`https://duzelt.yerli.dev/privacy/` canlı doğrulandıktan sonra kullanılır. Sayfa PRIVACY.md'den üretilir; bağımsız ikinci politika tutulmaz. API anahtarı veya gerçek özel metin inceleme notlarına eklenmez.
