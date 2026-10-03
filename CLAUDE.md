# CLAUDE.md

## Proje ve kapsam

AI Türkçe Metin Düzeltici, Manifest V3 kullanan bir Chrome eklentisidir. Yerel bakım sürümü **3.4.0**, asgari Chrome sürümü **111**; sürümün asıl kaynağı `manifest.json` dosyasıdır. Mağazadaki yayın sürümü yerel sürümle aynı kabul edilmez; doğrulama kaydı `docs/current-state.json` içinde tutulur.

Yalnız CKEditor 4/5, Summernote, TinyMCE ve Quill gibi **zengin metin editörleri** kapsam içindedir. Normal input/textarea desteği veya yeni ürün özellikleri kullanıcı istemeden eklenmez. WordPress, Drupal, Joomla ve Notion için genel destek iddiası yapılmaz. Test edilen gerçek editör sürümleri ve sonuçları `docs/testing.md` içinde kaydedilir; bir DOM maketi veya editör testi bütün CMS'lerin desteklendiğini göstermez.

## Çalışma mimarisi

1. `content/editor-bridge.js`, manifestin `world: MAIN` alanıyla sayfa bağlamında çalışır. Gerçek editör nesnelerini bulur ve editörlerin okuma/yazma API'lerini kullanır.
2. `content/content.js`, izole içerik betiğinde düğmeleri, metin çıkarma/HTML temizleme, diff önizlemesini ve kullanıcı kabulünü yönetir. Köprüyle `duzelt-ai:editor-request` / `duzelt-ai:editor-response` olayları üzerinden yalnız editör işlemleri için haberleşir.
3. Düzeltilecek düz metin `chrome.runtime.sendMessage` ile servis işçisine gider.
4. `background/background.js`, `ProviderService` üzerinden kaydedilmiş etkin sağlayıcı profilini okur. **Etkin API ve kimlik ağı yalnız `background/provider-service.js` üzerinden yürür.** Genel `fetchJSON` izin/kimlik/model akışını, özel `requestJSON` ortak HTTP güvenlik ve zaman aşımı sınırını yönetir. `background/openai-provider.js` varsayılan promptu, ortak hata tipini ve eski OpenAI giriş noktasının uyumlu sarmalayıcısını tutar.
5. Yanıt önizlemeden sonra kullanıcı kabul ederse editörün kendi API'siyle uygulanır. Köprü anahtarı, özel promptu veya sağlayıcı isteğini içermez.

Sağlayıcı kataloğu `lib/provider-catalog.js` ile paketlenir; `tools/update-provider-catalog.py` yalnız yerel hazırlıkta public metadata'dan deterministik çıktı üretir. SDK adları kaynak metadata'dır; npm/CLI paketi veya uzak JavaScript eklentide çalıştırılmaz. Ayarlar yalnız saf profil/izin resolver'ını kullanır, düzeltme ve model yenileme mesajlarını servis işçisine gönderir. Ayrıntılar `docs/providers-research.md` ve `docs/provider-edge-notes.md` dosyalarındadır.

Editör yazma yöntemleri: CKEditor 4 `setData/updateElement`, CKEditor 5 `editor.data.set`, Summernote `summernote('code')`, TinyMCE `setContent/save` ve undo transaction, Quill `clipboard.convert/setContents`. Doğrudan `innerHTML + input` yazmak editör veri modelinin yerine kullanılmaz. Quill 1 ve 2'nin clipboard arayüzleri farklıdır. CKEditor 5 çok köklü/işbirlikçi kurulumları ayrıca test edilmeden desteklenmez.

## Metin güvenliği ve kabul davranışı

