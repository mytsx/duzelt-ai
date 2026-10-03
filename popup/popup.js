const ENABLED_KEY = 'ai_corrector_enabled';
let savedEnabled = true;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-product-link]').forEach(link => { link.href = PRODUCT_CONFIG[link.dataset.productLink]; });
    document.getElementById('version-label').textContent = 'v' + chrome.runtime.getManifest().version;
    loadStatus();
    document.getElementById('enabled-toggle').addEventListener('change', toggleEnabled);
    document.getElementById('open-settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage(() => {
            if (chrome.runtime.lastError) showError('Ayarlar açılamadı. Eklentiyi yeniden yükleyip tekrar deneyin.');
        });
    });
});
function showError(message) {
    const error = document.getElementById('popup-error');
    error.textContent = message;
    error.hidden = false;
}
function updateStatus(enabled) {
    document.getElementById('enabled-toggle').checked = enabled;
    const status = document.getElementById('status-text');
    status.textContent = enabled ? 'Etkin · düğme gösterilir' : 'Devre dışı · düğme gizlenir';
    status.classList.toggle('enabled', enabled);
}
function loadStatus() {
    // Only a sanitized summary is sent to the popup; it never reads an API key.
    chrome.runtime.sendMessage({ action: 'getProviderStatus' }, response => {
        if (chrome.runtime.lastError || !response || response.error) {
            document.getElementById('provider-name').textContent = 'Ayar gerekli';
            document.getElementById('provider-model').textContent = '';
            document.getElementById('provider-info').textContent = 'Bağlantı bilgileri okunamadı. Ayarları kontrol edin.';
            return;
        }
        document.getElementById('provider-name').textContent = response.providerName || response.name || 'Ayar gerekli';
        document.getElementById('provider-model').textContent = response.model || 'Bir model seçin';
        document.getElementById('provider-info').textContent = response.configured ? 'Ayarlar kayıtlı. Erişimi ayarlardaki bağlantı testiyle doğrulayın.' : 'Düzeltmeye başlamak için sağlayıcı bağlantısını tamamlayın.';
        const dot = document.getElementById('provider-state');
        dot.classList.toggle('ready', response.configured === true);
        dot.setAttribute('aria-label', response.configured ? 'Ayarlar kayıtlı' : 'Ayar gerekli');
    });
    chrome.storage.sync.get([ENABLED_KEY], values => {
        if (chrome.runtime.lastError || !values) {
            showError('Açma/kapatma durumu okunamadı. Tekrar deneyin.');
            return;
        }
        savedEnabled = values[ENABLED_KEY] !== false;
        updateStatus(savedEnabled);
        document.getElementById('enabled-toggle').disabled = false;
    });
}
function toggleEnabled(event) {
    const toggle = event.target;
    const enabled = toggle.checked;
    toggle.disabled = true;
    document.getElementById('popup-error').hidden = true;
    chrome.storage.sync.set({ [ENABLED_KEY]: enabled }, () => {
        toggle.disabled = false;
        if (chrome.runtime.lastError) {
            updateStatus(savedEnabled);
            showError('Durum kaydedilemedi. Tekrar deneyin.');
            return;
        }
        savedEnabled = enabled;
        updateStatus(enabled);
    });
}
