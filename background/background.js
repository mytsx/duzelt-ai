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
    const isOptionsPage = typeof sender.url === 'string' && sender.url.split(/[?#]/)[0] === chrome.runtime.getURL('options/options.html');
    if (request.action === 'discoverLocalModels' && !isOptionsPage) return false;

    if (request.action === 'correctText' || request.action === 'testProvider' || request.action === 'listProviderModels' || request.action === 'getProviderStatus' || request.action === 'discoverLocalModels') {
        let operation;
        if (request.action === 'correctText') operation = ProviderService.correctText(request.text).then(correctedText => ({ correctedText }));
        if (request.action === 'testProvider') operation = ProviderService.correctText('Bu bir test metnidir.', request.providerId).then(() => ({ success: true }));
        if (request.action === 'listProviderModels') operation = ProviderService.listProviderModels(request.providerId);
        if (request.action === 'getProviderStatus') operation = ProviderService.getProviderStatus();
        if (request.action === 'discoverLocalModels') {
            operation = Object.keys(request).some(key => !['action', 'providerId', 'baseURL'].includes(key))
                ? Promise.reject(new OpenAIProviderError('configuration', 'Yerel model keşfi yalnız sunucu adresini kabul eder.'))
                : ProviderService.discoverLocalModels(request.providerId, { baseURL: request.baseURL });
        }
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