- İzole içerik betiği HTML'i `DOMParser` ile ayrıştırır; çalıştırılabilir öğeleri, olay özniteliklerini, tehlikeli URL'leri ve izin verilmeyen stilleri kaldırır.
- Model çıktısı HTML olarak yorumlanmaz. Diff ve metin düğümleri `textContent` ile yazılır.
- Biçim eşlemesi, metin düğümleri ve karakter konumları üzerinden yapılır. Kelime ekleme/çıkarma tek başına tüm biçimleri kaldırma gerekçesi değildir.
- Paragraf/diğer yapısal değişiklikler güvenle eşlenemiyorsa önizleme **düz metin dönüşümü uyarısı** gösterir. Kullanıcı kabul etmeden hiçbir dönüşüm uygulanmaz.
- İstekten sonra editör yeniden okunur; kabul sırasında köprü de beklenen HTML'i karşılaştırır. Yeni metin eski yanıttan dolayı ezilmez.
- İptal, Escape, yeni işlem veya eklentiyi kapatma bekleyen sonucun uygulanmasını engeller. Ağ isteği gönderilmişse yerelde iptal etmek sağlayıcıya aktarımı geri almaz.
- Editör ve bekleyen köprü işlemleri `Map` ile takip edilir. Kaldırılmış editörler temizlenir; kapatma sırasında gözlemci ve zamanlayıcı durdurulur, düğmeler kaldırılır.
- Gözlemci yalnız ilgili editör ekleme/kaldırmalarını işler ve keşfi birleştirir. Her DOM değişikliğinde tüm sayfayı gereksiz taramayın.

## Ayar anahtarları ve sırlar

Mevcut kurulu kullanıcıların anahtarlarını ve güncelleme yolunu koruyun:

| Değer | Anahtar | Depo |
| --- | --- | --- |
| OpenAI API anahtarı | `openai_api_key` | `chrome.storage.local` |
| Etkin sağlayıcı ve ayrı bağlantı profilleri | `ai_provider_config` (`version: 1`) | `chrome.storage.local` |
| Özel sistem promptu | `custom_system_prompt` | `chrome.storage.local` |
| Açma/kapatma | `ai_corrector_enabled` | `chrome.storage.sync` |

Anahtarı, erişim belirtecini, SAP Client ID/secret değerlerini, sağlayıcı profilini ve özel promptu Sync'e taşımayın. Yeni profil yoksa eski OpenAI anahtarını ve `gpt-4o` varsayılanını okuyun; mevcut kullanıcı kaydını silmeyin. Kanonik profil/katalog alanları `baseURL`, `authType`, `protocol`, `model` ve `apiKey` biçimindedir. IBM/SAP özel kimlik/deployment alanları aynı yerel profilde tutulur. Yeni profil varken eski anahtar etkin sağlayıcıyı ezmemeli. IAM/OAuth değişiminden dönen kısa ömürlü belirteci depolamayın veya loglamayın.

