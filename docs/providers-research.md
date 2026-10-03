# Merkezi sağlayıcı kataloğu ve kaynak araştırması

Kaynak doğrulama tarihi: **3 Ekim 2026**. Bu çalışma OpenCode'un sağlayıcı ekosistemini, API taşıma ailelerini ve Models.dev metadata'sını inceler; gerçek sağlayıcı hesabıyla inference veya Türkçe kalite/ücret karşılaştırması yapmaz.

## Kapsam ve kaynak görüntüsü

[OpenCode'un resmî sağlayıcı belgesi](https://opencode.ai/docs/providers/) AI SDK + Models.dev kaynağını ve API anahtarı, bulut, abonelik ve yerel bağlantı düzenlerini açıklar. [V2 belgesi](https://opencode.ai/v2/docs/providers) chat/Responses/Anthropic/Gemini gibi farklı native taşıma yollarını ayırır. Eklenti terminal uygulamasını fork etmez, keychain/CLI/SDK runtime'ını tarayıcıya taşımaz ve katalogdaki npm paketlerini kurmaz/çalıştırmaz.

| Görüntü | Kayıt |
| --- | --- |
| Public kaynak | [models.dev/api.json](https://models.dev/api.json) |
| Alınma tarihi | 2026-10-03 |
| Ham JSON SHA-256 | `fc09da34f9fb8e13c77bde9d57fb723b99c5215855ec631592beff74f7ef9295` |
| Ham JSON boyutu | 5.311.761 bayt |
| Models.dev depo revision | `036a4f1d6ee01a0ed3f156077375a15087dd322f` |
| OpenCode depo revision | `907b3bc518fa48e90e8ec24dd327d13eee71c36c` |
| Veri lisansı | [Models.dev MIT](https://github.com/anomalyco/models.dev/blob/036a4f1d6ee01a0ed3f156077375a15087dd322f/LICENSE) |
| OpenCode referans lisansı | [MIT](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/LICENSE) |

API gövdesi ayrı bir anlık görüntüdür; public API'nin bu depo revision'ıyla birebir aynı yayın olduğunu iddia etmiyoruz. Ham kaynak ve okunan lisans/kod kanıtları yerel `output/provider-research/` alanındadır; bu önbellek çalışma paketine girmez. Üretilen JS, kaynak tarihi/hash/revision bilgisini ve veri lisansının tam metnini içerir. OpenCode'dan çalışma kodu kopyalanmadı. [Pinned provider kaynağı](https://github.com/anomalyco/opencode/blob/907b3bc518fa48e90e8ec24dd327d13eee71c36c/packages/opencode/src/provider/provider.ts), npm transport adı ile gerçek API/kimlik akışının aynı şey olmadığını gösterir.

| Sayı | Anlamı |
| --- | --- |
| **226** | Ham kaynaktaki bütün sağlayıcılar; hiçbir sağlayıcı kaydı sessizce çıkarılmadı. |
| **228** | Paketlenmiş katalog: 226 kaynak kaydı + belgelenen Ollama/llama.cpp yerel örnekleri. |
| **8.385** | Ham kaynaktaki model kayıtları. |
| **8.025** | Metin girdisi/çıktısı taşıyan ve embedding/rerank/moderation filtresini geçen metadata kayıtları. |
| **7.804** | Seçilebilir sağlayıcılarda, özel akış elemesinden sonra kalan model adayları. Bu sayı uyumluluk/erişim/kalite garantisi değildir. |
| **225** | Uygulanan protokol ve kimlik yöntemiyle profil oluşturulabilen sağlayıcı kaydı; canlı hesap testi değildir. |
| **3** | Özel kimlik/transport sınırı nedeniyle görünür, doğrudan seçilemeyen sağlayıcı. |

251 kayıt metin girdisi/çıktısı sağlamadığı için, 109 kayıt embedding/rerank/moderation sınıfında olduğu için paketlenmiş model listesinden çıkarıldı. Kalan listede 154 görsel/ses/gerçek zamanlı, araştırma/arama/bilgisayar araç akışı kaydı `selectable: false` ile tutulur; düzeltme adayı değildir. Kaynakta beta/deprecated durumu varsa korunur. Diğer kayıtların destek durumunun güncel ve eksiksiz olduğu, katalog adlarının gerçek hesap model/deployment adıyla birebir aynı olduğu veya bütün modellerin JSON üretebildiği varsayılmaz.

Model varsayılanı **OpenAI / gpt-4o** olarak korunur. Diğer servislerde tek bir modelin maliyet/kalite üstünlüğü doğrulanmadığı için yeni zorunlu varsayılan eklenmez. Yerel bağlantılarda model sunucudan alınabilir veya gerçek model/alias adı elle girilebilir. QVAC model değeri sunucunun `serve.models` alias'ıdır.

## Protokol aileleri

Katalog, bütün standart kayıtları aşağıdaki HTTP ailelerine ayırır. Sağlayıcının model metadata'sı gerekirse protokol/adresi değiştirir; örneğin Vertex'te Gemini ve Anthropic ile MaaS OpenAI yolu farklıdır. Azure'da seçilen model ailesi korunur, `deploymentName` gerekiyorsa ayrı girilir. `protocol`/`authType`/`baseURL` profil ve katalogda aynı alan adlarını kullanır.

| Protokol | Sağlayıcı kaydı | Çalışma şekli |
| --- | ---: | --- |
| `openai-chat` | 203 | `/chat/completions`; ilgili servisin API/Bearer başlığı. |
| `openai-responses` | 6 | `/responses`; model bazlı OpenAI/Mantle override'ları ayrıca bu yolu kullanır. |
| `anthropic-messages` | 8 | `/messages`; API key/Bearer ve uygun Anthropic sürüm başlığı. |
| `azure-openai` | 2 | Azure `/openai/v1`; resource/deployment ve farklı model aileleri ayrı çözülür. |
| `bedrock-converse` | 1 | Native `/model/{modelId}/converse`; Bedrock Bearer anahtarı. |
| `gemini` | 1 | `models/{id}:generateContent`; Google API key. |
| `cohere-v2` | 1 | `/v2/chat`; Cohere Bearer. |
| `vertex-gemini` | 1 | Proje/konum/publisher/model yolu, manuel süreli Cloud Bearer token. |
| `vertex-anthropic` | 1 | Proje/konum/publisher/model `rawPredict`, manuel Cloud Bearer token. |
| `watsonx-chat` | 1 | IBM IAM anahtar değişimi; native `/ml/v1/text/chat`, proje veya alan kimliği. |
| `sap-orchestration-v2` | 1 | Client-credentials OAuth; deployment `/v2/completion`, farklı model aileleri için harmonize gövde. |
| `sap-openai-chat` | 0 | SAP profilindeki isteğe bağlı OpenAI deployment yolu; provider varsayılanı Orchestration V2 kalır. |
| `unsupported` | 2 | Özel SDK/kimlik adaptörü yerine sessizce generic istek gönderilmez. |

GitHub Copilot kaynakta OpenAI uyumlu npm olarak kayıtlı olsa da OAuth/runtime sınırlaması nedeniyle seçilemez; bu yüzden `unsupported` protokol sayısı ile seçilemeyen sağlayıcı sayısı farklıdır. OpenAI/gpt-4o legacy chat yolunu korur; Responses gerektiren Pro/Codex model kayıtları model bazında ayrı işaretlenir. [OpenAI GPT-5.4 Pro](https://developers.openai.com/api/docs/models/gpt-5.4-pro) ve [o3-pro](https://developers.openai.com/api/docs/models/o3-pro) belgelerindeki Responses/uzun düşünme sınırı dikkate alınır; 25 saniyeyi aşan inference bu eklentide zaman aşımına uğrayabilir.

Native SDK default URL'si her zaman seçilen REST protokolünün kökü değildir. Örneğin Vercel'in [OpenAI chat REST belgesi](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/rest-api) `/v1` yolunu verir; SDK'nın `/v4/ai` yolu kullanılmaz. [DeepInfra](https://ai-sdk.dev/providers/ai-sdk-providers/deepinfra) için dil modeli yolu `/v1/openai`, [Cohere](https://ai-sdk.dev/providers/ai-sdk-providers/cohere) için `/v2`, [Venice](https://docs.venice.ai/overview/about-venice) için `/api/v1`, [Merge Gateway](https://docs.merge.dev/merge-gateway/get-started) için açık OpenAI yüzeyi `/v1/openai` kullanılır. Genel Merge native Responses olay biçimiyle OpenAI yüzeyi birleştirilmez.

## Bulut, yerel servisler ve özel kimlik sınırları

- **Cloudflare Workers AI:** hesap kimliği içeren resmî `/accounts/{accountId}/ai/v1` OpenAI chat yolu; model `@cf/...` adıyla seçilir. [Resmî uyumluluk belgesi](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/).
- **Cloudflare AI Gateway:** belgelenen legacy `gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/compat` yüzeyi ve `cf-aig-authorization` kullanılır. Bu profil, gateway'de saklanmış BYOK veya Unified Billing içindir; ayrı upstream anahtarının istekle gönderildiği iki-token BYOK uygulanmadı. Gateway'in bütün model aileleri compat chat'e gönderilir; native Anthropic/Responses npm override'ları kullanılmaz. Cloudflare yeni REST için hesap AI/v1 yolunu önerir; legacy compat mevcut entegrasyonlarda belgelenmiştir. [Unified API](https://developers.cloudflare.com/ai-gateway/usage/chat-completion/), [kimlik doğrulama](https://developers.cloudflare.com/ai-gateway/configuration/authentication/).
- **Bedrock:** gerçek Bedrock Bearer API key gerekir; IAM access key/secret, AWS profil/SSO zinciri veya SigV4 uygulanmış sayılmaz. Native kayıtlar Converse, kaynakta Mantle olarak ayrılan 16 model kaydı `/v1/responses` kullanır. Runtime'da OpenAI `/models` yoktur; Mantle'da vardır ve model metadata'sında açıkça işaretlenir. Bölge ve endpoint için model erişimi ayrıca gerekir. [API key](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html), [Responses](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-responses-api.html).
- **Azure / Vertex:** gerekli kaynak/proje/konum bilgileri kullanıcıdan alınır. Azure model ID'si deployment adı değilse ayrı alan kullanılır. Eski Azure `.services.ai.azure.com/models` kaydı [resmî migration](https://learn.microsoft.com/en-us/azure/foundry/how-to/model-inference-to-openai-migration) kapsamında `/openai/v1` yüzeyine normalize edilir; Anthropic endpoint'i ayrı kalır. Vertex manuel Bearer token kullanır; ADC, servis hesabı veya otomatik OAuth yenilemesi yapılmaz.
- **Snowflake Cortex:** hesap URL'sindeki `/api/v2/cortex/v1` chat ve PAT/JWT/OAuth Bearer yolu kullanılır. Tarayıcı SSO/token yenilemesi eklenmiş sayılmaz. [Cortex REST](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api).
- **IBM watsonx:** IBM Cloud API anahtarı sabit IAM token adresine URL-encoded form gövdesinde gönderilir. Dönen Bearer token, bölgesel `/ml/v1/text/chat?version=2024-10-08` isteğinde kullanılır; `projectId` veya `spaceId` değerlerinden yalnız biri girilir. Token her işlemde yeniden alınır, kalıcı depoya/cache'e yazılmaz. [IBM chat API](https://cloud.ibm.com/apidocs/watsonx-ai#text-chat), [IAM API](https://cloud.ibm.com/apidocs/iam-identity-token-api).
- **SAP AI Core:** servis anahtarının Client ID/secret değerleri kullanıcının girdiği OAuth token adresine form gövdesinde gönderilir. API ve token origin'leri için Chrome izni gerekir. Varsayılan Orchestration V2 farklı model ailelerini aynı deployment `/v2/completion` yolunda `config.modules.prompt_templating` ile tüketir; kullanıcı metni/promptu `placeholder_values`, sonuç `final_result` üzerinden taşınır. Native OpenAI deployment yolu profil seçeneğidir; bilinen başka model ailesi bu yola gönderilmez. Model erişimi, deployment ve resource group hesabınıza bağlıdır. [V2 minimal call](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/minimal-call-663f1b7795bf4472a436e4b865321498), [harmonize API](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/consume-models-with-harmonized-api?source=text-sapcommunity-prdteng-AI-LSC). V1 31 Ekim 2026'da kullanımdan kalkacağı için uygulanmaz. [V1 deprecation](https://help.sap.com/docs/sap-ai-core/generative-ai/orchestration-workflow-v1-deprecated?locale=tr-TR).
- **AIHubMix / SaladCloud:** özel SDK yerine doğrulanan chat REST yüzeyleri seçilir. AIHubMix `https://aihubmix.com/v1`; Salad `https://ai.salad.cloud/v1` ve organizasyona ait AI Gateway key kullanır. Salad account API key/`Salad-Api-Key` bu anahtarın yerine geçmez. [AIHubMix Quick Start](https://docs.aihubmix.com/en/quick-start), [SaladCloud API](https://docs.salad.com/ai-gateway/explanation/overview).
- **Yerel servisler:** Ollama, llama.cpp ve kaynakta bulunan LMStudio/Atomic Chat/Lynkr/Privatemode/QVAC bağlantıları çalışan servis gerektirir. QVAC kullanıcı tarafından `--openai` ile başlatılır, model değeri `serve.models` alias'ıdır; eklenti QVAC CLI/plugin/server'ını başlatmaz. [QVAC HTTP belgesi](https://docs.qvac.tether.io/cli/http-server/), [OpenCode yerel örnekleri](https://opencode.ai/docs/providers/).

| Seçilemeyen kayıt | Neden |
| --- | --- |
| `github-copilot` | Copilot SDK yerel CLI/runtime bağlantısı ve ürüne ait abonelik giriş/kimlik akışı gerektirir; tarayıcıda doğrulanmış adaptör yoktur. SDK'nın farklı giriş yöntemleri sıradan generic API anahtarı entegrasyonunu kanıtlamaz. GitHub Models ayrı üründür. [Copilot SDK mimarisi](https://github.com/github/copilot-sdk). |
| `gitlab` | Chat REST API vardır; GitLab.com'da internal-only, Self-Managed'da `access_rest_chat` ve belgelenen ekip önkoşuluyla kısıtlıdır. Genel kullanıma açık doğrulanmış Duo adaptörü yoktur; Agent Platform ayrıca iş akışı/kimlik zinciri gerektirir. [Chat REST API](https://docs.gitlab.com/api/chat/), [Agent Platform kimliği](https://docs.gitlab.com/user/duo_agent_platform/authentication/). |
| `v0` | Güncel API uygulama/Sandbox iş akışı kullanır; bu eklentinin tek metin düzeltme sözleşmesi için doğrulanmış adaptör yoktur. Eski Model API belgesi [Platform API](https://v0.app/docs/api/v1) sayfasına yönlenir. [Yeni v0 API](https://vercel.com/blog/introducing-the-new-v0-api). |

Ayrıntılı bulut/kimlik kaynakları [provider-edge-notes.md](provider-edge-notes.md) dosyasındadır. Yeni adaptör, resmî HTTP/kimlik sözleşmesi ve fixture testleri tamamlanmadan bu kayıtların durumunu aktif yapmayın.

## Ollama ve llama.cpp bağlantısı

Ayarlar ekranında Ollama ve llama.cpp kartları görünür; yerel sunucu adresi açık, anahtar alanı gizlidir. Varsayılan adresler Ollama için `http://127.0.0.1:11434/v1`, llama.cpp için `http://127.0.0.1:8080/v1` değerleridir. Sağlayıcı araması açılan seçim listesinin içindedir.

Kullanıcı Ollama kartını veya seçeneğini seçtiğinde arayüz Chrome bağlantı iznini ister ve izin verilirse model listesini otomatik getirir. Ayarlar ilk açıldığında ise yalnız önceden verilmiş izinle otomatik keşif yapılır; izin yoksa **Modelleri getir** düğmesi kullanılır. Sunucu adresini model bilmeden girmek mümkündür; taslak keşif önce kaydetmeyi gerektirmez. Kullanıcı modeli seçip **Kaydet** dediğinde bağlantı etkinleşir. Bu sırada önceki etkin sağlayıcı ve diğer profiller korunur. Boş modelle adres kaydetme ve daha sonra model seçip tekrar kaydetme de desteklenir.

Keşif, yalnız aynı eklentinin ayarlar sayfasından `action`, `providerId`, `baseURL` alanlarıyla çağrılır. Katalog kaydı yerel ve anahtarsız olmalı; adres localhost/loopback HTTP veya HTTPS olmalı ve origin izni verilmiş olmalıdır. İşlem anahtar/prompt/kayıtlı profil okumaz, depoya yazmaz ve etkin sağlayıcıyı değiştirmez. Ollama [native `GET /api/tags`](https://docs.ollama.com/api/tags) kullanır; yalnız son `/v1` eki kaldırılır, varsa proxy kökü korunur. llama.cpp uyumlu `/v1/models` yolunu kullanır.

Ollama liste yanıtında `capabilities` verilirse `completion` veya `chat` içermeyen kayıtlar önerilerden çıkarılır; embedding-only kayıtlar bu durumda elenir. Bu alanın bulunmadığı kayıtlar korunur: native liste, her modelin yetenek bilgisini zorunlu olarak sağlamaz. Model etiketi `:` ve `/` içerebilir; kullanıcı sunucudaki tam adı seçer veya yazar.

Ollama düzeltmesi [OpenAI uyumlu chat API](https://docs.ollama.com/api/openai-compatibility) üzerinden, `temperature: 0.2` ile gönderilir. Loopback adresindeki `:cloud` olmayan model için `corrected_text` string alanını zorunlu tutan JSON Schema istenir; cloud/uzak bağlantıda JSON object biçimi kullanılır. Sonuç yine eklentinin doğrulayıcısından geçer. Bu ayar llama.cpp'ye zorunlu sıcaklık veya JSON Schema desteği eklemez.

Arayüz `ollama serve`, `ollama list` ve isteğe bağlı `ollama pull <model-adı>` komutlarını gösterir. Origin komutu o kurulumun `chrome.runtime.id` değerinden hazırlanır: `OLLAMA_ORIGINS="chrome-extension://EKLENTI_KIMLIGI" ollama serve`. Chrome host izni ile Ollama'nın origin izni ayrı ayarlardır; çalışan sunucu yeni ortam ayarıyla yeniden başlatılmalıdır. [Ollama CLI](https://docs.ollama.com/cli), [origin ayarı](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama). Eklenti sunucuyu başlatmaz veya komutları kendiliğinden çalıştırmaz.

## Yerel hazırlık ve test

Çalışma sürümü public metadata'yı kendi başına yenilemez. Normal kullanımda `lib/provider-catalog.js` okunur; bulut model keşfi kullanıcı tıklamasıyla, kaydedilmiş API origin'ine verilen optional Chrome izni sonrası servis işçisinden çalışır. Yerel sağlayıcı seçimi, izin verilmiş taslak loopback adresinde otomatik keşfi başlatabilir. IBM/SAP profili belirteç origin'ini de izin listesine ekler; model-listesi yolu uygulanmadığında katalog döner ve kimlik ağı çalışmaz. API anahtarı, SAP client secret, özel prompt ve sağlayıcı profili local; açma/kapatma sync'tir. Anahtar URL/MAIN-world olay/log içine konmaz. SDK'nızın/npm kaydınızın varlığı tarayıcıda çalıştırma yetkisi değildir.

Elde tutulan kaynakla aynı katalog üretimi/doğrulaması:

```sh
python3 tools/update-provider-catalog.py --source-date 2026-10-03 --expected-sha256 fc09da34f9fb8e13c77bde9d57fb723b99c5215855ec631592beff74f7ef9295 --check
python3 -m unittest discover -s tests -p 'test_provider_catalog.py'
```

Güncellemek için geliştirici `--download --source-date YYYY-MM-DD` komutunu açıkça çalıştırır; yalnız `https://models.dev/api.json` public metadata'sı alınır. Yeni SHA/tarih/depo referansı, diff ve fixture sonuçları gözden geçirilir. `--source` başka bir arşivlenmiş yerel JSON'u kullanabilir. `--check` ağ kullanmaz/dosya değiştirmez; `--expected-sha256` uyuşmazsa çıktı üretmez. Kaynak tarihi/JSON aynıysa JS sıralaması ve içeriği aynı olur. API'nin canlı yeni gövdesi eski SHA ile eşleşmek zorunda değildir; eski kaynak olmadan eski snapshot'ın yeniden indirilebildiği iddia edilmez. Üretilmiş katalog ve tam MIT bildirimi normal eklenti ZIP'ine girer; ham JSON, araştırma/cache/test dosyaları girmez.

Kalıcı `tests/test_provider_catalog.py` **30 regresyon testi** içerir ve public kaynak, gerçek anahtar veya ücretli API olmadan çalışır. Kaynak kimliği/provenance/lisans, model eleme, özel kimlik sınırı, URL/template/alan doğrulaması, Azure/Mantle/CF/QVAC/IBM/SAP sınırları, deterministik/hash kontrollü hazırlık ve paket bağımlılıkları doğrulanır. Merkezi arka plan testleri ayrıca protokol aileleri için istek/yanıt ve bütün seçilebilir model adaylarının URL/gövde oluşturmasını denetler. Test sayıları ve canlı kanıt ayrımı [testing.md](testing.md) dosyasındadır.

## Kaynak npm transport dökümü

Aşağıdaki 28 farklı npm adı kaynak metadata'sıdır. Paketler eklentiye kurulmaz veya çalışma zamanı bağımlılığı olarak eklenmez. Bir REST adaptörü belgelendiğinde özel paket adına rağmen ilgili HTTP ailesi kullanılabilir; kimlik akışı belirsizse kayıt kapalı kalır.

| Kaynak npm adı | Sağlayıcı sayısı | Katalogdaki HTTP karşılığı |
| --- | ---: | --- |
| `@ai-sdk/amazon-bedrock` | 1 | `bedrock-converse` |
| `@ai-sdk/anthropic` | 8 | `anthropic-messages` |
| `@ai-sdk/azure` | 2 | `azure-openai` |
| `@ai-sdk/cerebras` | 1 | `openai-chat` |
| `@ai-sdk/cohere` | 1 | `cohere-v2` |
| `@ai-sdk/deepinfra` | 1 | `openai-chat` |
| `@ai-sdk/gateway` | 1 | `openai-chat` |
| `@ai-sdk/google` | 1 | `gemini` |
| `@ai-sdk/google-vertex` | 1 | `vertex-gemini` |
| `@ai-sdk/google-vertex/anthropic` | 1 | `vertex-anthropic` |
| `@ai-sdk/groq` | 1 | `openai-chat` |
| `@ai-sdk/mistral` | 1 | `openai-chat` |
| `@ai-sdk/openai` | 6 | `openai-responses` |
| `@ai-sdk/openai-compatible` | 185 | `openai-chat` |
| `@ai-sdk/perplexity` | 1 | `openai-chat` |
| `@ai-sdk/togetherai` | 1 | `openai-chat` |
| `@ai-sdk/vercel` | 1 | `unsupported` |
| `@ai-sdk/xai` | 1 | `openai-responses` |
| `@aihubmix/ai-sdk-provider` | 1 | `openai-chat (belgelenen REST yüzeyi)` |
| `@jerome-benoit/sap-ai-provider-v2` | 1 | `sap-orchestration-v2` |
| `@openrouter/ai-sdk-provider` | 2 | `openai-chat` |
| `@qvac/ai-sdk-provider` | 1 | `openai-chat (belgelenen REST yüzeyi)` |
| `@saladtechnologies-oss/ai-sdk-provider` | 1 | `openai-chat (belgelenen REST yüzeyi)` |
| `ai-gateway-provider` | 1 | `openai-chat (belgelenen REST yüzeyi)` |
| `gitlab-ai-provider` | 1 | `unsupported` |
| `merge-gateway-ai-sdk-provider` | 1 | `openai-chat` |
| `venice-ai-sdk-provider` | 1 | `openai-chat` |
| `watsonx-ai-provider` | 1 | `watsonx-chat` |

## Bütün sağlayıcı kayıtları

Bu tablo 3 Ekim 2026 görüntüsünün tamamını listeler. **Protokol** durumu HTTP adaptörü/profil yolunun uygulanmasını ifade eder; **katalog** durumu görünür ama doğrudan seçilemez. Buradaki model sayısı metin içeren metadata kayıtlarıdır, çalıştığı doğrulanan model sayısı değildir. Endpoint şablonları kullanıcı alanlarıyla çözülür; boş adres ve özel kimlik gerekçeleri üstte açıklanır. Belge bağlantıları kaynak metadata'daki adreslerdir; her sağlayıcının canlı hesabı/endpoint'i ayrıca sınanmadı.

| Kimlik | Ad | Protokol | Kimlik yöntemi | Durum | Model kaydı | Temel API adresi |
| --- | --- | --- | --- | --- | ---: | --- |
| `302ai` | [302.AI](https://doc.302.ai) | `openai-chat` | `api-key` | protokol | 122 | `https://api.302.ai/v1` |
| `abacus` | [Abacus](https://abacus.ai/help/api) | `openai-chat` | `api-key` | protokol | 108 | `https://routellm.abacus.ai/v1` |
| `abliteration-ai` | [abliteration.ai](https://docs.abliteration.ai/models) | `openai-chat` | `api-key` | protokol | 3 | `https://api.abliteration.ai/v1` |
| `above` | [above.dev](https://above.dev/docs) | `openai-chat` | `api-key` | protokol | 10 | `https://api.above.dev/v1` |
| `agentrouter` | [AgentRouter](https://agentrouter.org/docs/opencode.html) | `openai-chat` | `api-key` | protokol | 5 | `https://agentrouter.org/v1` |
| `agnes` | [Agnes AI](https://agnes-ai.com/doc) | `openai-chat` | `api-key` | protokol | 3 | `https://apihub.agnes-ai.com/v1` |
| `ai-router` | [AI-ROUTER](https://ai-router.dev/openai-compatible-api-gateway/) | `openai-chat` | `api-key` | protokol | 5 | `https://api.ai-router.dev/v1` |
| `ai21` | [AI21 Labs](https://docs.ai21.com/docs/jamba-foundation-models) | `openai-chat` | `api-key` | protokol | 2 | `https://api.ai21.com/studio/v1` |
| `aiand` | [ai&](https://docs.aiand.com/) | `openai-chat` | `api-key` | protokol | 13 | `https://api.aiand.com/v1` |
| `aihubmix` | [AIHubMix](https://docs.aihubmix.com) | `openai-chat` | `api-key` | protokol | 134 | `https://aihubmix.com/v1` |
| `ainetcafe` | [ainetcafe](https://ainetcafe.com/k3/guides/) | `openai-chat` | `api-key` | protokol | 1 | `https://microquickjs.com/v1` |
| `aixy` | [Aixy](https://docs.aixy-gateway.com/integrations/overview) | `openai-chat` | `api-key` | protokol | 1 | `https://api.aixy-gateway.com/v1` |
| `aki-io` | [AKI.IO](https://aki.io/docs/) | `openai-chat` | `api-key` | protokol | 7 | `https://aki.io/v1` |
| `alibaba` | [Alibaba](https://www.alibabacloud.com/help/en/model-studio/models) | `openai-chat` | `api-key` | protokol | 58 | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| `alibaba-cn` | [Alibaba (China)](https://www.alibabacloud.com/help/en/model-studio/models) | `openai-chat` | `api-key` | protokol | 90 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `alibaba-coding-plan` | [Alibaba Coding Plan](https://www.alibabacloud.com/help/en/model-studio/coding-plan) | `openai-chat` | `api-key` | protokol | 10 | `https://coding-intl.dashscope.aliyuncs.com/v1` |
| `alibaba-coding-plan-cn` | [Alibaba Coding Plan (China)](https://help.aliyun.com/zh/model-studio/coding-plan) | `openai-chat` | `api-key` | protokol | 10 | `https://coding.dashscope.aliyuncs.com/v1` |
| `alibaba-token-plan` | [Alibaba Token Plan](https://www.alibabacloud.com/help/en/model-studio/token-plan-overview) | `openai-chat` | `api-key` | protokol | 21 | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` |
| `alibaba-token-plan-cn` | [Alibaba Token Plan (China)](https://www.alibabacloud.com/help/zh/model-studio/token-plan-overview) | `openai-chat` | `api-key` | protokol | 21 | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |
| `amazon-bedrock` | [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) | `bedrock-converse` | `bearer` | protokol | 187 | `https://bedrock-runtime.{region}.amazonaws.com` |
| `ambient` | [Ambient](https://ambient.xyz) | `openai-chat` | `api-key` | protokol | 12 | `https://api.ambient.xyz/v1` |
| `amd` | [AMD](https://developer.amd.com.cn/radeon/tokenfactory) | `openai-chat` | `api-key` | protokol | 6 | `https://developer.amd.com.cn/radeon/api/v1` |
| `anthropic` | [Anthropic](https://docs.anthropic.com/en/docs/about-claude/models) | `anthropic-messages` | `api-key` | protokol | 16 | `https://api.anthropic.com/v1` |
| `anyapi` | [AnyAPI](https://docs.anyapi.ai) | `openai-chat` | `api-key` | protokol | 30 | `https://api.anyapi.ai/v1` |
| `arcee` | [Arcee](https://docs.arcee.ai) | `openai-chat` | `api-key` | protokol | 7 | `https://api.arcee.ai/api/v1` |
| `atomic-chat` | [Atomic Chat](https://atomic.chat) | `openai-chat` | `none` | protokol | 5 | `http://127.0.0.1:1337/v1` |
| `auriko` | [Auriko](https://docs.auriko.ai) | `openai-chat` | `api-key` | protokol | 15 | `https://api.auriko.ai/v1` |
| `azure` | [Azure](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models) | `azure-openai` | `api-key` | protokol | 84 | `https://{resourceName}.openai.azure.com/openai/v1` |
| `azure-cognitive-services` | [Azure Cognitive Services](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models) | `azure-openai` | `api-key` | protokol | 76 | `https://{resourceName}.cognitiveservices.azure.com/openai/v1` |
| `bailing` | [Bailing](https://alipaytbox.yuque.com/sxs0ba/ling/intro) | `openai-chat` | `api-key` | protokol | 2 | `https://api.tbox.cn/api/llm/v1` |
| `baseten` | [Baseten](https://docs.baseten.co/inference/model-apis/overview) | `openai-chat` | `api-key` | protokol | 24 | `https://inference.baseten.co/v1` |
| `bee` | [Bee by HEOSSI](https://bee.heossi.com/docs/sdks) | `openai-chat` | `api-key` | protokol | 6 | `https://api.bee.heossi.com/bee` |
| `berget` | [Berget.AI](https://api.berget.ai) | `openai-chat` | `api-key` | protokol | 6 | `https://api.berget.ai/v1` |
| `blueclaw` | [Blue Claw](https://blueclaw.network) | `openai-chat` | `api-key` | protokol | 2 | `https://openai.blueclaw.network/v1` |
| `bothub` | [Bothub](https://bothub.ru/models) | `openai-chat` | `api-key` | protokol | 8 | `https://openai.bothub.ru/v1` |
| `cerebras` | [Cerebras](https://inference-docs.cerebras.ai/models/overview) | `openai-chat` | `api-key` | protokol | 2 | `https://api.cerebras.ai/v1` |
| `chutes` | [Chutes](https://llm.chutes.ai/v1/models) | `openai-chat` | `api-key` | protokol | 14 | `https://llm.chutes.ai/v1` |
| `clarifai` | [Clarifai](https://docs.clarifai.com/compute/inference/) | `openai-chat` | `api-key` | protokol | 12 | `https://api.clarifai.com/v2/ext/openai/v1` |
| `claudinio` | [Claudinio](https://claudin.io) | `openai-chat` | `api-key` | protokol | 2 | `https://api.claudin.io/v1` |
| `cline-pass` | [ClinePass](https://docs.cline.bot/getting-started/clinepass) | `openai-chat` | `api-key` | protokol | 18 | `https://api.cline.bot/api/v1` |
| `cloudferro-sherlock` | [CloudFerro Sherlock](https://docs.sherlock.cloudferro.com/) | `openai-chat` | `api-key` | protokol | 5 | `https://api-sherlock.cloudferro.com/openai/v1` |
| `cloudflare-ai-gateway` | [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) | `openai-chat` | `api-key` | protokol | 50 | `https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/compat` |
| `cloudflare-workers-ai` | [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/models/) | `openai-chat` | `api-key` | protokol | 26 | `https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1` |
| `cohere` | [Cohere](https://docs.cohere.com/docs/models) | `cohere-v2` | `api-key` | protokol | 17 | `https://api.cohere.com/v2` |
| `coralbricks` | [CoralBricks](https://www.coralbricks.ai/docs) | `openai-chat` | `api-key` | protokol | 3 | `https://inference.coralbricks.ai/v1` |
| `cortecs` | [Cortecs](https://api.cortecs.ai/v1/models) | `openai-chat` | `api-key` | protokol | 108 | `https://api.cortecs.ai/v1` |
| `crof` | [CrofAI](https://crof.ai/docs) | `openai-chat` | `api-key` | protokol | 24 | `https://crof.ai/v1` |
| `crossmodel` | [CrossModel](https://www.crossmodel.ai/docs) | `openai-chat` | `api-key` | protokol | 68 | `https://api.crossmodel.ai/v1` |
| `crusoe` | [Crusoe](https://docs.crusoecloud.com/managed-inference/overview) | `openai-chat` | `api-key` | protokol | 11 | `https://api.inference.crusoecloud.com/v1` |
| `daoxe` | [DaoXE](https://daoxe.com/pricing) | `openai-chat` | `api-key` | protokol | 9 | `https://daoxe.com/v1` |
| `databricks` | [Databricks](https://docs.databricks.com/aws/en/machine-learning/foundation-models/) | `openai-chat` | `api-key` | protokol | 30 | `https://{host}/ai-gateway/mlflow/v1` |
| `deepinfra` | [Deep Infra](https://deepinfra.com/models) | `openai-chat` | `api-key` | protokol | 71 | `https://api.deepinfra.com/v1/openai` |
| `deepseek` | [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing) | `openai-chat` | `api-key` | protokol | 4 | `https://api.deepseek.com` |
| `digitalocean` | [DigitalOcean](https://docs.digitalocean.com/products/gradient-ai-platform/details/models/) | `openai-chat` | `api-key` | protokol | 89 | `https://inference.do-ai.run/v1` |
| `dinference` | [DInference](https://dinference.com) | `openai-chat` | `api-key` | protokol | 6 | `https://api.dinference.com/v1` |
| `drun` | [D.Run (China)](https://www.d.run) | `openai-chat` | `api-key` | protokol | 3 | `https://chat.d.run/v1` |
| `ebcloud` | [EBCloud](https://docs.ebtech.com/ai/model-api.html) | `openai-chat` | `api-key` | protokol | 4 | `https://maas-api.ebcloud.com/v1` |
| `echo` | [Echo](https://echo.tracerml.ai/docs/api) | `openai-chat` | `api-key` | protokol | 1 | `https://echo.tracerml.ai/v1` |
| `edenai` | [Eden AI](https://docs.edenai.co) | `openai-chat` | `api-key` | protokol | 285 | `https://api.edenai.run/v3` |
| `empiriolabs` | [EmpirioLabs AI](https://docs.empiriolabs.ai) | `openai-chat` | `api-key` | protokol | 66 | `https://api.empiriolabs.ai/v1` |
| `engy` | [engy](https://engy.ai/pricing) | `openai-chat` | `api-key` | protokol | 8 | `https://api.engy.ai/v1` |
| `evroc` | [evroc](https://docs.evroc.com/products/think/overview.html) | `openai-chat` | `api-key` | protokol | 10 | `https://models.think.evroc.com/v1` |
| `fastrouter` | [FastRouter](https://fastrouter.ai/models) | `openai-chat` | `api-key` | protokol | 37 | `https://go.fastrouter.ai/api/v1` |
| `fireworks-ai` | [Fireworks AI](https://fireworks.ai/docs/) | `openai-chat` | `api-key` | protokol | 22 | `https://api.fireworks.ai/inference/v1` |
| `freemodel` | [FreeModel](https://freemodel.dev) | `anthropic-messages` | `api-key` | protokol | 10 | `https://cc.freemodel.dev/v1` |
| `friendli` | [Friendli](https://friendli.ai/docs/guides/serverless_endpoints/introduction) | `openai-chat` | `api-key` | protokol | 7 | `https://api.friendli.ai/serverless/v1` |
| `frogbot` | [FrogBot](https://docs.frogbot.ai) | `openai-chat` | `api-key` | protokol | 26 | `https://app.frogbot.ai/api/v1` |
| `github-copilot` | [GitHub Copilot](https://docs.github.com/en/copilot) | `openai-chat` | `oauth` | katalog | 34 | `https://api.githubcopilot.com` |
| `gitlab` | [GitLab Duo](https://docs.gitlab.com/user/duo_agent_platform/) | `unsupported` | `oauth` | katalog | 30 | — |
| `gmicloud` | [GMI Cloud](https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference) | `openai-chat` | `api-key` | protokol | 17 | `https://api.gmi-serving.com/v1` |
| `google` | [Google](https://ai.google.dev/gemini-api/docs/models) | `gemini` | `api-key` | protokol | 29 | `https://generativelanguage.googleapis.com/v1beta` |
| `google-vertex` | [Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/models) | `vertex-gemini` | `bearer` | protokol | 51 | `https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google` |
| `google-vertex-anthropic` | [Vertex (Anthropic)](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude) | `vertex-anthropic` | `bearer` | protokol | 16 | `https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/anthropic` |
| `greenpt` | [GreenPT](https://docs.greenpt.ai) | `openai-chat` | `api-key` | protokol | 38 | `https://api.greenpt.ai/v1` |
| `groq` | [Groq](https://console.groq.com/docs/models) | `openai-chat` | `api-key` | protokol | 9 | `https://api.groq.com/openai/v1` |
| `helicone` | [Helicone](https://helicone.ai/models) | `openai-chat` | `api-key` | protokol | 87 | `https://ai-gateway.helicone.ai/v1` |
| `hetzner` | [Hetzner](https://experiments.hetzner.com/docs/inference) | `openai-chat` | `api-key` | protokol | 2 | `https://inference.hetzner.com/api/v1` |
| `hpc-ai` | [HPC-AI](https://www.hpc-ai.com/doc/docs/quickstart/) | `openai-chat` | `api-key` | protokol | 9 | `https://api.hpc-ai.com/inference/v1` |
| `huggingface` | [Hugging Face](https://huggingface.co/docs/inference-providers) | `openai-chat` | `api-key` | protokol | 76 | `https://router.huggingface.co/v1` |
| `hyper` | [Charm Hyper](https://hyper.charm.land) | `openai-chat` | `api-key` | protokol | 23 | `https://hyper.charm.land/v1` |
| `iflowcn` | [iFlow](https://platform.iflow.cn/en/docs) | `openai-chat` | `api-key` | protokol | 14 | `https://apis.iflow.cn/v1` |
| `impossibl` | [Impossibl](https://impossibl.com/docs/models) | `openai-chat` | `api-key` | protokol | 76 | `https://api.impossibl.com/v1` |
| `inception` | [Inception](https://docs.inceptionlabs.ai/get-started/models) | `openai-chat` | `api-key` | protokol | 3 | `https://api.inceptionlabs.ai/v1` |
| `inceptron` | [Inceptron](https://docs.inceptron.io) | `openai-chat` | `api-key` | protokol | 4 | `https://api.inceptron.io/v1` |
| `inco` | [Inco](https://platform.inco.ai/docs) | `openai-chat` | `api-key` | protokol | 7 | `https://api.inco.ai/v1` |
| `infer` | [Infer by Flow7](https://infer.flow7.org/opencode) | `openai-responses` | `api-key` | protokol | 2 | `https://infer.flow7.org/v1` |
| `inference` | [Inference](https://inference.net/models) | `openai-chat` | `api-key` | protokol | 8 | `https://inference.net/v1` |
| `inferx` | [InferX](https://model.inferx.net/endpoints) | `openai-chat` | `api-key` | protokol | 11 | `https://model.inferx.net/endpoints/v1` |
| `infomaniak` | [Infomaniak](https://www.infomaniak.com/en/hosting/ai-services/open-source-models) | `openai-chat` | `api-key` | protokol | 9 | `https://api.infomaniak.com/2/ai/{productId}/openai/v1` |
| `io-net` | [IO.NET](https://io.net/docs/guides/intelligence/io-intelligence) | `openai-chat` | `api-key` | protokol | 17 | `https://api.intelligence.io.solutions/api/v1` |
| `iteracompute` | [IteraCompute](https://iteracompute.com/docs.html) | `openai-chat` | `api-key` | protokol | 9 | `https://api.iteracompute.com/v1` |
| `jalapeno` | [Jalapeno Cloud](https://www.jalapeno-cloud.ai/docs/) | `openai-chat` | `api-key` | protokol | 17 | `https://api.jalapeno-cloud.ai/v1` |
| `jiekou` | [Jiekou.AI](https://docs.jiekou.ai/docs/support/quickstart?utm_source=github_models.dev) | `openai-chat` | `api-key` | protokol | 61 | `https://api.jiekou.ai/openai` |
| `kenari` | [Kenari](https://kenari.id/docs) | `openai-chat` | `api-key` | protokol | 56 | `https://kenari.id/v1` |
| `kilo` | [Kilo Gateway](https://kilo.ai) | `openai-chat` | `api-key` | protokol | 395 | `https://api.kilo.ai/api/gateway` |
| `kimi-code-plan-cn` | [Kimi For Coding (kimi.com)](https://www.kimi.com/code/docs/en/kimi-code/models.html) | `openai-chat` | `api-key` | protokol | 4 | `https://api.kimi.com/coding/v1` |
| `kimi-code-plan-global` | [Kimi For Coding (kimi.ai)](https://www.kimi.ai/code/docs/en/kimi-code/models.html) | `openai-chat` | `api-key` | protokol | 4 | `https://api.kimi.ai/coding/v1` |
| `klokintegration` | [klokintegration.se](https://klokintegration.se/docs/ai-api) | `openai-chat` | `api-key` | protokol | 3 | `https://api-gw.klok.ipaas.se/proxy/kloker-key/v1` |
| `kosmik` | [Kosmik Compute](https://api.koscompute.com/docs/) | `openai-chat` | `api-key` | protokol | 1 | `https://api.koscompute.com/v1` |
| `kuae-cloud-coding-plan` | [KUAE Cloud Coding Plan](https://docs.mthreads.com/kuaecloud/kuaecloud-doc-online/coding_plan/) | `openai-chat` | `api-key` | protokol | 1 | `https://coding-plan-endpoint.kuaecloud.net/v1` |
| `lilac` | [Lilac](https://docs.getlilac.com/inference/models) | `openai-chat` | `api-key` | protokol | 4 | `https://api.getlilac.com/v1` |
| `llama` | [Llama](https://llama.developer.meta.com/docs/models) | `openai-chat` | `api-key` | protokol | 7 | `https://api.llama.com/compat/v1` |
| `llamacpp` | [llama.cpp (yerel)](https://opencode.ai/docs/providers/#llamacpp) | `openai-chat` | `none` | protokol | 0 | `http://127.0.0.1:8080/v1` |
| `llmgateway` | [DevPass (LLM Gateway)](https://llmgateway.io/docs) | `openai-chat` | `api-key` | protokol | 214 | `https://api.llmgateway.io/v1` |
| `llmgateway-providers` | [LLM Gateway](https://llmgateway.io/docs) | `openai-chat` | `api-key` | protokol | 438 | `https://api.llmgateway.io/v1` |
| `llmtech` | [LLM Tech](https://llmtech.eu/models/qwen3.8-27b) | `openai-chat` | `api-key` | protokol | 1 | `https://api.llmtech.eu/v1` |
| `llmtr` | [LLMTR](https://llmtr.com/docs) | `openai-chat` | `api-key` | protokol | 32 | `https://llmtr.com/v1` |
| `lmstudio` | [LMStudio](https://lmstudio.ai/models) | `openai-chat` | `none` | protokol | 3 | `http://127.0.0.1:1234/v1` |
| `longcat` | [LongCat](https://longcat.chat/platform/docs/) | `openai-chat` | `api-key` | protokol | 1 | `https://api.longcat.chat/openai` |
| `lucidquery` | [LucidQuery](https://lucidquery.com/docs) | `openai-chat` | `api-key` | protokol | 4 | `https://api.lucidquery.com/v1` |
| `lynkr` | [Lynkr](https://github.com/Fast-Editor/Lynkr) | `openai-chat` | `none` | protokol | 1 | `http://127.0.0.1:8081/v1` |
| `meganova` | [Meganova](https://docs.meganova.ai) | `openai-chat` | `api-key` | protokol | 19 | `https://api.meganova.ai/v1` |
| `melious` | [Melious](https://melious.ai/docs/reference/models) | `openai-chat` | `api-key` | protokol | 12 | `https://api.melious.ai/v1` |
| `merge-gateway` | [Merge Gateway](https://docs.merge.dev/merge-gateway) | `openai-chat` | `api-key` | protokol | 192 | `https://api-gateway.merge.dev/v1/openai` |
| `meta` | [Meta](https://dev.meta.ai/docs) | `openai-responses` | `api-key` | protokol | 5 | `https://api.meta.ai/v1` |
| `minimax` | [MiniMax (minimax.io)](https://platform.minimax.io/docs/guides/quickstart) | `anthropic-messages` | `api-key` | protokol | 7 | `https://api.minimax.io/anthropic/v1` |
| `minimax-cn` | [MiniMax (minimax.cn)](https://platform.minimaxi.com/docs/guides/quickstart) | `anthropic-messages` | `api-key` | protokol | 7 | `https://api.minimax.cn/anthropic/v1` |
| `minimax-cn-coding-plan` | [MiniMax Token Plan (minimax.cn)](https://platform.minimaxi.com/docs/token-plan/intro) | `anthropic-messages` | `api-key` | protokol | 8 | `https://api.minimax.cn/anthropic/v1` |
| `minimax-coding-plan` | [MiniMax Token Plan (minimax.io)](https://platform.minimax.io/docs/token-plan/intro) | `anthropic-messages` | `api-key` | protokol | 8 | `https://api.minimax.io/anthropic/v1` |
| `mistral` | [Mistral](https://docs.mistral.ai/getting-started/models/) | `openai-chat` | `api-key` | protokol | 31 | `https://api.mistral.ai/v1` |
| `mixlayer` | [Mixlayer](https://docs.mixlayer.com) | `openai-chat` | `api-key` | protokol | 5 | `https://models.mixlayer.ai/v1` |
| `moark` | [Moark](https://moark.com/docs/openapi/v1#tag/%E6%96%87%E6%9C%AC%E7%94%9F%E6%88%90) | `openai-chat` | `api-key` | protokol | 2 | `https://moark.com/v1` |
| `modal` | [Modal](https://modal.com/docs/guide/endpoints) | `openai-chat` | `api-key` | protokol | 4 | `https://inference.us-west.modal.direct/v1` |
| `model-oracle-ai` | [Model Oracle AI](https://modeloracle.com/setup/) | `openai-chat` | `api-key` | protokol | 15 | `https://api.modeloracle.com/api/v1` |
| `modelis` | [Modelis](https://modelishub.com/pricing) | `openai-chat` | `api-key` | protokol | 9 | `https://modelishub.com/v1` |
| `modelscope` | [ModelScope](https://modelscope.cn/docs/model-service/API-Inference/intro) | `openai-chat` | `api-key` | protokol | 7 | `https://api-inference.modelscope.cn/v1` |
| `moonshotai` | [Moonshot AI](https://platform.moonshot.ai/docs/api/chat) | `openai-chat` | `api-key` | protokol | 4 | `https://api.moonshot.ai/v1` |
| `moonshotai-cn` | [Moonshot AI (China)](https://platform.moonshot.cn/docs/api/chat) | `openai-chat` | `api-key` | protokol | 4 | `https://api.moonshot.cn/v1` |
| `morph` | [Morph](https://docs.morphllm.com/api-reference/introduction) | `openai-chat` | `api-key` | protokol | 3 | `https://api.morphllm.com/v1` |
| `nan` | [NaN](https://nan.builders/docs/models) | `openai-chat` | `api-key` | protokol | 7 | `https://api.nan.builders/v1` |
| `nano-gpt` | [NanoGPT](https://docs.nano-gpt.com) | `openai-chat` | `api-key` | protokol | 598 | `https://nano-gpt.com/api/v1` |
| `nearai` | [NEAR AI Cloud](https://docs.near.ai/) | `openai-chat` | `api-key` | protokol | 28 | `https://cloud-api.near.ai/v1` |
| `nebius` | [Nebius Token Factory](https://docs.tokenfactory.nebius.com/) | `openai-chat` | `api-key` | protokol | 20 | `https://api.tokenfactory.nebius.com/v1` |
| `neon` | [Neon](https://neon.com/docs) | `openai-chat` | `api-key` | protokol | 46 | `{gatewayBaseURL}/v1` |
| `neosmith` | [NeoSmith](https://neosmith.ai/docs) | `openai-responses` | `api-key` | protokol | 4 | `https://router.neosmith.ai/v1` |
| `neuralwatt` | [Neuralwatt](https://portal.neuralwatt.com/docs) | `openai-chat` | `api-key` | protokol | 29 | `https://api.neuralwatt.com/v1` |
| `nova` | [Nova](https://nova.amazon.com/dev/documentation) | `openai-chat` | `api-key` | protokol | 2 | `https://api.nova.amazon.com/v1` |
| `novita-ai` | [NovitaAI](https://novita.ai/docs/guides/introduction) | `openai-chat` | `api-key` | protokol | 107 | `https://api.novita.ai/openai` |
| `nvidia` | [Nvidia](https://docs.api.nvidia.com/nim/) | `openai-chat` | `api-key` | protokol | 81 | `https://integrate.api.nvidia.com/v1` |
| `oci` | [OCI Generative AI](https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm) | `openai-chat` | `api-key` | protokol | 9 | `https://inference.generativeai.us-chicago-1.oci.oraclecloud.com/openai/v1` |
| `ofox` | [Ofox](https://ofox.ai/docs) | `openai-chat` | `api-key` | protokol | 151 | `https://api.ofox.ai/v1` |
| `ollama` | [Ollama (yerel)](https://opencode.ai/docs/providers/#ollama) | `openai-chat` | `none` | protokol | 0 | `http://127.0.0.1:11434/v1` |
| `ollama-cloud` | [Ollama Cloud](https://docs.ollama.com/cloud) | `openai-chat` | `api-key` | protokol | 24 | `https://ollama.com/v1` |
| `openai` | [OpenAI](https://platform.openai.com/docs/models) | `openai-chat` | `api-key` | protokol | 48 | `https://api.openai.com/v1` |
| `opencode` | [OpenCode Zen](https://opencode.ai/docs/zen) | `openai-chat` | `api-key` | protokol | 116 | `https://opencode.ai/zen/v1` |
| `opencode-go` | [OpenCode Go](https://opencode.ai/docs/go) | `openai-chat` | `api-key` | protokol | 33 | `https://opencode.ai/zen/go/v1` |
| `openreason` | [OpenReason](https://openreason.app/docs) | `openai-chat` | `api-key` | protokol | 3 | `https://api.openreason.app/v1` |
| `openrouter` | [OpenRouter](https://openrouter.ai/models) | `openai-chat` | `api-key` | protokol | 388 | `https://openrouter.ai/api/v1` |
| `opper` | [Opper](https://opper.ai/models) | `openai-chat` | `api-key` | protokol | 57 | `https://api.opper.ai/v3/compat` |
| `orcarouter` | [OrcaRouter](https://docs.orcarouter.ai) | `openai-chat` | `api-key` | protokol | 117 | `https://api.orcarouter.ai/v1` |
| `ovhcloud` | [OVHcloud AI Endpoints](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog//) | `openai-chat` | `api-key` | protokol | 14 | `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1` |
| `pareto` | [Pareto Inference](https://docs.paretoinference.com/) | `openai-chat` | `api-key` | protokol | 1 | `https://api.paretoinference.com/v1` |
| `pendra` | [Pendra](https://pendra.ai/docs/integrations/opencode) | `openai-chat` | `api-key` | protokol | 6 | `https://api.pendra.ai/api/v1` |
| `perplexity` | [Perplexity](https://docs.perplexity.ai) | `openai-chat` | `api-key` | protokol | 4 | `https://api.perplexity.ai` |
| `perplexity-agent` | [Perplexity Agent](https://docs.perplexity.ai/docs/agent-api/models) | `openai-responses` | `api-key` | protokol | 22 | `https://api.perplexity.ai/v1` |
| `pioneer` | [Pioneer](https://agent.pioneer.ai/llms.txt) | `openai-chat` | `api-key` | protokol | 116 | `https://api.fastino.ai/v1` |
| `poe` | [Poe](https://creator.poe.com/docs/external-applications/openai-compatible-api) | `openai-chat` | `api-key` | protokol | 104 | `https://api.poe.com/v1` |
| `poolside` | [Poolside](https://platform.poolside.ai) | `openai-chat` | `api-key` | protokol | 3 | `https://inference.poolside.ai/v1` |
| `privatemode-ai` | [Privatemode AI](https://docs.privatemode.ai/api/overview) | `openai-chat` | `none` | protokol | 8 | `http://localhost:8080/v1` |
| `qihang-ai` | [QiHang](https://www.qhaigc.net/docs) | `openai-chat` | `api-key` | protokol | 9 | `https://api.qhaigc.net/v1` |
| `qiniu-ai` | [Qiniu](https://developer.qiniu.com/aitokenapi) | `openai-chat` | `api-key` | protokol | 89 | `https://api.qnaigc.com/v1` |
| `qvac` | [QVAC](https://www.npmjs.com/package/@qvac/ai-sdk-provider) | `openai-chat` | `none` | protokol | 9 | `http://127.0.0.1:11434/v1` |
| `regolo-ai` | [Regolo AI](https://docs.regolo.ai/) | `openai-chat` | `api-key` | protokol | 14 | `https://api.regolo.ai/v1` |
| `requesty` | [Requesty](https://requesty.ai/solution/llm-routing/models) | `openai-chat` | `api-key` | protokol | 166 | `https://router.requesty.ai/v1` |
| `routing-run` | [routing.run](https://docs.routing.run/api-reference/models) | `openai-chat` | `api-key` | protokol | 15 | `https://api.routing.run/v1` |
| `runinfra` | [RunInfra](https://runinfra.ai/docs) | `openai-chat` | `api-key` | protokol | 7 | `https://api.runinfra.ai/v1` |
| `sakana` | [Sakana AI](https://console.sakana.ai/models) | `openai-chat` | `api-key` | protokol | 4 | `https://api.sakana.ai/v1` |
| `salad-cloud` | [SaladCloud AI Gateway](https://docs.salad.com/ai-gateway/explanation/overview) | `openai-chat` | `api-key` | protokol | 1 | `https://ai.salad.cloud/v1` |
| `sap-ai-core` | [SAP AI Core](https://help.sap.com/docs/sap-ai-core) | `sap-orchestration-v2` | `oauth-client-credentials` | protokol | 44 | Kullanıcı hesabından girilir |
| `sarvam` | [Sarvam AI](https://docs.sarvam.ai/api-reference-docs/getting-started/models) | `openai-chat` | `api-key` | protokol | 2 | `https://api.sarvam.ai/v1` |
| `scaleway` | [Scaleway](https://www.scaleway.com/en/docs/generative-apis/) | `openai-chat` | `api-key` | protokol | 13 | `https://api.scaleway.ai/v1` |
| `scnet-token-plan` | [SCNet Token Plan](https://www.scnet.cn/ac/openapi/doc/2.0/moduleapi/plans/token-plan.html) | `openai-chat` | `api-key` | protokol | 19 | `https://api.scnet.cn/api/llm/v1` |
| `scx-ai` | [SCX.ai](https://platform.scx.ai/docs) | `openai-chat` | `api-key` | protokol | 4 | `https://api.scx.ai/v1` |
| `sensenova` | [SenseNova (China)](https://platform.sensenova.cn/docs) | `openai-chat` | `api-key` | protokol | 5 | `https://token.sensenova.cn/v1` |
| `siliconflow` | [SiliconFlow](https://cloud.siliconflow.com/models) | `openai-chat` | `api-key` | protokol | 57 | `https://api.siliconflow.com/v1` |
| `siliconflow-cn` | [SiliconFlow (China)](https://cloud.siliconflow.com/models) | `openai-chat` | `api-key` | protokol | 44 | `https://api.siliconflow.cn/v1` |
| `snowflake-cortex` | [Snowflake Cortex](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-rest-api) | `openai-chat` | `bearer` | protokol | 25 | `https://{account}.snowflakecomputing.com/api/v2/cortex/v1` |
| `stackit` | [STACKIT](https://docs.stackit.cloud/products/data-and-ai/ai-model-serving/basics/available-shared-models) | `openai-chat` | `api-key` | protokol | 6 | `https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1` |
| `standardcompute` | [Standard Compute](https://standardcompute.com/models) | `openai-chat` | `api-key` | protokol | 1 | `https://api.stdcmpt.com/v1` |
| `stepfun` | [StepFun (China)](https://platform.stepfun.com/docs/zh/overview/concept) | `openai-chat` | `api-key` | protokol | 6 | `https://api.stepfun.com/v1` |
| `stepfun-ai` | [StepFun (Global)](https://platform.stepfun.ai/docs/en/overview/concept) | `openai-chat` | `api-key` | protokol | 6 | `https://api.stepfun.ai/v1` |
| `stepfun-ai-step-plan` | [StepFun Step Plan (Global)](https://platform.stepfun.ai/docs/en/step-plan/integrations/reasoning-api) | `openai-chat` | `api-key` | protokol | 4 | `https://api.stepfun.ai/step_plan/v1` |
| `stepfun-step-plan` | [StepFun Step Plan (China)](https://platform.stepfun.com/docs/zh/step-plan/integrations/reasoning-api) | `openai-chat` | `api-key` | protokol | 5 | `https://api.stepfun.com/step_plan/v1` |
| `subconscious` | [Subconscious](https://docs.subconscious.dev) | `anthropic-messages` | `api-key` | protokol | 2 | `https://api.subconscious.dev/v1` |
| `submodel` | [submodel](https://submodel.gitbook.io) | `openai-chat` | `api-key` | protokol | 9 | `https://llm.submodel.ai/v1` |
| `synthetic` | [Synthetic](https://synthetic.new/pricing) | `openai-chat` | `api-key` | protokol | 11 | `https://api.synthetic.new/openai/v1` |
| `tempr` | [Tempr Gateway](https://temprhq.io/docs/gateway-reference.html) | `openai-chat` | `api-key` | protokol | 79 | `https://api.temprhq.io/v1` |
| `tencent-coding-plan` | [Tencent Coding Plan (China)](https://cloud.tencent.com/document/product/1772/128947) | `openai-chat` | `api-key` | protokol | 8 | `https://api.lkeap.cloud.tencent.com/coding/v3` |
| `tencent-token-plan` | [Tencent Token Plan](https://cloud.tencent.com/document/product/1823/130060) | `openai-chat` | `api-key` | protokol | 2 | `https://api.lkeap.cloud.tencent.com/plan/v3` |
| `tencent-tokenhub` | [Tencent TokenHub](https://cloud.tencent.com/document/product/1823/130050) | `openai-chat` | `api-key` | protokol | 3 | `https://tokenhub.tencentmaas.com/v1` |
| `tensorx` | [TensorX](https://docs.tensorx.ai/) | `openai-chat` | `api-key` | protokol | 25 | `https://api.tensorx.ai/v1` |
| `the-grid-ai` | [The Grid AI](https://thegrid.ai/docs) | `openai-chat` | `api-key` | protokol | 9 | `https://api.thegrid.ai/v1` |
| `thinkingmachines` | [Thinking Machines](https://tinker-docs.thinkingmachines.ai/tinker/compatible-apis/anthropic/) | `anthropic-messages` | `api-key` | protokol | 2 | `https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api/v1` |
| `tinfoil` | [Tinfoil](https://docs.tinfoil.sh) | `openai-chat` | `api-key` | protokol | 7 | `https://inference.tinfoil.sh/v1` |
| `togetherai` | [Together AI](https://docs.together.ai/docs/serverless-models) | `openai-chat` | `api-key` | protokol | 29 | `https://api.together.xyz/v1` |
| `tokengo` | [TokenGo](https://www.tokengo.com/docs) | `openai-chat` | `api-key` | protokol | 13 | `https://api.tokengo.com/v1` |
| `tokenrouter` | [TokenRouter](https://www.tokenrouter.com/docs/tokenrouter-feature-guide/) | `openai-chat` | `api-key` | protokol | 1 | `https://api.tokenrouter.com/v1` |
| `trustedrouter` | [TrustedRouter](https://trustedrouter.com/docs) | `openai-chat` | `api-key` | protokol | 7 | `https://api.trustedrouter.com/v1` |
| `umans-ai` | [Umans AI](https://app.umans.ai/offers/code/docs/orgs) | `openai-chat` | `api-key` | protokol | 6 | `https://api.code.umans.ai/v1` |
| `umans-ai-coding-plan` | [Umans AI Coding Plan](https://app.umans.ai/offers/code/docs) | `openai-chat` | `api-key` | protokol | 7 | `https://api.code.umans.ai/v1` |
| `unorouter` | [UnoRouter](https://unorouter.com/models) | `openai-chat` | `api-key` | protokol | 23 | `https://api.unorouter.com/v1` |
| `upstage` | [Upstage](https://developers.upstage.ai/docs/apis/chat) | `openai-chat` | `api-key` | protokol | 4 | `https://api.upstage.ai/v1/solar` |
| `v0` | [v0](https://sdk.vercel.ai/providers/ai-sdk-providers/vercel) | `unsupported` | `api-key` | katalog | 3 | — |
| `vancine` | [Vancine](https://vancine.com/docs) | `openai-chat` | `api-key` | protokol | 8 | `https://vancine.com/v1` |
| `venice` | [Venice AI](https://docs.venice.ai) | `openai-chat` | `api-key` | protokol | 116 | `https://api.venice.ai/api/v1` |
| `vercel` | [Vercel AI Gateway](https://github.com/vercel/ai/tree/5eb85cc45a259553501f535b8ac79a77d0e79223/packages/gateway) | `openai-chat` | `api-key` | protokol | 284 | `https://ai-gateway.vercel.sh/v1` |
| `vispark` | [Vispark](https://lab.vispark.in/#vision) | `openai-chat` | `api-key` | protokol | 3 | `https://api.lab.vispark.in/v1` |
| `vivgrid` | [Vivgrid](https://docs.vivgrid.com/models) | `openai-responses` | `api-key` | protokol | 36 | `https://api.vivgrid.com/v1` |
| `volcengine` | [Volcengine Ark](https://www.volcengine.com/docs/82379/1330310) | `openai-chat` | `api-key` | protokol | 16 | `https://ark.cn-beijing.volces.com/api/v3` |
| `volcengine-coding-plan` | [Volcengine Ark Coding Plan](https://www.volcengine.com/docs/82379/1928261) | `openai-chat` | `api-key` | protokol | 10 | `https://ark.cn-beijing.volces.com/api/coding/v3` |
| `vultr` | [Vultr](https://api.vultrinference.com/) | `openai-chat` | `api-key` | protokol | 15 | `https://api.vultrinference.com/v1` |
| `wafer.ai` | [Wafer](https://docs.wafer.ai/wafer-pass) | `openai-chat` | `api-key` | protokol | 5 | `https://pass.wafer.ai/v1` |
| `wallaby` | [Wallaby](https://wallabytoken.com/docs) | `openai-chat` | `api-key` | protokol | 1 | `https://api.wallabytoken.com/v1` |
| `wandb` | [CoreWeave](https://docs.wandb.ai/inference) | `openai-chat` | `api-key` | protokol | 29 | `https://api.inference.wandb.ai/v1` |
| `watsonx` | [watsonx.ai](https://www.ibm.com/docs/en/watsonx/saas?topic=solutions-supported-foundation-models) | `watsonx-chat` | `iam` | protokol | 5 | `https://us-south.ml.cloud.ibm.com` |
| `xai` | [xAI](https://docs.x.ai/docs/models) | `openai-responses` | `api-key` | protokol | 8 | `https://api.x.ai/v1` |
| `xiaomi` | [Xiaomi](https://platform.xiaomimimo.com/#/docs) | `openai-chat` | `api-key` | protokol | 9 | `https://api.xiaomimimo.com/v1` |
| `xiaomi-token-plan-ams` | [Xiaomi Token Plan (Europe)](https://platform.xiaomimimo.com/#/docs) | `openai-chat` | `api-key` | protokol | 5 | `https://token-plan-ams.xiaomimimo.com/v1` |
| `xiaomi-token-plan-cn` | [Xiaomi Token Plan (China)](https://platform.xiaomimimo.com/#/docs) | `openai-chat` | `api-key` | protokol | 5 | `https://token-plan-cn.xiaomimimo.com/v1` |
| `xiaomi-token-plan-sgp` | [Xiaomi Token Plan (Singapore)](https://platform.xiaomimimo.com/#/docs) | `openai-chat` | `api-key` | protokol | 5 | `https://token-plan-sgp.xiaomimimo.com/v1` |
| `xpersona` | [Xpersona](https://www.xpersona.co/docs) | `openai-chat` | `api-key` | protokol | 13 | `https://www.xpersona.co/v1` |
| `zai` | [Z.AI](https://docs.z.ai/guides/overview/pricing) | `openai-chat` | `api-key` | protokol | 18 | `https://api.z.ai/api/paas/v4` |
| `zai-coding-plan` | [Z.AI Coding Plan](https://docs.z.ai/devpack/overview) | `openai-chat` | `api-key` | protokol | 7 | `https://api.z.ai/api/coding/paas/v4` |
| `zeldoc` | [Zeldoc](https://docs.zeldoc.ai) | `openai-chat` | `api-key` | protokol | 1 | `https://api.zeldoc.ai/v1` |
| `zenifra` | [Zenifra](https://docs.zenifra.com) | `openai-chat` | `api-key` | protokol | 1 | `https://ai.zenifra.com/v1` |
| `zenmux` | [ZenMux](https://docs.zenmux.ai) | `openai-chat` | `api-key` | protokol | 125 | `https://zenmux.ai/api/v1` |
| `zhipuai` | [Zhipu AI](https://docs.z.ai/guides/overview/pricing) | `openai-chat` | `api-key` | protokol | 17 | `https://open.bigmodel.cn/api/paas/v4` |
| `zhipuai-coding-plan` | [Zhipu AI Coding Plan](https://docs.bigmodel.cn/cn/coding-plan/overview) | `openai-chat` | `api-key` | protokol | 4 | `https://open.bigmodel.cn/api/coding/paas/v4` |
