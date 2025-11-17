const STORAGE_KEYS = {
    OPENAI_KEY: 'openai_api_key',
    ENABLED: 'ai_corrector_enabled'
};

document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('save-btn').addEventListener('click', saveSettings);
document.getElementById('test-btn').addEventListener('click', testConnection);

function loadSettings() {
    chrome.storage.sync.get(Object.values(STORAGE_KEYS), (result) => {
        document.getElementById('openai-key').value = result[STORAGE_KEYS.OPENAI_KEY] || '';
        document.getElementById('enabled').checked = result[STORAGE_KEYS.ENABLED] !== false;
    });
}

function saveSettings() {
    const settings = {
        [STORAGE_KEYS.OPENAI_KEY]: document.getElementById('openai-key').value,
        [STORAGE_KEYS.ENABLED]: document.getElementById('enabled').checked
    };

    chrome.storage.sync.set(settings, () => {
        showStatus('Ayarlar kaydedildi!', 'success');
    });
}

function testConnection() {
    showStatus('Test ediliyor...', 'info');

    chrome.runtime.sendMessage(
        { action: 'correctText', text: 'Bu bir test metnidir.' },
        response => {
            if (response.error) {
                showStatus('Hata: ' + response.error, 'error');
            } else {
                showStatus('Bağlantı başarılı! Sonuç: ' + response.correctedText.substring(0, 50) + '...', 'success');
            }
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