Yerel depo erişimi destekleyen Chrome sürümlerinde `TRUSTED_CONTEXTS` ile sınırlandırılır. Sırları MAIN-world köprüsüne, sayfa olaylarına, URL'lere, hata çıktılarına veya loglara taşımayın. Mevcut API host izni `https://api.openai.com/*` adresidir; diğer HTTPS ve yerel loopback adresleri manifestin **optional** izinleridir. Kullanıcı eylemiyle `getPermissionOrigins` üzerinden çözümlenmiş API ve gerekiyorsa belirteç origin'leri için izin isteyin, ağ çağrısından önce hepsini denetleyin. IBM IAM adresi sabittir; SAP OAuth adresi servis anahtarından alınır. Profil anahtarını başka origin'e yönlendirmeyin; `redirect: 'error'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'` korunur. Yeni gereksiz izin eklemeyin. HTTP/HTTPS sayfalarındaki editör algılama içerik betikleriyle yapılır; kullanılmayan `activeTab` izni geri eklenmez.

Boş anahtar kaydı seçili profilin anahtar değerini temizler; sağlayıcı değiştirmek diğer profilleri silmez. Varsayılanı yüklemek yalnız formu değiştirir; **Promptu kaydet** olmadan kayıtlı özel prompt silinmez. Boş/varsayılan promptu kaydetmek yerel özel prompt değerini kaldırır. Bağlantı testi kaydedilmiş değerleri kullanır, gerçek API çağrısıdır ve ayrıca ücret doğurabilir. Model-listesi isteği yalnız kullanıcı tıklamasıyla yapılır; model-listesi yolu uygulanmamışsa açıkça katalog sonucu döner, `/models` tahmin edilmez.

## Sağlayıcı sözleşmesi

Mevcut OpenAI varsayılanı `gpt-4o`, sıcaklığı `0.3`, endpoint `/v1/chat/completions` ve JSON modu korunur. Diğer sağlayıcılarda katalog ve modelin protokol metadata'sını esas alın: OpenAI chat/Responses, Anthropic Messages, Gemini, Cohere v2, Azure, Bedrock Converse, Vertex Gemini/Anthropic, watsonx chat ve SAP native OpenAI/Orchestration V2 toplam 12 ayrı gövde/yanıt sözleşmesidir. Modelin özel protokol/adres bilgisi genel sağlayıcı varsayılanı tarafından ezilmemeli; kimlik ailesi için yasak override'lar kabul edilmez. Azure model metadata'sı ile deployment alias'ı ayrı alanlardır.

IBM `iam` akışı anahtarı sabit IAM token adresine URL-encoded form gövdesinde gönderir; `projectId` veya `spaceId` değerlerinden yalnız biri gerekir. SAP `oauth-client-credentials` akışı `clientId`/`clientSecret` değerlerini OAuth token adresine form gövdesinde gönderir. İki akış da her işlemde yeni Bearer token alır; cache, kalıcı token veya otomatik refresh oluşturmayın. SAP'nin varsayılan `sap-orchestration-v2` yolu farklı model aileleri için `/v2/completion`, `config.modules.prompt_templating` ve `final_result` kullanır. Kullanıcı girdilerini literal şablona gömmeyin; `placeholder_values` üzerinden taşıyın. `sapMode: openai` yalnız native OpenAI deployment içindir; bilinen başka aile sessizce o yola gönderilmez. V1 Orchestration yolu eklemeyin.

Özel promptun sonuna zorunlu JSON çıktı talimatı eklenir; başarı yalnız tamamlanmış, geçerli ve boş olmayan `corrected_text` alanıyla kabul edilir. JSON modu/formatı sağlayıcının desteklediği alanlara göre gönderilir; OpenAI Responses için kaynakta yapılandırılmış çıktı desteği bulunmayan modele zorunlu format alanı gönderilmez. Bozuk, boş, reddedilmiş veya kesilmiş yanıt kullanıcı metni olarak uygulanmaz. Girdi ve çıktı sınırı 100.000 JavaScript karakteridir.

Her HTTP isteğinin zaman aşımı **25 saniye**, fetch ve gövde okumasını kapsar. IBM/SAP token isteği ile sonraki inference isteği ayrı sınır kullanır; toplam süre yaklaşık 50 saniyeye çıkabilir. API anahtarı eksik/geçersiz, kota, rate limit, kimlik doğrulama, bağlantı, zaman aşımı ve bozuk yanıt hataları sabit Türkçe mesajlarla açıklanır. Ham sağlayıcı mesajlarını veya JSON parse hata nesnelerini loglamayın. OpenAI sağlayıcısına chat ve bütün Responses istekleri `store: false` içerir; diğer chat/ailelere belgelenmemiş alan eklenmez. Bu, her servis/gateway için güvenlik kayıtlarını kapatma veya sıfır saklama garantisi değildir.

Katalogdaki 228 kayıt canlı doğrulanmış 228 bağlantı değildir. 226 Models.dev sağlayıcısı eksiksiz taşınır, iki yerel örnek eklenir; 225 kaydın protokol/kimlik yolu uygulanır. GitHub Copilot, GitLab Duo ve v0 doğrudan seçilemez. Özel abonelik OAuth/CLI, ADC ve SigV4 uygulanmış sayılmaz; IBM IAM ve SAP client-credentials bu sınırdan ayrı uygulanmış akışlardır. `selectable: false`, modelin özel akış sınırlaması ve `supportNote` korunur. Model keşfinde katalog metadata'sını kaybetmeyin. QVAC için kullanıcı tarafından başlatılmış HTTP server ve gerçek alias gerekir. Cloudflare gateway tek-token yolu saklanmış BYOK/Unified Billing içindir; request-BYOK iki anahtar akışı yerine geçmez.

Modeli yalnız daha yeni olduğu için değiştirmeyin. Değişiklik gerekiyorsa resmî belgeler, maliyet, mevcut uyumluluk ve karşılaştırmalı Türkçe kalite kanıtını birlikte kaydedin. Taklit API testlerini gerçek model kalite testi olarak sunmayın.

## Geliştirme ve test

Eklenti düz JavaScript ES2020 ve sade CSS kullanır; çalışma dosyalarında build veya modül sistemi yoktur. Node/Python araçları yalnız test ve paketleme içindir.

```sh
npm ci
npx playwright install chromium
npm run test:provider
npm run test:ui
node tests/editor-bootstrap.mjs
node tests/editor-browser.mjs
python3 -m unittest discover -s tests -p 'test_package_store.py'
python3 -m unittest discover -s tests -p 'test_provider_catalog.py'
npm run package:store
```

Gerçek editör testleri Playwright ile geçici Chrome profili kullanır; API taşıması taklit edilir, kişisel anahtar veya ücretli API çağrısı kullanılmaz. Tarayıcı fixture'ı resmî editör paketlerini geçici alana indirir; bunun çalışması gerçek üretim sitesi testi değildir. Sonuçlar ve gerçek ekran görüntüleri `output/playwright/` altında tutulur.

Değişiklik sonrası yerel eklentiyi `chrome://extensions/` üzerinden yeniden yükleyin ve test sayfasını yenileyin. Manuel kabul kontrolü `docs/testing.md` dosyasındadır. Yerel test, uzak build, canlı site, gerçek API kalitesi ve mağaza incelemesi ayrı raporlanır.

