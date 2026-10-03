/* Geri bildirim: veri yalnız kullanıcı gönderince aynı origin API'sine gider.
   Turnstile, kullanıcı formu açana kadar yüklenmez. Alanlar veya tokenlar kaydedilmez/loglanmaz. */
(function () {
    'use strict';

    var form = document.getElementById('feedback-form');
    var panel = document.getElementById('feedback-panel');
    if (!form || !panel) return;
    var openers = document.querySelectorAll('[data-feedback-open]');
    var fields = document.getElementById('feedback-fields');
    var submit = document.getElementById('feedback-submit');
    var retry = document.getElementById('feedback-retry');
    var status = document.getElementById('feedback-status');
    var verification = document.getElementById('feedback-verification-status');
    var verificationRegion = verification.closest('.feedback-verification');
    var message = document.getElementById('feedback-message');
    var counter = document.getElementById('feedback-count');
    var token = '';
    var widgetId = null;
    var enabled = false;
    var pending = false;
    var preparing = false;
    var opened = false;
    var scriptTask = null;

    function updateControls() {
        submit.disabled = pending || preparing || !enabled || !token;
        submit.textContent = pending ? 'Gönderiliyor…' : 'Geri bildirimi gönder';
        fields.disabled = pending;
        retry.disabled = pending || preparing;
        form.setAttribute('aria-busy', String(pending));
        verificationRegion.setAttribute('aria-busy', String(preparing));
    }

    function setStatus(text, state) {
        status.textContent = text;
        status.hidden = !text;
        if (state) status.setAttribute('data-state', state);
        else status.removeAttribute('data-state');
    }

    function setVerification(text, needsRetry) {
        verification.textContent = text;
        retry.hidden = !needsRetry;
        retry.textContent = widgetId === null ? 'Formu yeniden hazırla' : 'Doğrulamayı yeniden dene';
        updateControls();
    }

    async function requestJSON(url, options) {
        var controller = new AbortController();
        var timeout = window.setTimeout(function () { controller.abort(); }, 20000);
        try {
            var response = await fetch(url, Object.assign({}, options, {
                signal: controller.signal,
                credentials: 'omit',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
                cache: 'no-store'
            }));
            var body = await response.json();
            return { response: response, body: body };
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function loadTurnstile() {
        if (window.turnstile && typeof window.turnstile.render === 'function') return Promise.resolve(window.turnstile);
        if (scriptTask) return scriptTask;
        scriptTask = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            var finished = false;
            var timeout;
            function finish(error) {
                if (finished) return;
                finished = true;
                window.clearTimeout(timeout);
                script.onload = null;
                script.onerror = null;
                if (error) { script.remove(); reject(new Error('verification')); }
                else resolve(window.turnstile);
            }
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.onload = function () {
                if (!window.turnstile || typeof window.turnstile.render !== 'function') { finish(true); return; }
                if (typeof window.turnstile.ready === 'function') window.turnstile.ready(function () { finish(false); });
                else finish(false);
            };
            script.onerror = function () { finish(true); };
            timeout = window.setTimeout(function () { finish(true); }, 15000);
            document.head.appendChild(script);
        }).catch(function (error) { scriptTask = null; throw error; });
        return scriptTask;
    }

    function verificationFailed(text) {
        token = '';
        setVerification(text, true);
    }

    function resetWidget() {
        token = '';
        setVerification('Spam koruması yeniden hazırlanıyor…', false);
        try {
            if (widgetId === null || !window.turnstile) throw new Error('verification');
            window.turnstile.reset(widgetId);
        } catch (error) {
            verificationFailed('Spam koruması hazırlanamadı. Yeniden deneyin veya aşağıdaki e-posta seçeneğini kullanın.');
        }
    }

    async function prepareForm() {
        if (preparing || pending) return;
        if (widgetId !== null) { resetWidget(); return; }
        preparing = true;
        enabled = false;
        token = '';
        setVerification('Form ve spam koruması hazırlanıyor…', false);
        try {
            var result = await requestJSON('/api/feedback/config');
            var config = result.body;
            if (!result.response.ok || !config || config.enabled !== true || config.action !== 'feedback' || typeof config.siteKey !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(config.siteKey)) {
                setVerification('Site formu şu anda kullanılamıyor. Aşağıdaki e-posta adresini veya GitHub Issues seçeneğini kullanabilirsiniz.', true);
                return;
            }
            var turnstile = await loadTurnstile();
            enabled = true;
            widgetId = turnstile.render('#feedback-turnstile', {
                sitekey: config.siteKey,
                action: 'feedback',
                size: 'compact',
                theme: document.documentElement.getAttribute('data-theme') || 'auto',
                language: 'tr',
                retry: 'never',
                'refresh-expired': 'manual',
                'refresh-timeout': 'manual',
                'response-field': false,
                callback: function (value) {
                    if (typeof value !== 'string' || !value || value.length > 2048) {
                        verificationFailed('Spam koruması tamamlanamadı. Yeniden doğrulayın veya e-posta gönderin.');
                        return;
                    }
                    token = value;
                    setVerification('Spam koruması tamamlandı. Geri bildiriminizi gönderebilirsiniz.', false);
                },
                'error-callback': function () {
                    verificationFailed('Spam koruması tamamlanamadı. Yeniden deneyin veya e-posta gönderin.');
                    return true;
                },
                'expired-callback': function () { verificationFailed('Doğrulamanın süresi doldu. Göndermeden önce yeniden doğrulayın.'); },
                'timeout-callback': function () { verificationFailed('Doğrulama zamanında tamamlanmadı. Yeniden deneyin veya e-posta gönderin.'); },
                'unsupported-callback': function () { verificationFailed('Bu tarayıcıda doğrulama kullanılamıyor. Aşağıdaki e-posta seçeneğini kullanın.'); }
            });
        } catch (error) {
            enabled = false;
            verificationFailed('Form veya spam koruması yüklenemedi. Bağlantınızı kontrol edin, yeniden deneyin ya da e-posta gönderin.');
        } finally {
            preparing = false;
            updateControls();
        }
    }

    function openForm(event) {
        if (!event.isTrusted) return;
        event.preventDefault();
        if (location.hash !== '#geri-bildirim') history.pushState(null, '', '#geri-bildirim');
        panel.hidden = false;
        openers.forEach(function (opener) { opener.setAttribute('aria-expanded', 'true'); });
        document.getElementById('feedback-type').focus();
        if (!opened) { opened = true; prepareForm(); }
    }

    openers.forEach(function (opener) {
        opener.hidden = false;
        opener.addEventListener('click', openForm);
    });
    retry.addEventListener('click', function (event) { if (event.isTrusted) prepareForm(); });
    message.addEventListener('input', function () {
        message.setCustomValidity('');
        counter.textContent = message.value.length + ' / 4000 karakter';
    });

    var errors = {
        validation: 'Alanları ve uzunluklarını kontrol edin; yanıt e-postası yazdıysanız geçerli bir adres kullanın.',
        honeypot: 'Gönderim kabul edilmedi. E-posta seçeneğini kullanabilirsiniz.',
        turnstile: 'Spam koruması doğrulanamadı. Yeniden doğrulayın ve tekrar gönderin.',
        rate_limit: 'Kısa sürede çok fazla deneme yapıldı. Bir dakika sonra yeniden deneyin veya e-posta gönderin.',
        too_large: 'Bildirim çok uzun. Mesajı kısaltın veya e-posta gönderin.',
        unavailable: 'Site formu şu anda kullanılamıyor. Biraz sonra yeniden deneyin veya e-posta gönderin.'
    };
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!event.isTrusted || pending) return;
        message.setCustomValidity(message.value.trim() ? '' : 'Mesajınızı yazın.');
        if (!form.reportValidity()) return;
        if (!enabled || !token || preparing) {
            setStatus('Göndermeden önce spam korumasını tamamlayın. Yazdıklarınız korunuyor.', 'error');
            return;
        }
        var payload = {
            type: form.elements.type.value,
            message: message.value.trim(),
            replyEmail: form.elements.replyEmail.value.trim(),
            appVersion: form.elements.appVersion.value.trim(),
            browser: form.elements.browser.value.trim(),
            website: form.elements.website.value,
            turnstileToken: token
        };
        pending = true;
        token = '';
        updateControls();
        setStatus('Gönderiliyor…', 'pending');
        try {
            var result = await requestJSON('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (result.response.status !== 202 || !result.body || result.body.accepted !== true || typeof result.body.id !== 'string' || !/^[A-Za-z0-9]{8}$/.test(result.body.id)) {
                var explanation = result.body && errors[result.body.error];
                setStatus('Geri bildirim gönderilemedi. Yazdıklarınız korundu. ' + (explanation || 'Yeniden deneyin veya aşağıdaki e-posta seçeneğini kullanın.'), 'error');
                return;
            }
            form.reset();
            counter.textContent = '0 / 4000 karakter';
            setStatus('Geri bildiriminiz alındı. Kayıt numarası: ' + result.body.id + '. ' + (payload.replyEmail ? 'Yanıt gerekirse paylaştığınız e-posta adresinden iletişime geçebiliriz.' : 'Yanıt e-postası paylaşmadığınız için size dönüş yapamayız.'), 'success');
        } catch (error) {
            setStatus('Gönderim sonucu alınamadı. Yazdıklarınız korundu. Bağlantınızı kontrol edin veya aşağıdaki e-posta seçeneğini kullanın.', 'error');
        } finally {
            pending = false;
            resetWidget();
            updateControls();
            status.focus();
        }
    });
})();
