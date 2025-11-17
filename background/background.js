importScripts('openai-provider.js');

const STORAGE_KEYS = {
    OPENAI_KEY: 'openai_api_key'
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'correctText') {
        handleCorrectText(request.text)
            .then(correctedText => sendResponse({ correctedText }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});

async function handleCorrectText(text) {
    const config = await loadConfig();

    if (!config.openaiKey) {
        throw new Error('OpenAI API key girilmemiş. Lütfen ayarlardan API key girin.');
    }

    return await OpenAIProvider.correctText(text, config.openaiKey);
}

async function loadConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([STORAGE_KEYS.OPENAI_KEY], (result) => {
            resolve({
                openaiKey: result[STORAGE_KEYS.OPENAI_KEY] || null
            });
        });
    });
}