## Dosyalar ve yayın

- `popup/` ve `options/`: aç/kapa, etkin sağlayıcı/model, ayrı bağlantı profilleri ve özel prompt arayüzü.
- `lib/provider-catalog.js`: tarih/SHA-256/lisansı kayıtlı statik sağlayıcı ve model metadata'sı; canlı erişim/kalite kanıtı değildir.
- `lib/product-config.js`: mağaza, destek, gizlilik, site ve video bağlantıları. Kullanıcı verileri URL'lere eklenmez.
- `PRIVACY.md`: politikanın tek kaynağı; web kopyası hazırlık adımında üretilir.
- `tools/package-store.py`: manifest referansları ve yerel bağımlılıklarıyla dar izin listesine göre deterministik ZIP. Manifest kökte, referanslar/CRC/içerik doğrulanmış; yalnız çalışma dosyaları pakete girer.
- `TODO.md`: yetkilendirilmiş işlerin takibi.
- Web tasarımı kullanıcı tarafından Claude Design'da yaptırılacaktır. Tasarım dosyaları gelmeden site tasarlamayın/yayınlamayın; video ve mağaza görsel dili de bu teslimi bekler.

`site/`, testler, video/ses kaynakları, `.git`, `node_modules`, kullanıcı ayarları ve kullanılmayan kütüphaneler ZIP'e alınmaz. Yeni mağaza öğesi oluşturmayın; doğrulanmış mevcut kimlik korunur. İnceleme bekleyen paket “yayınlandı” diye raporlanmaz.

## Kod ve commit kuralları

4 boşluk girinti, tek tırnak, `camelCase` değişkenler, `UPPER_SNAKE_CASE` sabitler ve küçük harf/tireli dosya adları kullanın. `AGENTS.md` talimatları geçerlidir. Türkçe conventional commit biçimi: `type: açıklama (version)` (`feat`, `fix`, `chore`, `docs`).

PR açıklamasında kapsam, kullanıcı etkisi, gerçek doğrulama ve gerekli manuel adımları belirtin. Anahtar, prompt, kişisel metin veya gizli bilgiler PR'a girmez. Kaynak: https://github.com/mytsx/duzelt-ai ; destek: https://github.com/mytsx/duzelt-ai/issues.
