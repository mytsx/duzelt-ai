# #8: sınırlı CMS kurulum ve destek deneyi

Hazırlık tarihi: **7 Ekim 2026**. [Issue #8](https://github.com/mytsx/duzelt-ai/issues/8) açık; yorum yok. Bu dosya bir deney planıdır. **Görüşmeler, gerçek teknik pilot, ücretli teklif ve ücretli pilot: NOT RUN.** Talep, ödeme isteği veya gelir kanıtı yoktur.

Mevcut belgelerde bu deney için plan/şablon bulunmadığından yalnız bu eksikler hazırlandı. Kurulum, sağlayıcılar ve editör matrisinin kaynakları [README](../README.md), [test sınırları](testing.md) ve [#7 doğrulaması](first-correction.md) olarak kalır. Yeni özellik, CMS adaptörü, ücretli çekirdek işlev veya pazarlama sayfası eklenmez.

## Hipotez ve ölçülecek iş

Hipotez: Türkçe içerik üreten bazı ekipler, tekrar eden bir düzeltme işinde eklentinin kurulumu veya bağlantı/editör ayarlarında takılabilir; kapsamı belirli insan desteği yararlı olabilir. Ücretsiz eklentinin yararlı bulunması, bu hizmete ödeme isteğini kanıtlamaz.

Görüşmelerde kullanılan CMS, **gerçek editör adı/sürümü**, düzenleme görevi, tekrar sıklığı, mevcut çözüm ve takılınan adım öğrenilir. CMS adı tek başına uyumluluk kararı verdirmez. WordPress, Drupal, Joomla veya Notion için genel destek; Notion'ın Quill kullandığı; rakipsiz Türkçe çözüm ya da kusursuz düzeltme iddiası kullanılmaz.

## Başlamadan önce operatörün dolduracağı alanlar

[Boş şablonları](cms-pilot-templates.md) çalışma kopyasında doldurun. Bu turda kişi/kurum araştırması, iletişim listesi, davet veya görüşme yapılmadı.

- Deney sorumlusu, hedef görev/ekip türü, görüşme dönemi ve en fazla **10–15 gönüllü görüşme**.
- Görüşme ve olası pilot için ayrı açık rıza yöntemi; anonim not kapsamı, saklama yeri ve silme tarihi. Bu repo veya GitHub issue'ları kişisel veri deposu olarak kullanılmaz.
- Aşağıdaki önerilen eşikleri kabul etme veya değiştirme kararı. Eşikler ilk görüşmeden **önce** tarihli kayda geçirilir; sonuç görüldükten sonra değiştirilmez.
- İletişim kuracak kişi ve açıkça izin verilen kanal/alıcılar. Bu plan kimseye mesaj gönderme yetkisi vermez; otomatik kampanya başlatılmaz.

İsim, e-posta, telefon, kurum/site URL'si, hesap ekranı, özel metin/prompt, API anahtarı veya erişim belirteci bu şablonlara girmez. Ham kayıt veya ekran kaydı istenmez. Katılımcı paylaşmak istemediği soruyu atlayabilir ve görüşmeyi/pilotu durdurabilir. Repo'ya yalnız yeniden tanımlamaya elverişli ayrıntılar ayıklanmış toplu sonuç konur; çok küçük grupların ayrıntılı dökümü verilmez.

## 1. Gönüllü görüşmeler

Operatörün izinli kanalında Türkçe içerik düzenleme işi yapan 10–15 gönüllüyle yaklaşık 20 dakikalık görüşmeler planlanır. Aynı ekipten birden fazla kişi varsa görüşme sayısında görünür; **bağımsız ekip sinyali** olarak bir kez sayılır. Bu küçük gönüllü örneklemin sonuçları bütün pazara genellenmez.

Önce görevi anlamak için şu sorular kullanılır; çözümü öven veya satın almaya yönlendiren sorular sorulmaz:

1. Hangi içerik görevini ne sıklıkta yapıyorsunuz? Özel metin göstermeden son işin adımlarını anlatabilir misiniz?
2. CMS ve editörün adı/sürümü biliniyor mu? Bilinmiyorsa kayıt **bilinmiyor** olarak kalsın; destek varsayılmasın.
3. Yazım/üslup kontrolünü bugün nasıl yapıyorsunuz? En çok nerede zaman veya yeniden iş harcıyorsunuz?
4. Eklenti/AI aracı kullandıysanız hangi kurulum, bağlantı, izin veya editör adımında takıldınız? Denemediyseniz sorun yaşamış gibi kaydetmeyin.
5. Kurulum/destek için dış yardım kullandınız mı; hangi hizmet gerekliydi? Söylenen ihtiyacı gerçekleşmiş ödeme gibi kaydetmeyin.
6. Mevcut ücretsiz eklentinin yanında, yalnız sentetik metinle sınırları belirli bir teknik pilotu gönüllü denemek ister misiniz? Görüşme rızası pilot rızası sayılmaz.

Görüşme özeti gözlenen sorun ile katılımcının tahminini ayırır. Gösterim yapılmışsa sırası kaydedilir; gösterim sonrası ilgi, önceden yaşanmış sorun olarak sayılmaz. Sonuçta toplam görüşme/bağımsız ekip sayısı, bilinmeyen editörler, tekrar eden görevler ve pilot için açık gönüllülük topluca özetlenir.

## 2. Önceden belirlenen karar eşikleri

Aşağıdakiler **önerilen deney eşikleridir**, gerçekleşmiş sonuç veya istatistiksel pazar kanıtı değildir. Operatör değiştirecekse ilk görüşmeden önce şablona gerekçesiyle yazmalıdır.

| Karar | Önerilen koşul | Sonraki adım |
| --- | --- | --- |
| Teknik pilota devam | En az 10 görüşme tamamlandı; aynı tekrar eden görev/kurulum sorunu en az **4 bağımsız ekipte** görüldü; en az **2 bağımsız ekip** ayrı pilot rızasına açıkça istekli. | Uygun kurulumdan bir ekip ve tek bir senaryo seçin; aşağıdaki teknik kapıları tamamlayın. Bu, ödeme isteği değildir. |
| Bir kez yeniden dene | En az 10 görüşmede sorun en az **3 bağımsız ekipte** var ve en az bir pilot gönüllüsü var; fakat devam eşiği veya net editör/senaryo eşleşmesi sağlanmadı. | Tek bir hedef görev/segment varsayımını değiştirin. Yeni dönemi ve eşikleri önceden kaydedin; önceki sonuçları silmeyin veya yeni eşikle başarılı saymayın. |
| Durdur | Planlanan dönem sonunda 10 görüşmeye ulaşılamadı, tekrar eden sorun 3 bağımsız ekipten azında kaldı veya açık pilot gönüllüsü yok. | Eksik örneklem ile olumsuz sonucu ayrı belirtin; nedenleri özetleyip bu deneyi kapatın. Davet veya pilot otomatik başlatılmaz. |

10–15 görüşmenin tamamı değerlendirilir; ilk olumlu yanıtlarda durup başarı seçilmez. Teknik erişim veya rıza kapısı geçilemiyorsa görüşme sinyali olumlu olsa bile pilot **başlatılmaz**; engel kaydedilir. Rızadan vazgeçen katılımcı pilot gönüllüsü sayımından çıkarılır.

Bu deney için **toplam bir yeniden deneme** önerilir: ya tek ek görüşme dönemi ya tek teknik düzeltme/yeniden koşum. Bir aşamada kullanılmışsa diğer aşama için ikinci tekrar açılmaz. Yeni bir deney veya daha geniş süre bütçesi ayrıca ön kayıt ve yetki gerektirir; eski sonuçlar korunur.

## 3. Dar teknik pilot

Pilota geçmeden ayrı rıza, kapsam, kurulum/editor sürümü ve kabul ölçütleri kayıtlı olmalıdır. [#7 kaydında](first-correction.md) 7 Ekim temiz profilde gerçek mağaza kurulumu **PASS**; ülke/bölge doğrulanmadı ve bulut/yerel ilk düzeltme hâlâ **NOT RUN**. Bu kapı tamamlanmadan veya seçilen pilot kurulumunda eşdeğer onaylı gerçek kurulum ve gerekli düzeltme kanıtı alınmadan teknik pilot başlamaz. Sentetik kaynak veya anahtarsız hata testi bu kapıyı geçirmez.

Önerilen dar kapsam: **bir ekip, bir CMS kurulumu, tek zengin metin editörü ve tam sürümü, bir masaüstü Chrome profili, bir mevcut sağlayıcı/model bağlantısı**. Üretim içeriği yerine izole örnek sayfa/staging ve sentetik metin kullanılır. CMS/editör eşleşmesi bilinmiyorsa önce salt okunur tanımlama yapılır; destek sözü verilmez.

Operatör süre bütçesini önceden belirler; başlangıç önerisi 60 dakika kurulum/doğrulama, 15 dakika kısa eğitim ve 15 dakika sonuç kaydıdır. Süre aşılırsa ek işi sessizce kapsam içine almayın; nedeni kaydedip yeniden planlama kararı verin.

Katılımcı anahtarını kendisi **Ayarlar** üzerinden girer. Eklenti kurulumu/etkinleştirme, seçilen endpoint için yeni Chrome izni ve varsa yerel origin ayarı için hedef ve amaçla ayrı onay gerekir. Yeni hesap, anahtar, servis/model kurulumu, kurum güvenlik ayarı veya üretim yazma yetkisi bu dar pilotun parçası değildir. Bulut bağlantı testi de gerçek ve ücret doğurabilecek istek gönderir; seçilen sağlayıcı/endpoint ve yalnız sentetik metin kullanımı önce kabul edilmiş olmalıdır.

Pilotun temel akışı mevcut [kurulum rehberini](../README.md#kurulum-ve-kullanım) kullanır: bağlantı testi → sentetik örneği düzelt → önizleme → iptal → yeniden düzelt → kabul. Aynı kurulumda kullanıcıya bu akış öğretilir. [Senaryo ve kabul şablonu](cms-pilot-templates.md#teknik-senaryo-ve-kabul-kaydı) şu sonuçları ayrı kaydeder:

- Düğme doğru editörde görünür; normal input/textarea için destek beklenmez.
- Önizleme açılması metni değiştirmez; iptal/Escape asıl metni korur; kabul incelenen sonucu uygular.
- Güvenli biçim eşlemesi varsa biçimler korunur; yapısal dönüşüm oluşursa düz metin uyarısı görünür ve kullanıcı kararı beklenir. Uyarı görülen kurulumda koşulsuz biçim koruma sözü verilmez.
- Eksik izin/kapalı servis/geçersiz bağlantıda anlaşılır hata ve metnin korunması; önizleme sırasında metin değişirse eski sonucun üzerine yazmaması.
- Desteklenen editörün native undo davranışıyla kabul sonrası sentetik metnin geri alınması.
- Önerinin anlamı ve doğruluğu insan tarafından incelenir. Metin kalitesi ile kurulum/akış başarısı ayrı değerlendirilir.

Sonuçlar **PASS / FAIL / NOT RUN / koşul oluşmadı** olarak kaydedilir. Zorunlu bir adım çalıştırılmadıysa bütün pilot PASS değildir. Metin kaybı, rıza dışı aktarım veya sırların görünür kayda çıkması halinde pilot durdurulur; sorun giderilmeden yeniden başlatılmaz. Başarılı tek kurulum yalnız kayıtlı CMS/editör/sürüm/bağlantı için kanıttır; platform desteğine genişletilmez.

## 4. Hizmet kapsamı ve karar

Bu bölüm **teklif veya fiyatlandırma değildir**. Teknik pilot sonrasında, ölçülmüş ihtiyaç ve operatörün ayrıca onayı varsa insan desteği için dar bir teklif taslağı doldurulabilir:

| Olası hizmete dahil | Önceden boş şablonda netleşecek sınır |
| --- | --- |
| Kurulum yardımı | Tek kayıtlı Chrome/CMS/editör sürümü; kurulumu ve izinleri kullanıcı onaylar. |
| Bağlantı kurulumu | Tek mevcut sağlayıcı/model/endpoint; anahtar katılımcıda kalır. |
| Kısa eğitim | Düzelt/önizle/kabul/iptal ve hata rehberi; süre kaydı. |
| Sınırlı destek | Başlangıç/bitiş tarihi, izinli kanal, toplam süre veya soru sınırı ve yanıt beklentisi taslaktan önce belirlenir. SLA varsayılmaz. |

Kapsam dışı: yeni CMS adaptörü/eklenti geliştirme, her CMS/sürümde uyumluluk, üretim içeriği düzeltme hizmeti, hesap/anahtar teslimi, sağlayıcı faturası veya model barındırma, sürekli yönetim, yeni güvenlik izinleri, kusursuz dil/kurumsal mevzuat garantisi. Ücretsiz Düzelt çekirdeği, mevcut düzeltme ve kabul/iptal işlevleri ücretsiz kalır; insan desteği hipotezi için paywall veya zorunlu abonelik eklenmez.

**Devam:** görüşme eşiği geçti, seçilen pilotun bütün zorunlu kabul adımları geçti, süre bütçesi karşılandı ve en az bir ekip bu dar insan desteğinin teklifini açıkça görmek istedi. Yalnız teklif hazırlama değerlendirmesine geçilir; ödeme isteği/gelir doğrulanmış sayılmaz.

**Yeniden dene:** sorun tekrarlanıyor fakat teknik pilot başarısız, hizmet kapsamı belirsiz veya süre bütçesi aşıldı. Tek bir sorun/senaryo düzeltmesi için ayrı yetki ve yeniden rıza alınır; önceki başarısızlık korunur. **Durdur:** güvenli ve dar kapsam sağlanamıyor, devam eşiği yok veya teknik pilot sonrasında bu hizmete ilgi yok.

Fiyat, sabit ücret/abonelik modeli ve ticari koşullar şimdi seçilmez. [Teklif hazırlık formu](cms-pilot-templates.md#hizmet-taslağı-ve-karar-kaydı) boştur; gönderim için ayrıca alıcı, kapsam ve açık yetki gerekir. Gerçek teklif kabulü veya ödeme yokken satış/gelir başarısı yazılmaz.

## Kabul ölçütlerinin mevcut durumu

| Issue ölçütü | Bu tur |
| --- | --- |
| 10–15 görüşmenin anonim/toplu özeti | **NOT RUN**; görüşme ve toplu özet şablonları hazır. |
| Rıza, kapsam, editör/sürüm ve eşikle pilot | **NOT RUN**; rıza/senaryo/kabul şablonu hazır. #7 gerçek kurulum kapısı açık. |
| Gerekçeli devam/yeniden dene/durdur kararı | **NOT RUN**; ön kayıt eşikleri ve boş karar formu hazır. |
| Ücretsiz çekirdek, izinsiz iletişim ve CMS iddiaları | Bu belge değişikliğinde korunur; ürün kodu, site, izinler ve hesaplar değiştirilmedi, dış mesaj gönderilmedi. |

Plan ve boş formların hazır olması #8'i tamamlamaz. Bu değişiklik yalnız yerel commit olarak tutulur; push/PR/merge/yayın yapılmaz.
