# Yerel video üretimi

Gerçek arayüz kaynakları `source/`, onaylı metin `narration.tr.txt`, sahne planı `storyboard.json`, lisans ve final zamanlar `voice-release.json` içindedir. Büyük ses/video dosyaları `output/video/` altında tutulur; kaynak kod paketi veya mağaza çalışma ZIP'ine girmez.

Gereksinimler: Python, Pillow, NumPy, ffmpeg ve ffprobe. Görseller sistemdeki Arial fontlarıyla çizilir; dış font veya uzak görsel yüklenmez. Yerel ASR için mevcut faster-whisper kurulumu ve önceden indirilmiş base modeli gerekir; `local_files_only=True` ağdan model indirilmesini engeller.

```sh
python3 tools/prepare-media.py
python3 tools/build-video-music.py
python3 tools/add-video-voice.py
```

ASR komutu, faster-whisper bulunan mevcut Python ortamıyla çalıştırılır:

```sh
python tools/align-video-voice.py --audio output/video/licensed/duzelt-seslendirme-v1.mp3
```

Bu proje için Kalbur'un `output/video/.audio-tools/bin/python` ortamı yalnız çalıştırıcı olarak kullanıldı; ortam değiştirilmedi. PyAV sürüm uyuşmazlığını aşmak için MP3 ffmpeg ile 16 kHz mono float32 dizisine çözülür. Sözcük zamanları cümle duraklarıyla karşılaştırılır; transkripsiyon yazımı altyazı metni değildir.

Final kayıt olmadan yalnız `--music-only` veya `--visual-preview` yerel taslak üretir. `add-video-voice.py`, lisanslı kayıt durumu, kaynak ses SHA256, hizalama ve altyazı olmadan yayın videosu üretmez. Kamera sabittir; yalnız 0,4 saniyelik geçişler vardır. Altyazı ayrı SRT'dir, ürün görüntüsünün üstünü kapatmaz.

Final çıktı `output/video/licensed/duzelt-ai-tanitim-1080p.mp4`, altyazı aynı ada ait `.tr.srt` dosyasıdır. `render-check.json` tam çözümlemeyi, codec/ölçü/süreyi ve her sabit sahnenin iki kare karşılaştırmasını kaydeder. Kayıplı H.264 kodlamasındaki küçük piksel farkları kamera hareketi sayılmaz; ortalama mutlak fark 0,5 seviye ve 8 seviyeden fazla değişen kanal oranı %0,5 altında olmalıdır.

`music-mix-check.json` ses tepesini, LUFS ve konuşma/fon farkını gösterir. Final AAC ayrıca ölçülür. Tepe −1 dBTP üstüne çıkarsa veya konuşmanın ölçülen bloklarındaki alt yüzde 10 fon farkı 18 dB altındaysa üretim kontrolü başarısız olur. Sabit kazanç kayıt zamanını ve dinamiğini korur; burada tepe sınırı hedef LUFS değerinden önce gelir.

`qa.json` yerel final kanıtını özetler. İnsan tarafından baştan sona dinleme, araçların ses girdisi desteklemediği bu çalışmada tamamlanmış sayılmaz. YouTube yükleme, HD işleme, telif ve site yayını ayrı hesap işlemleridir.
