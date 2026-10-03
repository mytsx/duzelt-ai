(function(root) {
    'use strict';

    const CONFIG_KEY = 'ai_provider_config';
    const PROTOCOLS = new Set(['openai-chat', 'openai-responses', 'anthropic-messages', 'gemini', 'cohere-v2', 'azure-openai', 'bedrock-converse', 'vertex-gemini', 'vertex-anthropic', 'watsonx-chat', 'sap-openai-chat', 'sap-orchestration-v2']);
    const IBM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
    const TIMEOUT_MS = 25000;
    const MAX_OUTPUT_LENGTH = 100000;
    const OUTPUT_INSTRUCTION = 'Yanıtı yalnızca geçerli JSON olarak, {"corrected_text":"<düzeltilmiş metin>"} biçiminde döndür. corrected_text bir metin olmalıdır. Açıklama, Markdown kod bloğu veya ek alan ekleme.';

    function failure(code, message) {
        return new OpenAIProviderError(code, message);
    }

    function registry() {
        return typeof PROVIDER_CATALOG !== 'undefined' ? PROVIDER_CATALOG : root.PROVIDER_CATALOG;
    }

    function catalogEntry(providerId) {
        const entries = registry()?.providers || [];
        const entry = entries.find(item => item.id === providerId);
        if (entry) return entry;
        if (providerId === 'openai' && !entries.length) {
            return { id: 'openai', name: 'OpenAI', protocol: 'openai-chat', authType: 'bearer', baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', selectable: true };
        }
        if (/^custom(?:-[a-z0-9-]+)?$/.test(providerId)) {
            return { id: providerId, name: 'Özel sağlayıcı', protocol: 'openai-chat', authType: 'bearer', selectable: true };
        }
        throw failure('unknown_provider', 'Bu sağlayıcı katalogda bulunamadı. Ayarlardan bir sağlayıcı seçin.');
    }

    function safeField(value, field) {
        if (typeof value !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(value)) {
            throw failure('configuration', field + ' alanını ayarlardan kontrol edin.');
        }
        return value;
    }

    function normalizeURL(value) {
        let url;
        try { url = new URL(value); } catch { throw failure('endpoint', 'Sağlayıcı adresi geçerli bir URL olmalıdır.'); }
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
            throw failure('endpoint', 'Adres HTTPS veya yerel localhost HTTP olmalıdır; kullanıcı bilgisi, sorgu veya # eki içermemelidir. Anahtar yalnız anahtar alanına yazılmalıdır.');
        }
        try { decodeURIComponent(url.pathname); } catch { throw failure('endpoint', 'Sağlayıcı adresi geçerli bir URL olmalıdır.'); }
        if (/[{}$<>]/.test(value) || /%7[bd]/i.test(url.href)) throw failure('endpoint', 'Sağlayıcı adresindeki zorunlu alanları doldurun.');
        return url.href.replace(/\/+$/, '');
    }

    function containsKeyInURL(value, key) {
        if (!key) return false;
        const url = new URL(value);
        return value.includes(key) || decodeURIComponent(url.pathname).includes(key) || url.hostname.toLowerCase().includes(key.toLowerCase());
    }

    function resolveProfile(providerId, profile = {}) {
        const entry = catalogEntry(providerId);
        if (entry.selectable === false || ['oauth', 'subscription', 'unsupported', 'aws-sigv4'].includes(entry.authType)) {
            throw failure('unsupported_auth', 'Bu sağlayıcının oturum veya bulut kimlik doğrulaması doğrudan desteklenmiyor. Katalogdaki açıklamayı kontrol edin.');
        }
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw failure('configuration', 'Sağlayıcı ayarları geçersiz.');
        const model = typeof profile.model === 'string' ? profile.model.trim() : entry.defaultModel || (providerId === 'openai' ? 'gpt-4o' : '');
        const modelEntry = entry.models?.find(item => item.id === model);
        if (modelEntry?.selectable === false) throw failure('unsupported_protocol', 'Bu modelin sağlayıcı protokolü henüz desteklenmiyor. Başka bir metin modeli seçin.');
        let protocol = profile.protocol || modelEntry?.protocol || entry.protocol || 'openai-chat';
        const isIAM = providerId === 'watsonx' || protocol === 'watsonx-chat';
        const isSAP = providerId === 'sap-ai-core' || /^sap-/.test(protocol);
        if (isIAM) {
            if (profile.protocol && profile.protocol !== 'watsonx-chat' || profile.authType && profile.authType !== 'iam') throw failure('unsupported_auth', 'IBM watsonx için IBM IAM anahtar değişimi kullanılmalıdır.');
            protocol = 'watsonx-chat';
        }
        if (isSAP) {
            if (profile.authType && profile.authType !== 'oauth-client-credentials') throw failure('unsupported_auth', 'SAP AI Core için client credentials kimlik doğrulaması kullanılmalıdır.');
            if (profile.protocol && !['sap-openai-chat', 'sap-orchestration-v2'].includes(profile.protocol)) throw failure('unsupported_protocol', 'SAP deployment türünü ayarlardan seçin.');
            if (profile.sapMode && !['openai', 'orchestration'].includes(profile.sapMode)) throw failure('configuration', 'SAP deployment türünü ayarlardan seçin.');
            protocol = profile.sapMode === 'openai' ? 'sap-openai-chat' : profile.sapMode === 'orchestration' ? 'sap-orchestration-v2' : profile.protocol || entry.protocol;
            if (protocol === 'sap-openai-chat' && modelEntry && !/^(?:gpt|chatgpt|openai--|o[134](?:$|[-.]))/.test(model)) throw failure('unsupported_protocol', 'Bu model ailesi için SAP orkestrasyon deployment türünü seçin.');
        }
        const isVertex = /^google-vertex(?:-|$)/.test(providerId) || /^vertex-/.test(protocol);
        const isAzure = /^azure(?:-|$)/.test(providerId) || protocol === 'azure-openai';
        if (isVertex && !profile.protocol && /^claude/.test(model)) protocol = 'vertex-anthropic';
        if (!PROTOCOLS.has(protocol)) throw failure('unsupported_protocol', 'Bu sağlayıcının API protokolü henüz desteklenmiyor.');
        const region = profile.region || profile.location || entry.region || (providerId === 'amazon-bedrock' || protocol === 'bedrock-converse' ? 'us-east-1' : isVertex ? 'us-central1' : '');
        let baseURL = typeof profile.baseURL === 'string' && profile.baseURL.trim() ? profile.baseURL.trim() : modelEntry?.baseURL || entry.baseURL;
        if (isAzure && !baseURL) baseURL = 'https://' + safeField(profile.resourceName, 'Kaynak adı') + '.openai.azure.com/openai/v1';
        if (protocol === 'bedrock-converse' && !baseURL) baseURL = 'https://bedrock-runtime.' + safeField(region, 'Bölge') + '.amazonaws.com';
        if (isVertex && !baseURL) baseURL = 'https://' + (region === 'global' ? '' : safeField(region, 'Bölge') + '-') + 'aiplatform.googleapis.com/v1';
        if (isIAM && !baseURL) baseURL = 'https://us-south.ml.cloud.ibm.com';
        if (typeof baseURL !== 'string' || !baseURL) throw failure('endpoint', 'Bu sağlayıcı için API adresini ayarlardan girin.');
        const replacements = {
            region, location: region, resourceName: profile.resourceName, resource_name: profile.resourceName,
            accountId: profile.accountId, account_id: profile.accountId, gatewayId: profile.gatewayId, gateway_id: profile.gatewayId,
            projectId: profile.projectId, project_id: profile.projectId, account: profile.account,
            host: profile.host, productId: profile.productId,
            AZURE_RESOURCE_NAME: profile.resourceName, AZURE_COGNITIVE_SERVICES_RESOURCE_NAME: profile.resourceName,
            vertexEndpoint: profile.vertexEndpoint || (region === 'global' ? '' : region + '-') + 'aiplatform.googleapis.com'
        };
        baseURL = baseURL.replace(/\{([a-zA-Z_]+)\}/g, (match, key) => {
            if (key === 'gatewayBaseURL') return normalizeURL(profile.gatewayBaseURL);
            if (!Object.prototype.hasOwnProperty.call(replacements, key)) throw failure('endpoint', 'Sağlayıcı adresindeki alanlar geçersiz. Katalog adresini veya doğrudan API adresini kullanın.');
            return safeField(replacements[key], key);
        });
        // SDK katalogları tam publisher/endpoints kökü verebilir; adaptör tek yolu üretir.
        if (isVertex) {
            baseURL = baseURL.replace(/\/projects\/[^/]+\/locations\/[^/]+\/(?:publishers\/(?:google|anthropic)|endpoints\/openapi)\/?$/, '');
            if (region === 'global') baseURL = baseURL.replace('https://global-aiplatform.googleapis.com', 'https://aiplatform.googleapis.com');
        }
        baseURL = normalizeURL(baseURL);
        let tokenURL;
        if (isIAM) {
            if (profile.tokenURL && profile.tokenURL !== IBM_TOKEN_URL) throw failure('configuration', 'IBM IAM token adresi değiştirilemez.');
            tokenURL = IBM_TOKEN_URL;
            if (Boolean(profile.projectId) === Boolean(profile.spaceId)) throw failure('configuration', 'IBM için yalnız bir proje kimliği veya space kimliği girin.');
            safeField(profile.projectId || profile.spaceId, 'Proje / space kimliği');
        }
        if (isSAP) {
            tokenURL = normalizeURL(profile.tokenURL);
            if (!new URL(tokenURL).pathname.endsWith('/oauth/token')) throw failure('endpoint', 'SAP token adresi hizmet anahtarındaki URL ile /oauth/token yolunu içermelidir.');
            safeField(profile.deploymentId, 'Deployment kimliği');
            safeField(profile.resourceGroup, 'Kaynak grubu');
            const deploymentPath = new URL(baseURL).pathname.match(/\/v2\/inference\/deployments\/([^/]+)$/);
            if (deploymentPath && decodeURIComponent(deploymentPath[1]) !== profile.deploymentId) throw failure('configuration', 'SAP deployment URL ve deployment kimliği uyuşmuyor.');
        }
        const key = typeof profile.apiKey === 'string' ? profile.apiKey.trim() : '';
        const clientSecret = typeof profile.clientSecret === 'string' ? profile.clientSecret.trim() : '';
        if ([key, clientSecret].some(secret => containsKeyInURL(baseURL, secret) || tokenURL && containsKeyInURL(tokenURL, secret) || secret && model.includes(secret))) {
            throw failure('endpoint', 'API anahtarı sağlayıcı adresinde bulunamaz. Anahtarı yalnız anahtar alanına yazın.');
        }
        const authType = isIAM ? 'iam' : isSAP ? 'oauth-client-credentials' : profile.authType || entry.authType || 'bearer';
        if (!['bearer', 'api-key', 'none', 'iam', 'oauth-client-credentials'].includes(authType)) throw failure('unsupported_auth', 'Seçilen kimlik doğrulama yöntemi desteklenmiyor.');
        if (!isIAM && !isSAP && ['iam', 'oauth-client-credentials'].includes(authType)) throw failure('unsupported_auth', 'Bu kimlik doğrulama yöntemi seçilen sağlayıcıyla uyuşmuyor.');
        if (authType === 'none' && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname) && entry.authType !== 'none') {
            throw failure('authentication', 'Bu sağlayıcı için API anahtarı veya erişim tokenı gereklidir.');
        }
        return { providerId, name: entry.name, entry, model, protocol, authType, baseURL, tokenURL, region, profile, isAzure, isVertex, isIAM, isSAP };
    }

    function getPermissionOrigin(providerId, profile) {
        const resolved = resolveProfile(providerId, profile);
        return new URL(resolved.baseURL).origin + '/*';
    }

    function permissionOrigins(resolved) {
        return Array.from(new Set([resolved.baseURL, resolved.tokenURL].filter(Boolean).map(value => new URL(value).origin + '/*')));
    }

    function getPermissionOrigins(providerId, profile) {
        return permissionOrigins(resolveProfile(providerId, profile));
    }

    async function loadSavedConfiguration() {
        const values = await new Promise((resolve, reject) => {
            chrome.storage.local.get([CONFIG_KEY, 'openai_api_key', 'custom_system_prompt'], result => {
                if (chrome.runtime.lastError || !result) {
                    reject(failure('storage', 'Kaydedilmiş sağlayıcı ayarları okunamadı. Ayarları yeniden açın.'));
                } else resolve(result);
            });
        });
        let config = values[CONFIG_KEY];
        if (config === undefined || config === null) {
            config = { version: 1, activeProviderId: 'openai', providers: { openai: { model: 'gpt-4o', apiKey: values.openai_api_key || '' } } };
        }
        if (config.version !== 1 || typeof config.activeProviderId !== 'string' || !config.providers || typeof config.providers !== 'object' || Array.isArray(config.providers)) {
            throw failure('configuration', 'Sağlayıcı ayarları geçersiz. Ayarlardan yeniden kaydedin.');
        }
        return { config, systemPrompt: typeof values.custom_system_prompt === 'string' ? values.custom_system_prompt : null };
    }

    async function ensurePermission(resolved) {
        const origins = permissionOrigins(resolved);
        if (!chrome.permissions || typeof chrome.permissions.contains !== 'function') {
            if (origins.length === 1 && origins[0] === 'https://api.openai.com/*') return;
            throw failure('host_permission', 'Sağlayıcı bağlantı izni bulunamadı. Ayarlardan bu adres için izin verin.');
        }
        const allowed = await new Promise(resolve => chrome.permissions.contains({ origins }, result => {
            const permissionError = chrome.runtime.lastError;
            resolve(!permissionError && result === true);
        }));
        if (!allowed) throw failure('host_permission', 'Bu sağlayıcı adresi için bağlantı izni gerekiyor. Ayarlardan izin verip yeniden deneyin.');
    }

    function keyFor(resolved) {
        if (resolved.authType === 'none') return '';
        if (resolved.isSAP) {
            credentialFor(resolved.profile.clientId, 'Client ID');
            return credentialFor(resolved.profile.clientSecret, 'Client secret');
        }
        return credentialFor(resolved.profile.apiKey, 'API anahtarı / erişim tokenı');
    }

    function credentialFor(value, field) {
        const key = typeof value === 'string' ? value.trim() : '';
        if (!key) throw failure('missing_key', field + ' girilmemiş. Ayarlardan kaydedin.');
        if (key.length > 16384 || !/^[\x21-\x7E]+$/.test(key)) throw failure('invalid_key', field + ' geçersiz karakter veya boşluk içeriyor. Ayarlardan kontrol edin.');
        return key;
    }

    function headersFor(resolved, key) {
        const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
        if (key) {
            if (resolved.entry.authHeader === 'cf-aig-authorization') headers.set('cf-aig-authorization', 'Bearer ' + key);
            else if (resolved.isAzure && resolved.authType === 'api-key') headers.set('api-key', key);
            else if (resolved.protocol === 'gemini') headers.set('x-goog-api-key', key);
            else if (resolved.protocol === 'anthropic-messages' && resolved.authType === 'api-key') headers.set('x-api-key', key);
            else headers.set('Authorization', 'Bearer ' + key);
        }
        if (resolved.protocol === 'anthropic-messages') headers.set('anthropic-version', '2023-06-01');
        if (resolved.isSAP) headers.set('AI-Resource-Group', safeField(resolved.profile.resourceGroup, 'Kaynak grubu'));
        return headers;
    }

    function buildCorrectionRequest(resolved, text, systemPrompt) {
        if (typeof text !== 'string' || !text.trim() || text.length > MAX_OUTPUT_LENGTH) throw failure('empty_text', 'Düzeltilecek metin boş veya çok uzun.');
        if (!resolved.model || resolved.model.length > 256 || /[\u0000-\u001f\u007f]/.test(resolved.model)) throw failure('model', 'Sağlayıcı için bir metin modeli veya deployment adı seçin.');
        const requestModel = resolved.isAzure && typeof resolved.profile.deploymentName === 'string' && resolved.profile.deploymentName.trim()
            ? resolved.profile.deploymentName.trim() : resolved.model;
        if (requestModel.length > 256 || /[\u0000-\u001f\u007f]/.test(requestModel)) throw failure('model', 'Deployment adı geçersiz. Ayarlardan kontrol edin.');
        const savedKey = typeof resolved.profile.apiKey === 'string' ? resolved.profile.apiKey.trim() : '';
        if (savedKey && requestModel.includes(savedKey)) throw failure('configuration', 'Anahtarı yalnız anahtar alanına yazın; model veya deployment adı alanına yazmayın.');
        const system = (typeof systemPrompt === 'string' && systemPrompt.trim() ? systemPrompt : OpenAIProvider.DEFAULT_SYSTEM_PROMPT) + '\n\n' + OUTPUT_INSTRUCTION;
        const messages = [{ role: 'system', content: system }, { role: 'user', content: text }];
        const modelEntry = resolved.entry.models?.find(item => item.id === resolved.model);
        const tokenLimit = Math.min(8192, modelEntry?.output || 8192);
        let url = resolved.baseURL;
        let body;
        switch (resolved.protocol) {
            case 'openai-chat':
            case 'azure-openai':
                body = { model: requestModel, messages, stream: false };
                if (resolved.providerId === 'openai' && resolved.model === 'gpt-4o') body.temperature = 0.3;
                if (resolved.providerId === 'openai' && resolved.model === 'gpt-4o' || ['openai', 'openrouter'].includes(resolved.providerId) && modelEntry?.structuredOutput === true || resolved.entry.jsonMode === true) body.response_format = { type: 'json_object' };
                if (resolved.providerId === 'openai') body.store = false;
                if (resolved.isAzure && /\/models$/.test(resolved.baseURL)) {
                    url += '/chat/completions?api-version=' + encodeURIComponent(safeField(resolved.profile.apiVersion || '2024-05-01-preview', 'API sürümü'));
                } else if (resolved.isAzure && resolved.profile.apiVersion) {
                    const version = safeField(resolved.profile.apiVersion, 'API sürümü');
                    url = new URL(resolved.baseURL).origin + '/openai/deployments/' + encodeURIComponent(requestModel) + '/chat/completions?api-version=' + encodeURIComponent(version);
                } else if (resolved.isVertex) {
                    body.messages = [{ role: 'user', content: system + '\n\nDüzeltilecek metin:\n' + text }];
                    body.max_tokens = tokenLimit;
                    url += '/projects/' + safeField(resolved.profile.projectId, 'Proje') + '/locations/' + safeField(resolved.region, 'Bölge') + '/endpoints/openapi/chat/completions';
                } else url += '/chat/completions';
                break;
            case 'openai-responses':
                body = { model: requestModel, input: messages, stream: false, store: false };
                if (resolved.providerId === 'openai' && modelEntry?.structuredOutput === true) body.text = { format: { type: 'json_object' } };
                if (resolved.isVertex) url += '/projects/' + safeField(resolved.profile.projectId, 'Proje') + '/locations/' + safeField(resolved.region, 'Bölge') + '/endpoints/openapi/responses';
                else url += '/responses';
                break;
            case 'anthropic-messages':
            case 'vertex-anthropic':
                body = { system, messages: [{ role: 'user', content: text }], max_tokens: tokenLimit, stream: false };
                if (resolved.protocol === 'vertex-anthropic') {
                    body.anthropic_version = 'vertex-2023-10-16';
                    url += '/projects/' + safeField(resolved.profile.projectId, 'Proje') + '/locations/' + safeField(resolved.region, 'Bölge') + '/publishers/anthropic/models/' + encodeURIComponent(resolved.model) + ':rawPredict';
                } else { body.model = requestModel; url += '/messages'; }
                break;
            case 'gemini':
            case 'vertex-gemini':
                body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseMimeType: 'application/json' } };
                if (resolved.protocol === 'vertex-gemini') url += '/projects/' + safeField(resolved.profile.projectId, 'Proje') + '/locations/' + safeField(resolved.region, 'Bölge') + '/publishers/google/models/' + encodeURIComponent(resolved.model) + ':generateContent';
                else url += '/models/' + encodeURIComponent(resolved.model.replace(/^models\//, '')) + ':generateContent';
                break;
            case 'cohere-v2':
                url += '/chat';
                body = { model: resolved.model, messages, stream: false, response_format: { type: 'json_object' } };
                break;
            case 'bedrock-converse':
                url += '/model/' + encodeURIComponent(resolved.model) + '/converse';
                body = { system: [{ text: system }], messages: [{ role: 'user', content: [{ text }] }], inferenceConfig: { maxTokens: tokenLimit } };
                break;
            case 'watsonx-chat': {
                const version = resolved.profile.apiVersion || '2024-10-08';
                if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) throw failure('configuration', 'IBM API sürümünü YYYY-MM-DD biçiminde girin.');
                url += '/ml/v1/text/chat?version=' + version;
                body = { model_id: resolved.model, messages: messages.map(message => ({ role: message.role, content: message.role === 'system' ? message.content : [{ type: 'text', text: message.content }] })), max_tokens: tokenLimit };
                if (resolved.profile.projectId) body.project_id = safeField(resolved.profile.projectId, 'Proje kimliği');
                else body.space_id = safeField(resolved.profile.spaceId, 'Space kimliği');
                break;
            }
            case 'sap-openai-chat':
            case 'sap-orchestration-v2': {
                const id = safeField(resolved.profile.deploymentId, 'Deployment kimliği');
                if (!/\/v2\/inference\/deployments\/[^/]+$/.test(url)) url += (/\/v2$/.test(url) ? '' : '/v2') + '/inference/deployments/' + encodeURIComponent(id);
                if (resolved.protocol === 'sap-openai-chat') {
                    const version = resolved.profile.apiVersion || (/^o(?:1|3-mini)(?:$|-)/.test(resolved.model) ? '2024-12-01-preview' : '2023-05-15');
                    url += '/chat/completions?api-version=' + encodeURIComponent(safeField(version, 'API sürümü'));
                    body = { messages, stream: false };
                } else {
                    url += '/v2/completion';
                    body = {
                        config: { modules: { prompt_templating: { model: { name: resolved.model, params: {} }, prompt: { template: [{ role: 'system', content: '{{?system}}' }, { role: 'user', content: '{{?text}}' }] } } } },
                        placeholder_values: { system, text }
                    };
                }
                break;
            }
        }
        return { url, body };
    }

    function readOutput(resolved, data) {
        let content;
        let reason;
        switch (resolved.protocol) {
            case 'openai-chat':
            case 'azure-openai':
            case 'watsonx-chat':
            case 'sap-openai-chat':
            case 'sap-orchestration-v2': {
                const result = resolved.protocol === 'sap-orchestration-v2' ? data?.final_result : data;
                const choice = Array.isArray(result?.choices) ? result.choices[0] : null;
                reason = choice?.finish_reason;
                if (choice?.message?.refusal) reason = 'refusal';
                content = choice?.message?.content;
                break;
            }
            case 'openai-responses':
                reason = data?.status === 'completed' ? 'stop' : data?.incomplete_details?.reason || data?.status;
                if (Array.isArray(data?.output)) {
                    const blocks = data.output.filter(item => item.type === 'message').flatMap(item => item.content || []);
                    if (blocks.some(item => item.type === 'refusal')) reason = 'refusal';
                    content = blocks.filter(item => item.type === 'output_text' && typeof item.text === 'string').map(item => item.text).join('');
                }
                break;
            case 'anthropic-messages':
            case 'vertex-anthropic':
                reason = data?.stop_reason;
                content = Array.isArray(data?.content) ? data.content.filter(item => item.type === 'text' && typeof item.text === 'string').map(item => item.text).join('') : null;
                break;
            case 'gemini':
            case 'vertex-gemini': {
                const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
                reason = data?.promptFeedback?.blockReason || candidate?.finishReason;
                content = Array.isArray(candidate?.content?.parts) ? candidate.content.parts.filter(item => typeof item.text === 'string' && !item.thought).map(item => item.text).join('') : null;
                break;
            }
            case 'cohere-v2':
                reason = data?.finish_reason;
                content = Array.isArray(data?.message?.content) ? data.message.content.filter(item => item.type === 'text' && typeof item.text === 'string').map(item => item.text).join('') : null;
                break;
            case 'bedrock-converse':
                reason = data?.stopReason;
                content = Array.isArray(data?.output?.message?.content) ? data.output.message.content.filter(item => typeof item.text === 'string').map(item => item.text).join('') : null;
                break;
        }
        if (['length', 'max_tokens', 'max_output_tokens', 'MAX_TOKENS', 'TIME_LIMIT', 'time_limit'].includes(reason)) throw failure('incomplete_response', 'Sağlayıcı yanıtı tamamlanmadan kesildi. Asıl metin korunuyor; daha kısa metinle deneyin.');
        if (['refusal', 'content_filter', 'SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'guardrail_intervened', 'content_filtered'].includes(reason)) throw failure('refused', 'Sağlayıcı bu metin için düzeltme üretemedi. Asıl metin korunuyor.');
        if (!['stop', 'end_turn', 'stop_sequence', 'STOP', 'COMPLETE'].includes(reason) || typeof content !== 'string') throw failure('invalid_response', 'Sağlayıcı geçerli ve tamamlanmış bir yanıt döndürmedi. Asıl metin korunuyor.');
        let result;
        try { result = JSON.parse(content); } catch { throw failure('invalid_response', 'Sağlayıcının düzeltme yanıtı geçerli JSON değil. Asıl metin korunuyor.'); }
        if (!result || Array.isArray(result) || typeof result.corrected_text !== 'string' || !result.corrected_text.trim() || result.corrected_text.length > MAX_OUTPUT_LENGTH) throw failure('invalid_response', 'Sağlayıcı geçerli bir düzeltilmiş metin döndürmedi. Asıl metin korunuyor.');
        return result.corrected_text;
    }

    function apiError(response, data) {
        const rawCode = data?.error?.code || data?.error?.type || data?.errors?.[0]?.code || data?.code || data?.__type || data?.type;
        if (response.status === 401) return failure('authentication', 'Sağlayıcı anahtarı veya erişim tokenı kabul etmedi. Ayarlardan kontrol edin.');
        if (response.status === 403) return failure('permission', 'Sağlayıcı erişime izin vermedi. Anahtar izinlerini, modeli ve bulut proje erişimini kontrol edin.');
        if (rawCode === 'context_length_exceeded') return failure('text_too_long', 'Metin veya prompt modelin bağlam sınırını aşıyor. Daha kısa metinle deneyin.');
        if (response.status === 402 || ['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded', 'billing_error'].includes(rawCode)) return failure('quota', 'Sağlayıcının kullanım kotası veya bütçe sınırı dolmuş. Hesabınızın bakiye ve sınırlarını kontrol edin.');
        if (response.status === 429 || rawCode === 'ThrottlingException') return failure('rate_limit', 'Sağlayıcının istek sınırına ulaşıldı. Bir süre bekleyip yeniden deneyin.');
        if ([408, 504].includes(response.status)) return failure('timeout', 'Sağlayıcı isteği zaman aşımına uğradı. Yeniden deneyin.');
        if (response.status >= 500) return failure('service', 'Sağlayıcı şu anda yanıt veremiyor. Bir süre sonra yeniden deneyin.');
        if (response.status === 404) return failure('model', 'Model veya API adresi bulunamadı. Model/deployment adını ve adresi kontrol edin.');
        return failure('api', 'Sağlayıcı isteği tamamlanamadı. API adresini, modeli, anahtarı ve promptu kontrol edin.');
    }

    async function requestJSON(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                ...options, signal: controller.signal,
                redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer'
            });
            if (response.redirected) throw failure('redirect', 'Sağlayıcı adresi yönlendirme yaptı. Doğrudan API adresini ayarlardan girin.');
            let data;
            try { data = await response.json(); } catch {
                if (controller.signal.aborted) throw failure('timeout', 'Sağlayıcı isteği zaman aşımına uğradı.');
                if (!response.ok) throw apiError(response, null);
                throw failure('invalid_response', 'Sağlayıcı geçerli JSON yanıtı döndürmedi. Asıl metin korunuyor.');
            }
            if (controller.signal.aborted) throw failure('timeout', 'Sağlayıcı isteği zaman aşımına uğradı.');
            if (!response.ok || data?.error || Array.isArray(data?.errors) && data.errors.length) throw apiError(response, data);
            return data;
        } catch (error) {
            if (controller.signal.aborted) throw failure('timeout', 'Sağlayıcı isteği zaman aşımına uğradı. Lütfen yeniden deneyin.');
            if (error instanceof OpenAIProviderError) throw error;
            throw failure('connection', 'Sağlayıcıya bağlanılamadı. İnternet bağlantısını ve doğrudan API adresini kontrol edin.');
        } finally { clearTimeout(timeoutId); }
    }

    async function accessTokenFor(resolved, credential) {
        if (!resolved.isIAM && !resolved.isSAP) return credential;
        const form = new URLSearchParams();
        if (resolved.isIAM) {
            form.set('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
            form.set('apikey', credential);
        } else {
            form.set('grant_type', 'client_credentials');
            form.set('client_id', credentialFor(resolved.profile.clientId, 'Client ID'));
            form.set('client_secret', credential);
        }
        const data = await requestJSON(resolved.tokenURL, {
            method: 'POST', headers: new Headers({ 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }), body: form.toString()
        });
        const lifetime = Number(data?.expires_in);
        if (typeof data?.access_token !== 'string' || data.access_token.length > 16384 || !/^[\x21-\x7E]+$/.test(data.access_token)
            || typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer' || !Number.isFinite(lifetime) || lifetime <= 0
            || data.expiration !== undefined && (!Number.isFinite(Number(data.expiration)) || Number(data.expiration) * 1000 <= Date.now())) {
            throw failure('authentication_response', 'Sağlayıcı geçerli ve süresi dolmamış bir erişim tokenı döndürmedi. Hizmet kimlik bilgilerini kontrol edin.');
        }
        // Token yalnız bu işlemin belleğindedir; depoya veya yeniden kullanma önbelleğine yazılmaz.
        return data.access_token;
    }

    async function fetchJSON(resolved, url, body) {
        const credential = keyFor(resolved);
        if (new URL(url).origin !== new URL(resolved.baseURL).origin) throw failure('endpoint', 'İstek adresi sağlayıcı adresiyle uyuşmuyor.');
        if ([credential, resolved.profile.apiKey, resolved.profile.clientSecret].some(secret => typeof secret === 'string' && containsKeyInURL(url, secret))) throw failure('endpoint', 'Kimlik bilgileri istek adresinde bulunamaz. Yalnız ilgili kimlik alanlarına yazın.');
        // API ve token originlerinin tamamı onaylanmadan anahtar değişimi başlamaz.
        await ensurePermission(resolved);
        const token = await accessTokenFor(resolved, credential);
        if (containsKeyInURL(url, token)) throw failure('endpoint', 'Erişim tokenı istek adresinde bulunamaz.');
        return requestJSON(url, {
            method: body === undefined ? 'GET' : 'POST', headers: headersFor(resolved, token),
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    }

    async function correctText(text, providerId) {
        const saved = await loadSavedConfiguration();
        const id = providerId || saved.config.activeProviderId;
        const profile = saved.config.providers[id];
        if (!profile) throw failure('configuration', 'Seçilen sağlayıcı henüz kaydedilmemiş. Ayarlardan kaydedin.');
        const resolved = resolveProfile(id, profile);
        const request = buildCorrectionRequest(resolved, text, saved.systemPrompt);
        return readOutput(resolved, await fetchJSON(resolved, request.url, request.body));
    }

    async function listProviderModels(providerId) {
        const saved = await loadSavedConfiguration();
        const id = providerId || saved.config.activeProviderId;
        const profile = saved.config.providers[id];
        if (!profile) throw failure('configuration', 'Seçilen sağlayıcı henüz kaydedilmemiş. Ayarlardan kaydedin.');
        const resolved = resolveProfile(id, profile);
        const modelEntry = resolved.entry.models?.find(item => item.id === resolved.model);
        const path = Object.prototype.hasOwnProperty.call(modelEntry || {}, 'modelListPath')
            ? modelEntry.modelListPath
            : Object.prototype.hasOwnProperty.call(resolved.entry, 'modelListPath') ? resolved.entry.modelListPath
            : ['openai-chat', 'openai-responses', 'anthropic-messages'].includes(resolved.protocol) && !resolved.isAzure && !resolved.isVertex ? '/models' : resolved.protocol === 'gemini' ? '/models' : null;
        if (!path) return { models: (resolved.entry.models || []).map(item => ({ ...item, id: item.id, name: item.name || item.id })), source: 'catalog' };
        if (typeof path !== 'string' || !path.startsWith('/') || path.includes('..') || path.includes('?') || path.includes('#')) throw failure('endpoint', 'Model listesi adresi geçersiz.');
        const data = await fetchJSON(resolved, resolved.baseURL + path);
        const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : null;
        if (!rows) throw failure('invalid_response', 'Sağlayıcının model listesi okunamadı.');
        const models = rows.filter(item => item && typeof (item.id || item.name) === 'string').slice(0, 10000).map(item => {
            const id = String(item.id || item.name).replace(/^models\//, '').slice(0, 256);
            const metadata = resolved.entry.models?.find(model => model.id === id) || {};
            return { ...metadata, id, name: String(item.displayName || item.name || metadata.name || item.id).slice(0, 256) };
        });
        return { models, source: 'provider', truncated: rows.length > models.length || Boolean(data.has_more || data.next_page || data.nextPageToken) };
    }

    async function getProviderStatus() {
        const saved = await loadSavedConfiguration();
        const id = saved.config.activeProviderId;
        try {
            if (!saved.config.providers[id]) throw failure('configuration', 'Sağlayıcı ayarı gerekli.');
            const resolved = resolveProfile(id, saved.config.providers[id]);
            let configured = true;
            try { keyFor(resolved); buildCorrectionRequest(resolved, 'Durum kontrolü.'); } catch { configured = false; }
            return { providerId: id.slice(0, 128), providerName: resolved.name, model: resolved.model, configured, baseURL: resolved.baseURL };
        } catch {
            return { providerId: id.slice(0, 128), providerName: 'Sağlayıcı ayarı gerekli', model: '', configured: false, baseURL: '' };
        }
    }

    root.ProviderService = Object.freeze({ CONFIG_KEY, PROTOCOLS: Object.freeze(Array.from(PROTOCOLS)), resolveProfile, getPermissionOrigin, getPermissionOrigins, loadSavedConfiguration, buildCorrectionRequest, readOutput, fetchJSON, correctText, listProviderModels, getProviderStatus });
})(globalThis);
