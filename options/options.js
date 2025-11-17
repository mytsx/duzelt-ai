const STORAGE_KEYS = {
    OPENAI_KEY: 'openai_api_key',
    ENABLED: 'ai_corrector_enabled'
};

document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('save-btn').addEventListener('click', saveSettings);
document.getElementById('test-btn').addEventListener('click', testConnection);

function loadSettings() {
    // API key için local storage, enabled için sync storage
    chrome.storage.local.get([STORAGE_KEYS.OPENAI_KEY], (localResult) => {
        chrome.storage.sync.get([STORAGE_KEYS.ENABLED], (syncResult) => {
            document.getElementById('openai-key').value = localResult[STORAGE_KEYS.OPENAI_KEY] || '';
            document.getElementById('enabled').checked = syncResult[STORAGE_KEYS.ENABLED] !== false;
        });
    });
}

function saveSettings() {
    const apiKey = document.getElementById('openai-key').value;
    const enabled = document.getElementById('enabled').checked;

    // API key'i local storage'a kaydet (güvenlik için)
    chrome.storage.local.set({ [STORAGE_KEYS.OPENAI_KEY]: apiKey }, () => {
        // Enabled durumunu sync storage'a kaydet
        chrome.storage.sync.set({ [STORAGE_KEYS.ENABLED]: enabled }, () => {
            showStatus('Ayarlar kaydedildi! (API key güvenli şekilde saklandı)', 'success');
        });
    });
}

function testConnection() {
    showStatus('Test ediliyor...', 'info');

    chrome.runtime.sendMessage(
        { action: 'correctText', text: 'Bu bir test metnidir.' },
        response => {
            // chrome.runtime.lastError kontrolü
            if (chrome.runtime.lastError) {
                showStatus('Hata: ' + chrome.runtime.lastError.message, 'error');
                return;
            }

            // response undefined kontrolü
            if (!response) {
                showStatus('Hata: Background script\'ten yanıt alınamadı', 'error');
                return;
            }

            // response.error kontrolü
            if (response.error) {
                showStatus('Hata: ' + response.error, 'error');
                return;
            }

            // response.correctedText kontrolü
            if (!response.correctedText) {
                showStatus('Hata: Düzeltilmiş metin alınamadı', 'error');
                return;
            }

            // Başarılı
            const preview = response.correctedText.length > 50
                ? response.correctedText.substring(0, 50) + '...'
                : response.correctedText;
            showStatus('Bağlantı başarılı! Sonuç: ' + preview, 'success');
        }
    );
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    status.style.display = 'block';

    setTimeout(() => {
        status.style.display = 'none';
    }, 5000);
}
