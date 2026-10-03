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
let savedProviderIds = new Set();
let selectedId = 'openai';
let defaultPrompt = '';
let busy = false;
let loaded = false;
let discoveryGeneration = 0;
let localRequestOwner = null;
let connectionRevision = 0;
let promptRevision = 0;
let savedPrompt = '';
let providerPicker;
let modelPicker;
const pickers = [];
const copyFeedback = new WeakMap();
const element = id => document.getElementById(id);
const currentEntry = () => providers.find(provider => provider.id === selectedId) || CUSTOM_PROVIDER;
const searchText = value => String(value).toLocaleLowerCase('tr').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');

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
        else if (typeof response.error === 'string') {
            const error = new Error(response.error);
            error.code = response.errorCode;
            reject(error);
        }
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
function createPicker({ prefix, controlId, searchId, toggleId, items, selectedValue, onSelect }) {
    const container = element(prefix + '-picker');
    const control = element(controlId);
    const search = element(searchId);
    const panel = element(prefix + '-panel');
    const list = element(prefix + '-options');
    const results = element(prefix + '-results');
    const toggle = toggleId ? element(toggleId) : control;
    const separateSearch = search !== control;
    let open = false;
    let showAll = false;
    let choices = [];
    let activeIndex = -1;

    function setActive(index, scroll = false) {
        activeIndex = choices.length && index >= 0 ? Math.min(index, choices.length - 1) : -1;
        Array.from(list.children).forEach((option, row) => option.classList.toggle('is-active', row === activeIndex));
        for (const target of new Set([control, search])) {
            if (open && activeIndex >= 0) target.setAttribute('aria-activedescendant', list.children[activeIndex].id);
            else target.removeAttribute('aria-activedescendant');
        }
        if (scroll && activeIndex >= 0) list.children[activeIndex].scrollIntoView({ block: 'nearest' });
    }
    function render() {
        const query = showAll ? '' : searchText(search.value.trim());
        const matches = items().filter(item => !query || searchText(item.name + ' ' + item.id).includes(query));
        const previous = choices[activeIndex]?.id;
        choices = matches.slice(0, prefix === 'model' ? 150 : 300);
        list.replaceChildren();
        choices.forEach((item, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'picker-option';
            option.id = prefix + '-option-' + index;
            option.dataset.value = item.id;
            option.tabIndex = -1;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', String(item.id === selectedValue()));
            if (item.selectable === false) option.dataset.unavailable = 'true';
            const copy = document.createElement('span');
            copy.className = 'picker-option-copy';
            const name = document.createElement('strong');
            name.textContent = item.name || item.id;
            copy.append(name);
            const detail = prefix === 'provider'
                ? item.selectable === false ? item.supportNote || 'Bu hizmet ek giriş veya bağlantı bileşeni gerektirir.' : item.local === true ? 'Bilgisayarınızda çalışır' : item.id
                : item.id !== item.name ? item.id : '';
            if (detail) {
                const description = document.createElement('small');
                description.textContent = detail;
                copy.append(description);
            }
            const mark = document.createElement('span');
            mark.className = 'picker-option-mark';
            mark.setAttribute('aria-hidden', 'true');
            mark.textContent = item.selectable === false ? 'ⓘ' : item.id === selectedValue() ? '✓' : '';
            option.append(copy, mark);
            option.addEventListener('pointerdown', event => event.preventDefault());
            option.addEventListener('pointermove', () => setActive(index));
            option.addEventListener('click', event => choose(index, event));
            list.append(option);
        });
        results.textContent = matches.length
            ? (matches.length > choices.length ? 'İlk ' + choices.length + ' seçenek gösteriliyor. Arayarak daraltın.' : matches.length.toLocaleString('tr') + (prefix === 'provider' ? ' sağlayıcı' : ' model'))
            : prefix === 'provider' ? 'Bu adla sağlayıcı bulunamadı.' : currentEntry().local === true ? 'Henüz model yok. “Modelleri getir” düğmesini kullanın veya model adını yazın.' : 'Eşleşen model yok. Tam model adını elle yazabilirsiniz.';
        const selected = choices.findIndex(item => item.id === selectedValue());
        const remembered = choices.findIndex(item => item.id === previous);
        setActive(remembered >= 0 ? remembered : selected >= 0 ? selected : 0);
    }
    function close(restoreFocus = false) {
        open = false;
        panel.hidden = true;
        for (const target of new Set([control, search, toggle])) target.setAttribute('aria-expanded', 'false');
        setActive(-1);
        if (restoreFocus && !control.disabled) control.focus({ preventScroll: true });
    }
    function show({ all = false, focus = true } = {}) {
        if (control.disabled) return;
        for (const picker of pickers) if (picker.container !== container) picker.close();
        if (!open && separateSearch) search.value = '';
        showAll = all;
        open = true;
        panel.hidden = false;
        for (const target of new Set([control, search, toggle])) target.setAttribute('aria-expanded', 'true');
        render();
        if (focus) search.focus({ preventScroll: true });
    }
    function choose(index, event) {
        if (!event.isTrusted || !loaded || busy || !choices[index]) return;
        const item = choices[index];
        close(true);
        onSelect(item, event);
    }
    function onKey(event) {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab'].includes(event.key)) return;
        if (event.key === 'Tab') {
            if (open && separateSearch && event.target === search) {
                event.preventDefault();
                close();
                const next = event.shiftKey ? control : !element('provider-model').disabled ? element('provider-model')
                    : Array.from(document.querySelectorAll('button, input, select, textarea, a[href], summary')).find(target => !target.disabled && target.tabIndex >= 0 && target.getClientRects().length && (control.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING));
                (next || control).focus();
            } else close();
            return;
        }
        if (event.key === 'Escape') {
            if (open) { event.preventDefault(); event.stopPropagation(); close(true); }
            return;
        }
        if (!open) {
            if (!separateSearch && ['Home', 'End', 'Enter'].includes(event.key)) return;
            event.preventDefault();
            show({ all: !separateSearch });
            if (event.key === 'ArrowUp' || event.key === 'End') setActive(choices.length - 1, true);
            if (event.key === 'Home') setActive(0, true);
            return;
        }
        event.preventDefault();
        if (event.key === 'ArrowDown') setActive(activeIndex < choices.length - 1 ? activeIndex + 1 : 0, true);
        if (event.key === 'ArrowUp') setActive(activeIndex > 0 ? activeIndex - 1 : choices.length - 1, true);
        if (event.key === 'Home') setActive(0, true);
        if (event.key === 'End') setActive(choices.length - 1, true);
        if (event.key === 'Enter') {
            if (activeIndex >= 0) choose(activeIndex, event);
            else close(true);
        }
    }
    for (const target of new Set([control, search])) target.addEventListener('keydown', onKey);
    search.addEventListener('input', () => {
        showAll = false;
        if (!open) show({ focus: false });
        else { activeIndex = -1; render(); }
    });
    toggle.addEventListener('click', () => {
        if (open) close();
        else show({ all: !separateSearch });
    });
    if (!separateSearch) search.addEventListener('focus', () => { if (!open) show({ all: true, focus: false }); });
    container.addEventListener('focusout', () => setTimeout(() => { if (!container.contains(document.activeElement)) close(); }, 0));
    document.addEventListener('pointerdown', event => { if (open && !container.contains(event.target)) close(); });
    const picker = { container, open: show, close, refresh: render };
    pickers.push(picker);
    return picker;
}
function populateProviders() {
    const entry = currentEntry();
    element('provider-current-name').textContent = entry.name;
    element('provider-current-detail').textContent = entry.selectable === false ? 'Ek bağlantı gerekli' : entry.local === true ? 'Bilgisayarınızda' : entry.id === 'custom' ? 'Kendi bağlantınız' : 'Bulut hizmeti';
    element('provider-select').dataset.value = selectedId;
    providerPicker?.refresh();
}
function profileDefaults(entry, saved = {}) {
    const profile = { ...saved, model: saved.model ?? entry.defaultModel ?? '', apiKey: saved.apiKey ?? '' };
    (entry.fields || []).forEach(field => {
        if (profile[field.key] === undefined && field.default !== undefined) profile[field.key] = field.default;
    });
    return profile;
}
function profileFor(entry) {
    return profileDefaults(entry, drafts.get(entry.id) || config?.providers[entry.id] || {});
}
function normalizedProfile(entry, value) {
    const profile = profileDefaults(entry, value);
    profile.model = String(profile.model).trim();
    profile.apiKey = entry.authType === 'none' || entry.usesAPIKey === false ? '' : String(profile.apiKey).trim();
    (entry.fields || []).filter(field => field.key !== 'apiKey').forEach(field => {
        profile[field.key] = String(profile[field.key] ?? '').trim();
    });
    profile.baseURL = typeof profile.baseURL === 'string' ? profile.baseURL.trim() : '';
    if (entry.id === 'custom') {
        profile.protocol = profile.protocol || 'openai-chat';
        profile.authType = profile.authType || 'bearer';
    } else {
        const model = entry.models?.find(item => item.id === profile.model);
        if (profile.protocol === (model?.protocol || entry.protocol)) delete profile.protocol;
        if (profile.authType === entry.authType) delete profile.authType;
    }
    try { profile.baseURL = ProviderService.resolveProfile(entry.id, profile).baseURL; }
    catch { if (entry.local === true && !profile.baseURL) profile.baseURL = entry.baseURL || ''; }
    return JSON.stringify(Object.keys(profile).sort().map(key => [key, profile[key]]));
}
function displayedModel(entry, profile) {
    const model = profile?.model ?? entry.defaultModel ?? '';
    if (typeof model !== 'string' || model.length > 256 || /[\u0000-\u001f\u007f]/.test(model)) return '';
    if ([profile?.apiKey, profile?.clientSecret].some(value => typeof value === 'string' && value.trim() && model.includes(value.trim()))) return '';
    return model.trim();
}
function profileComplete(entry, profile) {
    if (!profile.model) return false;
    try {
        const resolved = ProviderService.resolveProfile(entry.id, profile);
        const credential = resolved.authType === 'none' || (entry.usesAPIKey === false ? Boolean(profile.clientSecret) : Boolean(profile.apiKey));
        return credential && !(entry.fields || []).some(field => field.required && !profile[field.key]);
    } catch { return false; }
}
function updateConnectionSaveState() {
    const wrapper = element('connection-save-state');
    if (!wrapper || !config) return;
    const entry = currentEntry();
    const profile = collectProfile();
    const saved = savedProviderIds.has(selectedId) ? config.providers[selectedId] : null;
    const changed = !saved || normalizedProfile(entry, profile) !== normalizedProfile(entry, saved);
    let state;
    let title;
    let detail;
    if (!profileComplete(entry, profile)) {
        state = 'incomplete';
        title = !profile.model ? 'Model seçilmedi' : 'Bağlantı bilgileri eksik';
        detail = !profile.model && entry.local === true
            ? (changed ? 'Sunucu adresi henüz kaydedilmedi. “Modelleri getir” ile modeli seçin, ardından “Kaydet ve kullan”a basın.' : 'Sunucu adresi kayıtlı. Düzeltme için bir model seçip “Kaydet ve kullan”a basın.')
            : (changed ? 'Bu değişiklikler henüz kaydedilmedi. Bilgileri tamamlayıp “Kaydet ve kullan”a basın.' : 'Bağlantı kayıtlı; düzeltme için eksik bilgileri tamamlayıp yeniden kaydedin.');
    } else if (changed) {
        state = 'draft';
        title = 'Kaydedilmemiş değişiklikler';
        detail = 'Sağlayıcı ve model seçiminizi etkinleştirmek için “Kaydet ve kullan”a basın.';
    } else if (config.activeProviderId !== selectedId) {
        state = 'inactive';
        title = 'Bu bağlantı kayıtlı, etkin değil';
        detail = 'Bu sağlayıcıya geçmek için “Kaydet ve kullan”a basın.';
    } else {
        state = 'saved';
        title = 'Kayıtlı ve etkin';
        detail = 'Düzeltme kayıtlı sağlayıcı ve model seçiminizi kullanır. Bağlantı testi ayrıca yapılır.';
    }
    wrapper.dataset.state = state;
    element('connection-save-title').textContent = title;
    element('connection-save-detail').textContent = detail;
    const model = displayedModel(entry, saved);
    element('usage-note').textContent = !saved
        ? 'Bu sağlayıcının kayıtlı bağlantısı yok. Önce seçiminizi kaydedin.'
        : !model ? 'Kayıtlı bağlantıda model seçilmedi. Önce bir model seçip kaydedin; test kayıtlı seçimleri kullanır.'
        : 'Test, kayıtlı ' + entry.name + ' / ' + model + ' bağlantısını kullanır. Kaydedilmemiş değişiklikler testte kullanılmaz.' + (entry.local === true ? '' : ' API kullanımı ücret doğurabilir.');
}
function connectionChanged() {
    connectionRevision += 1;
    element('connection-status').hidden = true;
    updateDestination();
    updateConnectionSaveState();
}
function normalizedPrompt(value) {
    const prompt = String(value || '').trim();
    return !prompt || prompt === defaultPrompt.trim() ? '' : prompt;
}
function updatePromptSaveState() {
    const status = element('prompt-save-state');
    if (!status || !defaultPrompt) return;
    const changed = normalizedPrompt(element('system-prompt').value) !== savedPrompt;
    status.dataset.state = changed ? 'draft' : 'saved';
    status.textContent = changed ? 'Kurallar değişti; kalıcı olması için “Kuralları kaydet”e basın.' : savedPrompt ? 'Özel kurallar kayıtlı.' : 'Varsayılan kurallar kullanılıyor.';
}
function promptChanged() {
    promptRevision += 1;
    element('status').hidden = true;
    updatePromptSaveState();
}
function collectProfile() {
    const profile = { ...profileFor(currentEntry()), model: element('provider-model').value.trim(), apiKey: currentEntry().usesAPIKey === false || currentEntry().authType === 'none' ? '' : element('openai-key').value.trim() };
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
        input.addEventListener('input', connectionChanged);
        input.addEventListener('change', connectionChanged);
        label.htmlFor = input.id;
        label.textContent = field.label + (field.required ? ' *' : '');
        group.append(label, input);
        element('provider-fields').append(group);
    });
}
function localEndpoint(id = selectedId) {
    const entry = providers.find(provider => provider.id === id);
    if (entry?.local !== true || entry.authType !== 'none') throw new Error('Model keşfi için bir yerel sağlayıcı seçin.');
    const resolved = ProviderService.resolveProfile(id, { baseURL: element('base-url').value.trim(), model: '' });
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(resolved.baseURL).hostname)) throw new Error('Yerel modeller için localhost veya loopback sunucu adresi kullanın.');
    return resolved.baseURL;
}
function currentModels() {
    const entry = currentEntry();
    const discovered = discoveredModels.get(selectedId);
    if (entry.local === true) {
        try { return discovered?.baseURL === localEndpoint() ? discovered.models : []; }
        catch { return []; }
    }
    return discovered?.models || entry.models || [];
}
function renderModels() {
    const entry = currentEntry();
    const models = currentModels().filter(model => model.selectable !== false);
    modelPicker?.refresh();
    element('model-help').textContent = entry.local === true
        ? models.length ? models.length.toLocaleString('tr') + ' yerel model bulundu. Listeden seçin veya kendi model adınızı yazın; ardından kaydedin.' : '“Modelleri getir” ile bu sunucudaki modelleri bulun. Tam model adını elle de yazabilirsiniz.'
        : models.length ? models.length.toLocaleString('tr') + ' model seçeneği. Listeden seçin veya kendi model/deployment adınızı yazın.' : 'Sağlayıcıdaki metin modelinin tam adını girin.';
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
function selectProvider(id, remember = true, event) {
    if (remember && loaded) drafts.set(selectedId, collectProfile());
    discoveryGeneration += 1;
    connectionRevision += 1;
    modelPicker?.close();
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
    element('provider-key-group').hidden = noKey || entry.usesAPIKey === false;
    element('openai-key').disabled = noKey;
    element('toggle-key').disabled = noKey;
    element('key-label').textContent = entry.authType === 'bearer' ? 'Erişim belirteci / Bearer anahtarı' : noKey ? 'API anahtarı gerekmiyor' : 'API anahtarı';
    const local = entry.local === true;
    element('provider-model').placeholder = local ? 'Yüklü model seçin veya adını yazın' : 'Model seçin veya adını yazın';
    element('base-url').value = profile.baseURL || (local ? entry.baseURL : '');
    element('advanced-settings').open = local || id === 'custom' || entry.requiresBaseURL === true;
    element('connection-settings-title').textContent = local ? 'Yerel sunucu bağlantısı' : 'Gelişmiş bağlantı ayarları';
    element('base-url-label').textContent = local ? 'Yerel sunucu adresi' : 'API adresi';
    element('endpoint-help').textContent = local ? 'Sunucunun OpenAI uyumlu API adresini /v1 ile birlikte yazın. Ollama veya llama.cpp çalışıyor olmalı. Chrome izni yalnız seçtiğiniz adres için istenir.' : 'Boş bırakmak sağlayıcının adresini kullanır. Özel ağ geçitleri için HTTPS, yerel modeller için localhost veya 127.0.0.1 kullanın. İzin yalnız seçilen alan için istenir.';
    element('base-url').placeholder = entry.baseURL || 'https://…/v1';
    element('protocol-group').hidden = id !== 'custom';
    element('provider-protocol').value = profile.protocol || 'openai-chat';
    element('provider-auth').value = profile.authType || 'bearer';
    element('provider-note').textContent = id === 'ollama'
        ? 'Model listesi bilgisayarınızdaki Ollama’dan alınır. Listeden seçin veya model adını yazın.'
        : id === 'llamacpp' ? 'Model listesi yerel llama.cpp sunucunuzdan alınır. Listeden seçin veya model adını yazın.'
        : [entry.supportNote, entry.authSupportNote].filter(Boolean).join(' ') || 'API anahtarınızı sağlayıcının hesabından alın. Metin modelinin tam adıyla bağlantıyı kaydedin.';
    renderFields(entry, profile);
    renderModels();
    updateLocalGuide();
    updateDestination();
    updateConnectionSaveState();
    document.querySelectorAll('[data-provider]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.provider === id)));
    element('connection-status').hidden = true;
    updateButtons();
    if (local && entry.authType === 'none' && loaded && event?.isTrusted) discoverLocalModels({ requestPermission: true });
}
function updateButtons() {
    const unsupported = currentEntry().selectable === false;
    ['save-api-btn', 'test-btn', 'refresh-models', 'model-toggle'].forEach(id => { element(id).disabled = busy || !loaded || unsupported; });
    // Avoid a provider switch while a saved test or permission request is in flight.
    element('provider-select').disabled = busy || !loaded;
    element('provider-search').disabled = busy || !loaded;
    element('provider-model').disabled = !loaded || unsupported;
    if (busy) providerPicker?.close();
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
        if (chrome.runtime.lastError || !allowed) {
            const error = new Error('Bağlantı izni verilmedi. Ayarlar değiştirilmedi. İzin vererek yeniden deneyin.');
            error.code = 'permission';
            reject(error);
        }
        else resolve();
    }));
}
function hasOrigin(id, profile) {
    const origins = ProviderService.getPermissionOrigins(id, profile);
    return new Promise((resolve, reject) => chrome.permissions.contains({ origins }, allowed => {
        if (chrome.runtime.lastError) {
            const error = new Error('Bağlantı izni kontrol edilemedi. “Modelleri getir” ile yeniden deneyin.');
            error.code = 'permission';
            reject(error);
        }
        else resolve(allowed);
    }));
}
function updateLocalGuide(state = 'ready', count = 0, errorCode) {
    element('local-setup').hidden = selectedId !== 'ollama';
    if (selectedId !== 'ollama') return;
    element('local-setup').dataset.state = state;
    element('local-setup-details').open = state === 'error' || state === 'empty';
    element('local-copy-status').hidden = true;
    element('local-setup-state').textContent = state === 'loading' ? 'Sunucunuzdaki model listesi alınıyor…'
        : state === 'success' ? count.toLocaleString('tr') + ' model bulundu. Modeli seçin, ardından “Kaydet ve kullan”a basın.'
        : state === 'empty' ? 'Sunucuda metin modeli bulunamadı. Yüklü modellerinizi kontrol edin.'
        : state === 'error' ? ['permission', 'host_permission', 'local_access'].includes(errorCode) ? 'Eklenti bağlantı iznini ve aşağıdaki izinli başlatma komutunu kontrol edin.' : 'Aşağıdaki izinli komutla Ollama’yı çalıştırın; terminali açık tutup “Modelleri getir”e basın.'
        : 'İzinli komutla sunucuyu çalıştırın, modeli seçip kaydedin.';
}
function validModelList(models) {
    if (!Array.isArray(models)) throw new Error('Model listesi okunamadı.');
    return models.filter(model => typeof model?.id === 'string' && model.id.trim()).map(model => ({ ...model, name: typeof model.name === 'string' && model.name ? model.name : model.id }));
}
function isCurrentDiscovery(owner) {
    if (owner.generation !== discoveryGeneration || owner.id !== selectedId) return false;
    try { return localEndpoint() === owner.baseURL; }
    catch { return false; }
}
async function discoverLocalModels({ requestPermission = false, openList = true } = {}) {
    if (!loaded || busy || currentEntry().local !== true) return;
    let owner;
    let permission;
    try {
        owner = { generation: ++discoveryGeneration, id: selectedId, baseURL: localEndpoint() };
        // A trusted choice or refresh starts the permission request before the first await.
        permission = requestPermission ? requestOrigin(owner.id, { baseURL: owner.baseURL, model: '' }) : hasOrigin(owner.id, { baseURL: owner.baseURL, model: '' });
    } catch (error) {
        showStatus(error.message, 'error');
        updateLocalGuide('error', 0, error.code);
        return;
    }
    localRequestOwner = owner;
    setBusy(true, 'refresh-models');
    updateLocalGuide('loading');
    showStatus('Yerel sunucudaki model listesi alınıyor…');
    try {
        const allowed = await permission;
        if (!isCurrentDiscovery(owner)) return;
        if (!requestPermission && !allowed) {
            element('connection-status').hidden = true;
            updateLocalGuide();
            return;
        }
        const result = await message({ action: 'discoverLocalModels', providerId: owner.id, baseURL: owner.baseURL });
        if (!isCurrentDiscovery(owner)) return;
        const models = validModelList(result.models);
        discoveredModels.set(owner.id, { baseURL: owner.baseURL, models });
        renderModels();
        const count = models.filter(model => model.selectable !== false).length;
        updateLocalGuide(count ? 'success' : 'empty', count);
        showStatus(count ? count.toLocaleString('tr') + ' yerel model bulundu. Listeden seçip kaydedin.' + (result.truncated ? ' Liste kısaltıldı; tam model adını elle de yazabilirsiniz.' : '') : 'Bu sunucuda yüklü metin modeli bulunamadı. Model adını elle girebilir veya sunucudaki modellerinizi kontrol edebilirsiniz.', count ? 'success' : 'info');
        if (openList && count) modelPicker.open({ all: true, focus: false });
    } catch (error) {
        if (!isCurrentDiscovery(owner)) return;
        discoveredModels.delete(owner.id);
        renderModels();
        showStatus(error.message, 'error');
        updateLocalGuide('error', 0, error.code);
    } finally {
        if (localRequestOwner === owner) {
            localRequestOwner = null;
            setBusy(false);
        }
    }
}
function invalidateLocalModels() {
    if (currentEntry().local !== true) return;
    discoveryGeneration += 1;
    discoveredModels.delete(selectedId);
    modelPicker.close();
    // A request for the previous draft address can finish, but cannot update this page.
    if (localRequestOwner) {
        localRequestOwner = null;
        setBusy(false);
    }
    renderModels();
    updateLocalGuide();
    element('connection-status').hidden = true;
}
function refreshModels(event) {
    if (!event.isTrusted || !loaded || busy) return;
    if (currentEntry().local === true) discoverLocalModels({ requestPermission: true });
    else useSavedConnection(event, 'listProviderModels');
}
async function copyCommand(event) {
    if (!event.isTrusted) return;
    const button = event.currentTarget;
    const status = element('local-copy-status');
    const label = button.querySelector('.copy-label');
    const command = element(button.dataset.copyCommand).textContent;
    const previous = copyFeedback.get(button);
    if (previous?.timer) clearTimeout(previous.timer);
    const feedback = { generation: (previous?.generation || 0) + 1, timer: null };
    copyFeedback.set(button, feedback);
    try {
        await navigator.clipboard.writeText(command);
        if (copyFeedback.get(button) !== feedback) return;
        if (label) label.textContent = 'Kopyalandı';
        button.dataset.copyState = 'success';
        status.textContent = command.includes('<model-adı>')
            ? 'Komut kopyalandı. Çalıştırmadan önce <model-adı> yerine kullanacağınız modelin adını yazın.'
            : button.dataset.copyCommand === 'ollama-origin-command' ? 'İzinli komut kopyalandı. Terminalde çalıştırın ve terminali açık tutun.'
            : 'Komut kopyalandı. Terminale yapıştırabilirsiniz.';
    } catch {
        if (copyFeedback.get(button) !== feedback) return;
        if (label) label.textContent = 'Yeniden dene';
        button.dataset.copyState = 'error';
        status.textContent = 'Kopyalanamadı. Komut metnini seçip elle kopyalayabilirsiniz.';
    }
    status.hidden = false;
    feedback.timer = setTimeout(() => {
        if (copyFeedback.get(button) !== feedback) return;
        if (label) label.textContent = 'Kopyala';
        delete button.dataset.copyState;
        feedback.timer = null;
    }, 2500);
}
async function saveProvider(event) {
    if (!loaded || busy || !event.isTrusted) return;
    let permission;
    let profile;
    const id = selectedId;
    const entry = currentEntry();
    const revision = connectionRevision;
    try {
        profile = collectProfile();
        if (!profile.model && currentEntry().local !== true) throw new Error('Bir metin modeli veya deployment adı girin.');
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
        savedProviderIds = new Set(Object.keys(fresh.providers));
        drafts.set(id, profile);
        if (id === 'openai') {
            if (profile.apiKey) await localSet({ [STORAGE_KEYS.OPENAI_KEY]: profile.apiKey });
            else await localRemove([STORAGE_KEYS.OPENAI_KEY]);
        }
        await updateSummary();
        if (id !== selectedId || revision !== connectionRevision) return;
        if (entry.local === true && !profile.model) {
            showStatus('Sunucu adresi kaydedildi; model seçilmedi. “Modelleri getir” ile modeli seçip “Kaydet ve kullan”a basın. Düzeltme için model seçimi gerekiyor.', 'info');
        } else if (!profileComplete(entry, profile)) {
            showStatus('Bağlantı kaydedildi. Düzeltme için eksik giriş bilgilerini tamamlayıp yeniden kaydedin.', 'info');
        } else {
            showStatus(entry.name + ' bağlantısı kaydedildi ve etkin. Bağlantıyı test ederek model erişimini doğrulayabilirsiniz.', 'success');
        }
    } catch (error) { if (id === selectedId && revision === connectionRevision) showStatus(error.message, 'error'); }
    finally { updateConnectionSaveState(); setBusy(false); }
}
async function useSavedConnection(event, action) {
    if (!loaded || busy || !event.isTrusted) return;
    const id = selectedId;
    const revision = connectionRevision;
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
        if (id !== selectedId || revision !== connectionRevision) return;
        if (isTest) {
            if (result.success !== true) throw new Error('Testten geçerli bir düzeltme yanıtı alınamadı.');
            showStatus('Bağlantı başarılı. Kaydedilmiş sağlayıcı ve model ile test tamamlandı.', 'success');
        } else {
            discoveredModels.set(id, { models: validModelList(result.models) });
            renderModels();
            showStatus(result.models.length.toLocaleString('tr') + ' model ' + (result.source === 'catalog' ? 'yerleşik katalogdan gösteriliyor; sağlayıcı ayrı model listesi sunmuyor.' : 'sağlayıcıdan alındı.') + (result.truncated ? ' Liste kısaltıldı; diğer model adlarını elle girebilirsiniz.' : ''), 'success');
            modelPicker.open({ all: true, focus: false });
        }
    } catch (error) {
        if (id !== selectedId || revision !== connectionRevision) return;
        showStatus(error.message, 'error');
        if (currentEntry().local === true) updateLocalGuide('error', 0, error.code);
    }
    finally { setBusy(false); }
}
async function savePrompt() {
    if (!loaded) return;
    const button = element('save-prompt-btn');
    const revision = promptRevision;
    const prompt = normalizedPrompt(element('system-prompt').value);
    button.disabled = true;
    try {
        if (!defaultPrompt) throw new Error('Varsayılan kurallar alınamadı. Sayfayı yeniden açın.');
        if (!prompt) {
            await localRemove([STORAGE_KEYS.CUSTOM_PROMPT]);
        } else {
            await localSet({ [STORAGE_KEYS.CUSTOM_PROMPT]: prompt });
        }
        savedPrompt = prompt;
        if (revision === promptRevision) showStatus(prompt ? 'Düzeltme kuralları bu Chrome profilinde kaydedildi.' : 'Varsayılan kurallar kullanılacak. Gelecekteki kural güncellemeleri otomatik uygulanır.', 'success', 'status');
    } catch (error) { if (revision === promptRevision) showStatus(error.message, 'error', 'status'); }
    finally { updatePromptSaveState(); button.disabled = false; }
}
async function loadSettings() {
    document.querySelectorAll('[data-product-link]').forEach(link => { link.href = PRODUCT_CONFIG[link.dataset.productLink]; });
    element('version-label').textContent = 'Sürüm ' + chrome.runtime.getManifest().version;
    element('catalog-count').textContent = PROVIDER_CATALOG.providers.length + ' sağlayıcı kaydı';
    element('ollama-origin-command').textContent = 'OLLAMA_ORIGINS=chrome-extension://' + chrome.runtime.id + ' ollama serve';
    updateButtons();
    try {
        const values = await localGet(Object.values(STORAGE_KEYS));
        config = readConfig(values);
        savedProviderIds = new Set(values[STORAGE_KEYS.CONFIG] != null ? Object.keys(config.providers)
            : typeof values[STORAGE_KEYS.OPENAI_KEY] === 'string' && values[STORAGE_KEYS.OPENAI_KEY] ? ['openai'] : []);
        if (!providers.some(provider => provider.id === config.activeProviderId)) throw new Error('Etkin sağlayıcı katalogda bulunamadı. Mevcut kayıt değiştirilmedi.');
        selectedId = config.activeProviderId;
        selectProvider(selectedId, false);
        const initialId = selectedId;
        let initialURL = null;
        if (currentEntry().local === true) { try { initialURL = localEndpoint(); } catch { /* Keep invalid saved endpoints editable. */ } }
        const response = await message({ action: 'getDefaultPrompt' });
        if (typeof response.prompt !== 'string' || !response.prompt.trim()) throw new Error('Varsayılan kurallar alınamadı. Sayfayı yeniden açın.');
        defaultPrompt = response.prompt;
        element('system-prompt').value = typeof values[STORAGE_KEYS.CUSTOM_PROMPT] === 'string' && values[STORAGE_KEYS.CUSTOM_PROMPT].trim() ? values[STORAGE_KEYS.CUSTOM_PROMPT] : defaultPrompt;
        savedPrompt = normalizedPrompt(element('system-prompt').value);
        loaded = true;
        updateButtons();
        updateConnectionSaveState();
        updatePromptSaveState();
        await updateSummary();
        if (initialId === selectedId && initialURL && localEndpoint() === initialURL) discoverLocalModels({ openList: false });
    } catch (error) { showStatus(error.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', loadSettings);
providerPicker = createPicker({ prefix: 'provider', controlId: 'provider-select', searchId: 'provider-search', items: () => providers, selectedValue: () => selectedId, onSelect: (item, event) => selectProvider(item.id, true, event) });
modelPicker = createPicker({ prefix: 'model', controlId: 'provider-model', searchId: 'provider-model', toggleId: 'model-toggle', items: () => currentModels().filter(model => model.selectable !== false), selectedValue: () => element('provider-model').value.trim(), onSelect: item => {
    element('provider-model').value = item.id;
    renderModels();
    connectionChanged();
} });
document.querySelectorAll('[data-provider]').forEach(button => button.addEventListener('click', event => {
    if (!loaded || busy || !event.isTrusted) return;
    providerPicker.close();
    selectProvider(button.dataset.provider, true, event);
}));
element('provider-model').addEventListener('input', () => { renderModels(); connectionChanged(); });
element('base-url').addEventListener('input', () => { invalidateLocalModels(); connectionChanged(); });
element('openai-key').addEventListener('input', connectionChanged);
element('provider-protocol').addEventListener('change', connectionChanged);
element('provider-auth').addEventListener('change', connectionChanged);
element('toggle-key').addEventListener('click', () => {
    const show = element('openai-key').type === 'password';
    element('openai-key').type = show ? 'text' : 'password';
    element('toggle-key').textContent = show ? 'Gizle' : 'Göster';
    element('toggle-key').setAttribute('aria-pressed', String(show));
});
element('save-api-btn').addEventListener('click', saveProvider);
element('test-btn').addEventListener('click', event => useSavedConnection(event, 'testProvider'));
element('refresh-models').addEventListener('click', refreshModels);
document.querySelectorAll('[data-copy-command]').forEach(button => button.addEventListener('click', copyCommand));
element('system-prompt').addEventListener('input', promptChanged);
element('save-prompt-btn').addEventListener('click', savePrompt);
element('reset-prompt-btn').addEventListener('click', () => {
    if (!defaultPrompt) return;
    element('system-prompt').value = defaultPrompt;
    promptChanged();
    showStatus(savedPrompt ? 'Varsayılan kurallar yüklendi. Kalıcı olması için “Kuralları kaydet” düğmesine basın.' : 'Varsayılan kurallar zaten kullanılıyor.', 'info', 'status');
});
