importScripts('../lib/provider-catalog.js', 'openai-provider.js', 'provider-service.js');

// İçerik betiği anahtar veya özel prompt okumaz; erişimi eklenti sayfalarıyla sınırla.
if (typeof chrome.storage.local.setAccessLevel === 'function') {
    chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }, () => {
        // lastError okunarak Chrome'un ham hata mesajını konsola yazması engellenir.
        const storageError = chrome.runtime.lastError;
        if (storageError) return;
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !request || typeof request !== 'object') return false;

    const privilegedActions = ['testProvider', 'listProviderModels', 'getProviderStatus'];
    const isExtensionPage = typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
    if (privilegedActions.includes(request.action) && !isExtensionPage) return false;

    if (request.action === 'correctText' || request.action === 'testProvider' || request.action === 'listProviderModels' || request.action === 'getProviderStatus') {
        let operation;
        if (request.action === 'correctText') operation = ProviderService.correctText(request.text).then(correctedText => ({ correctedText }));
        if (request.action === 'testProvider') operation = ProviderService.correctText('Bu bir test metnidir.', request.providerId).then(() => ({ success: true }));
        if (request.action === 'listProviderModels') operation = ProviderService.listProviderModels(request.providerId);
        if (request.action === 'getProviderStatus') operation = ProviderService.getProviderStatus();
        operation
            .then(sendResponse)
            .catch(error => sendResponse({
                error: error instanceof OpenAIProviderError
                    ? error.message
                    : 'Düzeltme tamamlanamadı. Lütfen eklentiyi yeniden yükleyip tekrar deneyin.',
                errorCode: error instanceof OpenAIProviderError ? error.code : 'extension'
            }));
        return true;
    }

    if (request.action === 'getDefaultPrompt') {
        sendResponse({ prompt: OpenAIProvider.DEFAULT_SYSTEM_PROMPT });
        return true;
    }
});
