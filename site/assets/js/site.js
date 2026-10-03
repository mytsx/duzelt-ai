/* AI Türkçe Metin Düzeltici — site.js
   Bağımlılık yok. JavaScript kapalıyken bütün metinler ve bağlantılar HTML'de çalışır;
   bu dosya yalnız bağlantıları config.js ile eşitler ve küçük etkileşimleri ekler. */
(function () {
    'use strict';
    var root = document.documentElement;
    root.classList.remove('no-js');
    root.classList.add('js');

    /* Yalnız önizleme: ?tema=koyu | ?tema=acik. Varsayılan işletim sistemi tercihidir. */
    try {
        var tema = new URLSearchParams(location.search).get('tema');
        if (tema === 'koyu') root.setAttribute('data-theme', 'dark');
        if (tema === 'acik') root.setAttribute('data-theme', 'light');
    } catch (e) { /* eski tarayıcı: tercih işletim sisteminden gelir */ }

    var config = window.SITE_CONFIG || {};
    var siteRoot = root.getAttribute('data-root') || './';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function linkFor(key) {
        switch (key) {
            case 'store': return config.store;
            case 'email': return config.contactEmail ? 'mailto:' + config.contactEmail : null;
            case 'issues': return config.issues;
            case 'repository': return config.repository;
            case 'developer': return config.developerWebsite;
            default: return null;
        }
    }

    function bindConfig() {
        document.querySelectorAll('[data-link]').forEach(function (el) {
            var href = linkFor(el.getAttribute('data-link'));
            if (href) el.setAttribute('href', href);
        });
        document.querySelectorAll('[data-config]').forEach(function (el) {
            var value = config[el.getAttribute('data-config')];
            if (value !== undefined && value !== null && value !== '') el.textContent = String(value);
        });
        var sameVersion = config.version && config.publishedVersion && config.version === config.publishedVersion;
        document.querySelectorAll('[data-version-note]').forEach(function (el) { el.hidden = !!sameVersion; });
    }

    function initNav() {
        var toggle = document.querySelector('[data-nav-toggle]');
        var menu = document.getElementById('site-menu');
        if (!toggle || !menu) return;
        toggle.hidden = false;
        function setOpen(open, focusToggle) {
            menu.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.querySelector('.nav-toggle-label').textContent = open ? 'Menüyü kapat' : 'Menü';
            if (!open && focusToggle) toggle.focus();
        }
        toggle.addEventListener('click', function () {
            var open = toggle.getAttribute('aria-expanded') !== 'true';
            setOpen(open);
            if (open) { var first = menu.querySelector('a'); if (first) first.focus(); }
        });
        menu.addEventListener('click', function (event) {
            if (event.target.closest('a')) setOpen(false);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false, true);
        });
        document.addEventListener('click', function (event) {
            if (menu.classList.contains('is-open') && !menu.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
        });
        var wide = window.matchMedia('(min-width: 1081px)');
        var onWide = function () { if (wide.matches) setOpen(false); };
        if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
    }

    /* Açıklayıcı örnek: Kabul et / İptal yalnız bu sayfadaki örnek metni değiştirir; hiçbir yere istek gönderilmez. */
    function initDemo() {
        var demo = document.querySelector('[data-demo]');
        if (!demo) return;
        var actions = demo.querySelector('[data-demo-actions]');
        var cell = demo.querySelector('[data-demo-result-cell]');
        var text = demo.querySelector('[data-demo-result]');
        var label = demo.querySelector('[data-demo-result-label]');
        var status = demo.querySelector('[data-demo-status-text]');
        if (!actions || !cell || !text || !label || !status) return;
        var before = demo.getAttribute('data-before');
        var after = demo.getAttribute('data-after');
        actions.hidden = false;
        var states = {
            accepted: { label: 'Kabul edildi', text: after, status: 'Örnekte metin editöre bu hâliyle yazılır.' },
            cancelled: { label: 'İptal edildi', text: before, status: 'Asıl metin değişmeden kalır.' }
        };
        actions.addEventListener('click', function (event) {
            var button = event.target.closest('[data-demo-action]');
            if (!button) return;
            var state = states[button.getAttribute('data-demo-action')];
            if (!state) return;
            cell.setAttribute('data-state', button.getAttribute('data-demo-action'));
            label.textContent = state.label;
            text.textContent = state.text;
            status.textContent = state.status;
            text.classList.remove('is-swapping');
            void text.offsetWidth;
            text.classList.add('is-swapping');
            actions.querySelectorAll('[data-demo-action]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
        });
    }

    /* Ekran görüntüsü dosyası henüz eklenmemişse etiketli yer tutucu gösterilir. */
    function initShots() {
        document.querySelectorAll('[data-shot] img').forEach(function (img) {
            var figure = img.closest('[data-shot]');
            function missing() { figure.classList.add('is-missing'); }
            if (img.complete && img.naturalWidth === 0) missing();
            else img.addEventListener('error', missing, { once: true });
        });
    }

    function youtubeId(value) {
        if (!value) return null;
        var v = String(value).trim();
        if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
        try {
            var url = new URL(v);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
            var host = url.hostname.replace(/^www\./, '');
            var short = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/);
            if (host === 'youtu.be') return short ? short[1] : null;
            if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
                var watch = url.searchParams.get('v');
                if (url.pathname === '/watch' && /^[A-Za-z0-9_-]{11}$/.test(watch || '')) return watch;
                var m = url.pathname.match(/^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/);
                if (m) return m[2];
            }
        } catch (e) { return null; }
        return null;
    }

    function formatDuration(total) {
        var s = Math.max(0, Math.round(Number(total)));
        var m = Math.floor(s / 60);
        var r = s % 60;
        return {
            visible: m + ':' + String(r).padStart(2, '0'),
            spoken: (m ? m + ' dakika' : '') + (m && r ? ' ' : '') + (r || !m ? r + ' saniye' : ''),
            iso: 'PT' + (m ? m + 'M' : '') + (r || !m ? r + 'S' : '')
        };
    }

    /* Video: yalnız tıklamayla youtube-nocookie.com iframe'i yüklenir. Önceden istek, preconnect veya uzak küçük resim yoktur.
       Tıklamadan sonra ses kapalı başlar; altyazı tercih edilir. */
    function initVideo() {
        var sections = document.querySelectorAll('[data-video-section]');
        if (!sections.length) return;
        var id = youtubeId(config.video);
        var seconds = Number(config.videoDurationSeconds);
        var duration = Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds) : null;
        sections.forEach(function (section) {
            var preview = section.hasAttribute('data-video-preview');
            if (!id && !preview) { section.hidden = true; return; }
            section.hidden = false;
            var frame = section.querySelector('[data-video-frame]');
            var button = section.querySelector('[data-video-play]');
            var cover = section.querySelector('[data-video-cover]');
            var durationEl = section.querySelector('[data-video-duration]');
            var statusEl = section.querySelector('[data-video-status]');
            if (cover && config.videoCover) cover.setAttribute('src', siteRoot + config.videoCover);
            if (durationEl) {
                durationEl.hidden = !duration;
                if (duration) { durationEl.textContent = duration.visible; durationEl.setAttribute('datetime', duration.iso); }
            }
            var name = 'Tanıtımı izle' + (duration ? ', süre ' + duration.spoken : '') + '. YouTube oynatıcısı yüklenir.';
            if (!id) {
                button.setAttribute('aria-disabled', 'true');
                name = 'Tanıtımı izle. Önizleme: video adresi henüz tanımlı değil.';
            }
            button.setAttribute('aria-label', name);
            button.addEventListener('click', function (event) {
                if (!event.isTrusted) return;
                if (!id) {
                    if (statusEl) statusEl.textContent = 'Önizleme: video adresi henüz tanımlanmadığı için oynatıcı açılmaz.';
                    return;
                }
                var params = 'autoplay=1&mute=1&playsinline=1&rel=0&cc_load_policy=1&cc_lang_pref=tr&hl=tr';
                var iframe = document.createElement('iframe');
                iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?' + params;
                iframe.title = config.videoTitle || 'Tanıtım videosu';
                iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
                iframe.allowFullscreen = true;
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                iframe.loading = 'eager';
                frame.replaceChildren(iframe);
                iframe.focus();
            });
        });
    }

    /* Belge sayfalarında içindekiler: başlıklardan üretilir, politika metnini kopyalamaz. */
    function slug(text) {
        var map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i̇': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
        return text.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, function (c) { return map[c] || c; })
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    }

    function initToc() {
        var toc = document.querySelector('[data-toc]');
        var source = document.querySelector('[data-toc-source]');
        if (!toc || !source) return;
        var headings = source.querySelectorAll('h2');
        if (!headings.length) return;
        var list = document.createElement('ol');
        var links = [];
        headings.forEach(function (h) {
            if (!h.id) h.id = slug(h.textContent);
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = '#' + h.id;
            a.textContent = h.textContent;
            li.appendChild(a);
            list.appendChild(li);
            links.push({ a: a, h: h });
        });
        toc.appendChild(list);
        toc.hidden = false;
        var pending = false;
        function updateCurrent() {
            pending = false;
            var header = document.querySelector('.site-header');
            var threshold = (header ? header.getBoundingClientRect().bottom : 0) + 24;
            var current = links[0];
            links.forEach(function (link) {
                if (link.h.getBoundingClientRect().top <= threshold) current = link;
            });
            links.forEach(function (link) {
                if (link === current) link.a.setAttribute('aria-current', 'true');
                else link.a.removeAttribute('aria-current');
            });
        }
        function scheduleCurrent() {
            if (pending) return;
            pending = true;
            window.requestAnimationFrame(updateCurrent);
        }
        window.addEventListener('scroll', scheduleCurrent, { passive: true });
        window.addEventListener('resize', scheduleCurrent);
        updateCurrent();
    }

    ready(function () {
        bindConfig();
        initNav();
        initDemo();
        initShots();
        initVideo();
        initToc();
    });
})();
