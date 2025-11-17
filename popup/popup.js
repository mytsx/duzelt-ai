document.addEventListener('DOMContentLoaded', () => {
    loadStatus();

    document.getElementById('enabled-toggle').addEventListener('change', toggleEnabled);
    document.getElementById('open-settings').addEventListener('click', openSettings);
});

function loadStatus() {
    chrome.storage.sync.get(['ai_corrector_enabled', 'openai_api_key'], (result) => {
        const enabled = result.ai_corrector_enabled !== false;
        const hasApiKey = result.openai_api_key && result.openai_api_key.length > 0;

        document.getElementById('enabled-toggle').checked = enabled;
        document.getElementById('status-text').textContent = enabled ? 'Etkin' : 'Devre Dışı';
        document.getElementById('provider-info').textContent = hasApiKey
            ? 'API Key: Ayarlanmış ✓'
            : 'API Key: Ayarlanmamış ✗';
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
