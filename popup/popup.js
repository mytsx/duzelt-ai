document.addEventListener('DOMContentLoaded', () => {
    loadStatus();

    document.getElementById('enabled-toggle').addEventListener('change', toggleEnabled);
    document.getElementById('open-settings').addEventListener('click', openSettings);
});

function loadStatus() {
    // API key local storage'da, enabled sync storage'da
    chrome.storage.local.get(['openai_api_key'], (localResult) => {
        chrome.storage.sync.get(['ai_corrector_enabled'], (syncResult) => {
            const enabled = syncResult.ai_corrector_enabled !== false;
            const hasApiKey = localResult.openai_api_key && localResult.openai_api_key.length > 0;

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
    chrome.storage.sync.set({ ai_corrector_enabled: enabled }, () => {
        document.getElementById('status-text').textContent = enabled ? 'Etkin' : 'Devre Dışı';
    });
}

function openSettings() {
    chrome.runtime.openOptionsPage();
}
