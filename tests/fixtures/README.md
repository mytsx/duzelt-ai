# Resmî mağaza eklentisi için yerel editör fixture

Proje kökünden Python 3.9 veya üzeriyle hazırlayın ve ayrı Terminal'de sunun:

```sh
python3 tools/prepare-store-fixture.py
python3 tools/serve-store-fixture.py --port 8769
```

Hazırlık yalnız resmî npm registry'den Quill **2.0.3** metadata/tarball'ını indirir. Sabit SHA-256 ve SHA-512 ile registry integrity değerini doğrular; yalnız dört regular dosyayı alır: tarayıcı JS/CSS, lisans ve `package.json`. Paket kurulmaz, lifecycle veya indirilen JavaScript çalıştırılmaz. Tracked [store-first-correction.html](store-first-correction.html) dosyası değiştirilmeden `output/manual-store-fixture/index.html` olarak kopyalanır. Varlık hash'leri ve kaynak HTML hash'i `output/store-first-correction-assets/asset-metadata.json` içinde kaydedilir; iki output dizini Git dışında tutulur.

Yetkilendirilmiş temiz Chrome test profilinde `http://127.0.0.1:8769/` adresini açın. Sunucu yalnız loopback üzerinde HTML, Quill JS/CSS ve lisansı sunar; repo kökü, kullanıcı dosyaları, hazırlık metadata'sı veya dizin listesi açılmaz. `--port` ile boş başka bir port seçilebilir; mevcut başka sunucuyu durdurmayın. Terminal'de Ctrl+C sunucuyu kapatır.

Sayfa gerçek Quill kullanır. Kurulu resmî eklentinin betikleri kendiliğinden enjekte edilir; fixture eklenti kodu, Chrome API veya sağlayıcı yanıtı eklemez. Yalnız sentetik metni kullanın; anahtar veya kişisel metin girmeyin. Sağlayıcı kurulumu ve ücretli çağrılar ayrıca yetkilendirilmelidir. Hazırlık komutları tarayıcıyı veya eklentiyi kurmaz, izin vermez, sağlayıcı API'sine bağlanmaz.

İki düzeltme çağrılı manuel akış: ilk **Düzelt → önizleme → İptal** sonunda semantic HTML, Delta ve DOM başlangıçla aynı kalmalı. İkinci çağrıda düğme görünür biçimde devre dışıyken tekrar tıklama girişimini gözleyin; sonra **Kabul et** ve **Quill geçmişinden geri al** ile sonuç ve undo durumunu kaydedin. Biçimlerin güvenle eşlenemediği uyarısı çıkarsa kabulün düz metin uygulayacağı belirtilir; kabulden önce bu uyarıyı ve sonra biçim kaybını ayrı kaydedin. Bağlantı testi de bir düzeltme isteğidir; bu iki çağrıya eklemeyin. İsteğe bağlı görünür HTML örneği kullanılacaksa ilk çağrıdan önce seçilip başlangıç sabit tutulmalıdır.

Sayaçlar sayfa içi gözlemlerdir; sağlayıcı çağrı sayısı, faturalandırma veya kalite kanıtı değildir. Önizleme sayacı RAF snapshot'ları kullanır; çok kısa geçişleri kaçırabilir. Quill undo düğmesi gerçek history API yolunu sınar, klavye Cmd+Z davranışını kanıtlamaz. Sonuçları `docs/testing.md` ve ilgili evidence kayıtlarında ayrı değerlendirin.

7 Ekim 2026'da gerçekten test edilen HTML ve sunulan kopyanın SHA-256 değeri:
`1b39d3a0a3c75b047556db36ee8312c764e2ef4c5c3f63d0ce01b21bd9aece51`.
Bu araç tesliminde ikisi de değiştirilmedi. HTML içindeki `output/store-first-correction-assets/serve-fixture.py` ve port 8767 yorumları ilk hazırlığa ait tarihsel notlardır; tekrarlanabilir güncel komutlar yukarıdaki `tools/` dosyaları ve port 8769'dur.
