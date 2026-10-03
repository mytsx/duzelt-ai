const STORAGE_KEYS = {
    CONFIG: 'ai_provider_config',
    OPENAI_KEY: 'openai_api_key',
    CUSTOM_PROMPT: 'custom_system_prompt'
};
const CUSTOM_PROVIDER = { id: 'custom', name: 'Özel sağlayıcı', selectable: true, protocol: 'openai-chat', authType: 'bearer', models: [], fields: [], supportNote: 'API biçimini ve doğrudan bağlantı adresini belirleyin. Adres için ayrı bağlantı izni istenir.' };
const providers = [...PROVIDER_CATALOG.providers, CUSTOM_PROVIDER];
const drafts = new Map();
const discoveredModels = new Map();
let config = null;
let selectedId = 'openai';
let defaultPrompt = '';
let busy = false;
let loaded = false;
const element = id => document.getElementById(id);
const currentEntry = () => providers.find(provider => provider.id === selectedId) || CUSTOM_PROVIDER;

function localGet(keys) {
    return new Promise((resolve, reject) => chrome.storage.local.get(keys, values => {
        if (chrome.runtime.lastError || !values) reject(new Error('Ayarlar okunamadı. Sayfayı yeniden açıp tekrar deneyin.'));
        else resolve(values);
    }));
}
function localSet(values) {
    return new Promise((resolve, reject) => chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError) reject(new Error('Ayarlar kaydedilemedi. Lütfen yeniden deneyin.'));
        else resolve();
    }));
}
function localRemove(keys) {
    return new Promise((resolve, reject) => chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) reject(new Error('Ayar kaldırılamadı. Lütfen yeniden deneyin.'));
        else resolve();
    }));
}
function message(payload) {
    return new Promise((resolve, reject) => chrome.runtime.sendMessage(payload, response => {
        if (chrome.runtime.lastError || !response) reject(new Error('Eklentiden yanıt alınamadı. Eklentiyi yeniden yükleyip tekrar deneyin.'));
        else if (typeof response.error === 'string') reject(new Error(response.error));
        else resolve(response);
    }));
}
function showStatus(messageText, type = 'info', target = 'connection-status') {
    const status = element(target);
    status.textContent = messageText;
    status.className = 'inline-status ' + type;
    status.hidden = false;
}
function validConfig(value) {
    return value && value.version === 1 && typeof value.activeProviderId === 'string' && value.providers && typeof value.providers === 'object' && !Array.isArray(value.providers);
}
function readConfig(values) {
    if (values[STORAGE_KEYS.CONFIG] != null) {
        if (!validConfig(values[STORAGE_KEYS.CONFIG])) throw new Error('Sağlayıcı ayarları geçersiz. Mevcut kayıt değiştirilmedi; eklentiyi yeniden yükleyip kontrol edin.');
        return values[STORAGE_KEYS.CONFIG];
    }
    return { version: 1, activeProviderId: 'openai', providers: { openai: { model: 'gpt-4o', apiKey: typeof values[STORAGE_KEYS.OPENAI_KEY] === 'string' ? values[STORAGE_KEYS.OPENAI_KEY] : '' } } };
}
function populateProviders() {
    const query = element('provider-search').value.trim().toLocaleLowerCase('tr');
    element('provider-select').replaceChildren();
    providers.filter(provider => provider.id === selectedId || !query || (provider.name + ' ' + provider.id).toLocaleLowerCase('tr').includes(query)).forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name + (provider.selectable === false ? ' — özel giriş gerekli' : '');
        element('provider-select').append(option);
    });
    element('provider-select').value = selectedId;
}
function profileFor(entry) {
    const saved = drafts.get(entry.id) || config.providers[entry.id] || {};
    const profile = { ...saved, model: saved.model ?? entry.defaultModel ?? '', apiKey: saved.apiKey ?? '' };
    (entry.fields || []).forEach(field => {
        if (profile[field.key] === undefined && field.default !== undefined) profile[field.key] = field.default;
    });
    return profile;
}
function collectProfile() {
    const profile = { ...profileFor(currentEntry()), model: element('provider-model').value.trim(), apiKey: currentEntry().usesAPIKey === false ? '' : element('openai-key').value.trim() };
    element('provider-fields').querySelectorAll('[data-profile-field]').forEach(input => { profile[input.dataset.profileField] = input.value.trim(); });
    const baseURL = element('base-url').value.trim();
    if (baseURL) profile.baseURL = baseURL;
    else delete profile.baseURL;
    if (selectedId === 'custom') {
        profile.protocol = element('provider-protocol').value;
        profile.authType = element('provider-auth').value;
    } else {
        // Native model-specific endpoints and protocols remain controlled by the central catalog.
        delete profile.protocol;
        delete profile.authType;
    }
    return profile;
}
function renderFields(entry, profile) {
    element('provider-fields').replaceChildren();
    (entry.fields || []).filter(field => field.key !== 'apiKey').forEach(field => {
        const group = document.createElement('div');
        group.className = 'form-group';
        const label = document.createElement('label');
        const input = document.createElement(field.type === 'select' ? 'select' : 'input');
        input.id = 'profile-' + field.key;
        input.dataset.profileField = field.key;
        if (field.type === 'select') {
            (field.options || []).forEach(choice => {
                const option = document.createElement('option');
                option.value = choice.value;
                option.textContent = choice.label;
                input.append(option);
            });
        } else {
            input.type = field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text';
        }
        input.value = profile[field.key] || '';
        input.required = Boolean(field.required);
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.addEventListener('input', updateDestination);
        input.addEventListener('change', updateDestination);
        label.htmlFor = input.id;
        label.textContent = field.label + (field.required ? ' *' : '');
        group.append(label, input);
        element('provider-fields').append(group);
    });
}
function renderModels() {
    const entry = currentEntry();
    const models = discoveredModels.get(selectedId) || entry.models || [];
    const query = element('provider-model').value.toLocaleLowerCase('tr');
    element('model-options').replaceChildren();
    models.filter(model => model.selectable !== false && (!query || (model.id + ' ' + model.name).toLocaleLowerCase('tr').includes(query))).slice(0, 100).forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.label = model.name || model.id;
        element('model-options').append(option);
    });
    element('model-help').textContent = models.length
        ? models.length.toLocaleString('tr') + ' katalog/model kaydı. Adını yazın veya kendi model/deployment adınızı girin. Her model bu metin akışını desteklemeyebilir.'
        : 'Yerelde yüklü modelin veya sağlayıcıdaki metin modelinin tam adını girin.';
}
function updateDestination() {
    try {
        const resolved = ProviderService.resolveProfile(selectedId, collectProfile());
        const url = new URL(resolved.baseURL);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        element('destination-note').textContent = (local ? 'Metin ve kurallar bu cihazdaki servise gönderilir: ' : 'Metin ve kurallar bu API adresine gönderilir: ') + url.origin + '. ' + (local ? 'Yerel sunucunun veri işleme ayarlarını kontrol edin.' : 'Sağlayıcının kullanım ücretleri ve veri işleme koşulları geçerlidir.');
        if (typeof ProviderService.getPermissionOrigins === 'function') {
            const origins = ProviderService.getPermissionOrigins(selectedId, collectProfile());
            if (origins.length > 1) element('destination-note').textContent += ' Erişim belirteci için ayrıca ' + origins.slice(1).map(origin => origin.replace(/\/\*$/, '')).join(', ') + ' adresine bağlantı kurulur.';
        }
    } catch {
        element('destination-note').textContent = currentEntry().selectable === false
            ? 'Bu hizmet özel giriş veya ek bağlantı bileşeni gerektirir. Bu eklentide doğrudan etkinleştirilemez.'
            : 'Bağlantı bilgilerini tamamlayın. Kaydetmeden önce hedef adres için Chrome izni istenir.';
    }
}
function selectProvider(id, remember = true) {
    if (remember && loaded) drafts.set(selectedId, collectProfile());
    selectedId = id;
    const entry = currentEntry();
    const profile = profileFor(entry);
    populateProviders();
    element('provider-model').value = profile.model;
    element('openai-key').value = profile.apiKey;
    element('openai-key').type = 'password';
    element('toggle-key').textContent = 'Göster';
    element('toggle-key').setAttribute('aria-pressed', 'false');
    const noKey = entry.authType === 'none';
    element('provider-key-group').hidden = entry.usesAPIKey === false;
    element('openai-key').disabled = noKey;
    element('toggle-key').disabled = noKey;
    element('key-label').textContent = entry.authType === 'bearer' ? 'Erişim belirteci / Bearer anahtarı' : noKey ? 'API anahtarı gerekmiyor' : 'API anahtarı';
    element('base-url').value = profile.baseURL || '';
    element('advanced-settings').open = id === 'custom' || entry.requiresBaseURL === true;
    element('base-url').placeholder = entry.baseURL || 'https://…/v1';
    element('protocol-group').hidden = id !== 'custom';
    element('provider-protocol').value = profile.protocol || 'openai-chat';
    element('provider-auth').value = profile.authType || 'bearer';
    element('provider-note').textContent = [entry.supportNote, entry.authSupportNote].filter(Boolean).join(' ') || 'API anahtarınızı sağlayıcının hesabından alın. Metin modelinin tam adıyla bağlantıyı kaydedin.';
    renderFields(entry, profile);
    renderModels();
    updateDestination();
    document.querySelectorAll('[data-provider]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.provider === id)));
    element('connection-status').hidden = true;
    updateButtons();
}
function updateButtons() {
    const unsupported = currentEntry().selectable === false;
    ['save-api-btn', 'test-btn', 'refresh-models'].forEach(id => { element(id).disabled = busy || !loaded || unsupported; });
    // Avoid a provider switch while a saved test or permission request is in flight.
    element('provider-select').disabled = busy || !loaded;
    document.querySelectorAll('[data-provider]').forEach(button => { button.disabled = busy || !loaded; });
}
function setBusy(value, buttonId) {
    busy = value;
    ['save-api-btn', 'test-btn', 'refresh-models'].forEach(id => element(id).setAttribute('aria-busy', String(value && id === buttonId)));
    updateButtons();
}
async function updateSummary() {
    try {
        const status = await message({ action: 'getProviderStatus' });
        element('active-provider').textContent = status.providerName || status.name || 'Ayar gerekli';
        element('active-model').textContent = status.model || 'Model seçilmedi';
        element('connection-state').textContent = status.configured ? 'Ayarlar kayıtlı' : 'Ayar gerekli';
        element('connection-state').classList.toggle('ready', status.configured === true);
    } catch (error) { showStatus(error.message); }
}
function requestOrigin(id, profile) {
    const origins = typeof ProviderService.getPermissionOrigins === 'function'
        ? ProviderService.getPermissionOrigins(id, profile)
        : [ProviderService.getPermissionOrigin(id, profile)];
    // Called directly inside the trusted click handler, before any await.
    return new Promise((resolve, reject) => chrome.permissions.request({ origins }, allowed => {
        if (chrome.runtime.lastError || !allowed) reject(new Error('Bağlantı izni verilmedi. Ayarlar değiştirilmedi. İzin vererek yeniden deneyin.'));
        else resolve();
    }));
}
async function saveProvider(event) {
    if (!loaded || busy || !event.isTrusted) return;
    let permission;
    let profile;
    const id = selectedId;
    try {
        profile = collectProfile();
        if (!profile.model) throw new Error('Bir metin modeli veya deployment adı girin.');
        if (profile.apiKey && !/^[\x21-\x7E]+$/.test(profile.apiKey)) throw new Error('Anahtar geçersiz karakter veya boşluk içeriyor. Sağlayıcı anahtarınızı kontrol edin.');
        permission = requestOrigin(id, profile);
    } catch (error) { showStatus(error.message, 'error'); return; }
    setBusy(true, 'save-api-btn');
    try {
        await permission;
        const fresh = readConfig(await localGet([STORAGE_KEYS.CONFIG, STORAGE_KEYS.OPENAI_KEY]));
        fresh.providers[id] = profile;
        fresh.activeProviderId = id;
        await localSet({ [STORAGE_KEYS.CONFIG]: fresh });
        config = fresh;
        drafts.set(id, profile);
        if (id === 'openai') {
            if (profile.apiKey) await localSet({ [STORAGE_KEYS.OPENAI_KEY]: profile.apiKey });
            else await localRemove([STORAGE_KEYS.OPENAI_KEY]);
        }
        await updateSummary();
        const hasCredential = currentEntry().usesAPIKey === false ? Boolean(profile.clientSecret) : Boolean(profile.apiKey || currentEntry().authType === 'none');
        showStatus(currentEntry().name + ' etkinleştirildi. ' + (hasCredential ? 'Bağlantıyı test ederek model erişimini doğrulayabilirsiniz.' : 'Giriş bilgileri eksik; düzeltme için sağlayıcı bilgilerinizi tamamlayın.'), 'success');
    } catch (error) { showStatus(error.message, 'error'); }
    finally { setBusy(false); }
}
async function useSavedConnection(event, action) {
    if (!loaded || busy || !event.isTrusted) return;
    const id = selectedId;
    const profile = config.providers[id];
    let permission;
    try {
        if (!profile) throw new Error('Önce bu sağlayıcının bağlantısını kaydedin.');
        permission = requestOrigin(id, profile);
    } catch (error) { showStatus(error.message, 'error'); return; }
    const isTest = action === 'testProvider';
    setBusy(true, isTest ? 'test-btn' : 'refresh-models');
    showStatus(isTest ? 'Kaydedilmiş bağlantıyla örnek metin düzeltiliyor…' : 'Kaydedilmiş sağlayıcıdan model listesi alınıyor…');
    try {
        await permission;
        const result = await message({ action, providerId: id });
        if (isTest) {
            if (result.success !== true) throw new Error('Testten geçerli bir düzeltme yanıtı alınamadı.');
            showStatus('Bağlantı başarılı. Kaydedilmiş sağlayıcı ve model ile test tamamlandı.', 'success');
        } else {
            if (!Array.isArray(result.models)) throw new Error('Model listesi okunamadı.');
            discoveredModels.set(id, result.models.filter(model => typeof model?.id === 'string'));
            renderModels();
            showStatus(result.models.length.toLocaleString('tr') + ' model ' + (result.source === 'catalog' ? 'yerleşik katalogdan gösteriliyor; sağlayıcı ayrı model listesi sunmuyor.' : 'sağlayıcıdan alındı.') + (result.truncated ? ' Liste kısaltıldı; diğer model adlarını elle girebilirsiniz.' : ''), 'success');
        }
    } catch (error) { showStatus(error.message, 'error'); }
    finally { setBusy(false); }
}
async function savePrompt() {
    if (!loaded) return;
    const button = element('save-prompt-btn');
    button.disabled = true;
    try {
        const prompt = element('system-prompt').value.trim();
        if (!defaultPrompt) throw new Error('Varsayılan kurallar alınamadı. Sayfayı yeniden açın.');
        if (!prompt || prompt === defaultPrompt.trim()) {
            await localRemove([STORAGE_KEYS.CUSTOM_PROMPT]);
            showStatus('Varsayılan kurallar kullanılacak. Gelecekteki kural güncellemeleri otomatik uygulanır.', 'success', 'status');
        } else {
            await localSet({ [STORAGE_KEYS.CUSTOM_PROMPT]: prompt });
            showStatus('Düzeltme kuralları bu Chrome profilinde kaydedildi.', 'success', 'status');
        }
    } catch (error) { showStatus(error.message, 'error', 'status'); }
    finally { button.disabled = false; }
}
async function loadSettings() {
    document.querySelectorAll('[data-product-link]').forEach(link => { link.href = PRODUCT_CONFIG[link.dataset.productLink]; });
    element('version-label').textContent = 'Sürüm ' + chrome.runtime.getManifest().version;
    element('catalog-count').textContent = PROVIDER_CATALOG.providers.length + ' sağlayıcı kaydı';
    updateButtons();
    try {
        const values = await localGet(Object.values(STORAGE_KEYS));
        config = readConfig(values);
        if (!providers.some(provider => provider.id === config.activeProviderId)) throw new Error('Etkin sağlayıcı katalogda bulunamadı. Mevcut kayıt değiştirilmedi.');
        selectedId = config.activeProviderId;
        selectProvider(selectedId, false);
        const response = await message({ action: 'getDefaultPrompt' });
        if (typeof response.prompt !== 'string' || !response.prompt.trim()) throw new Error('Varsayılan kurallar alınamadı. Sayfayı yeniden açın.');
        defaultPrompt = response.prompt;
        element('system-prompt').value = typeof values[STORAGE_KEYS.CUSTOM_PROMPT] === 'string' && values[STORAGE_KEYS.CUSTOM_PROMPT].trim() ? values[STORAGE_KEYS.CUSTOM_PROMPT] : defaultPrompt;
        loaded = true;
        updateButtons();
        await updateSummary();
    } catch (error) { showStatus(error.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', loadSettings);
element('provider-search').addEventListener('input', populateProviders);
element('provider-select').addEventListener('change', event => selectProvider(event.target.value));
document.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', () => selectProvider(button.dataset.provider)));
element('provider-model').addEventListener('input', () => { renderModels(); updateDestination(); });
element('base-url').addEventListener('input', updateDestination);
element('provider-protocol').addEventListener('change', updateDestination);
element('provider-auth').addEventListener('change', updateDestination);
element('toggle-key').addEventListener('click', () => {
    const show = element('openai-key').type === 'password';
    element('openai-key').type = show ? 'text' : 'password';
    element('toggle-key').textContent = show ? 'Gizle' : 'Göster';
    element('toggle-key').setAttribute('aria-pressed', String(show));
});
element('save-api-btn').addEventListener('click', saveProvider);
element('test-btn').addEventListener('click', event => useSavedConnection(event, 'testProvider'));
element('refresh-models').addEventListener('click', event => useSavedConnection(event, 'listProviderModels'));
element('save-prompt-btn').addEventListener('click', savePrompt);
element('reset-prompt-btn').addEventListener('click', () => {
    if (!defaultPrompt) return;
    element('system-prompt').value = defaultPrompt;
    showStatus('Varsayılan kurallar yüklendi. Kalıcı olması için “Kuralları kaydet” düğmesine basın.', 'info', 'status');
});
