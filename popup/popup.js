const STORAGE_KEYS = {
    OPENAI_KEY: 'openai_api_key',
    ENABLED: 'ai_corrector_enabled'
};

document.addEventListener('DOMContentLoaded', () => {
    loadStatus();

    document.getElementById('enabled-toggle').addEventListener('change', toggleEnabled);
    document.getElementById('open-settings').addEventListener('click', openSettings);
});

function loadStatus() {
    // API key local storage'da, enabled sync storage'da
    chrome.storage.local.get([STORAGE_KEYS.OPENAI_KEY], (localResult) => {
        chrome.storage.sync.get([STORAGE_KEYS.ENABLED], (syncResult) => {
            const enabled = syncResult[STORAGE_KEYS.ENABLED] !== false;
            const hasApiKey = localResult[STORAGE_KEYS.OPENAI_KEY] && localResult[STORAGE_KEYS.OPENAI_KEY].length > 0;

            document.getElementById('enabled-toggle').checked = enabled;
            document.getElementById('status-text').textContent = enabled ? 'Etkin' : 'Devre Dışı';
            document.getElementById('provider-info').textContent = hasApiKey
                ? 'API Key: Ayarlanmış ✓'
                : 'API Key: Ayarlanmamış ✗';
        });
    });
}

function toggleEnabled(event) {
    const enabled = event.target.checked;
    chrome.storage.sync.set({ [STORAGE_KEYS.ENABLED]: enabled }, () => {
        document.getElementById('status-text').textContent = enabled ? 'Etkin' : 'Devre Dışı';
    });
}

function openSettings() {
    chrome.runtime.openOptionsPage();
}
