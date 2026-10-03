const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const repo = path.resolve(__dirname, '..');
const KEY = 'fixture-key-never-real';
const PRIVATE = 'PRIVATE_INPUT_AND_PROMPT';
const TOKEN = 'fixture-short-lived-bearer-never-real';
const CLIENT_SECRET = 'fixture-client-secret-never-real';
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const reply = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const jsonText = JSON.stringify({ corrected_text: 'Düzeltilmiş metin.\n\nİkinci paragraf.' });

function saved(id, profile) {
    return { ai_provider_config: { version: 1, activeProviderId: id, providers: { [id]: { apiKey: KEY, ...profile } } }, custom_system_prompt: PRIVATE };
}

function harness({ storage = { openai_api_key: KEY }, permission = true, fetchMock, storageError = false } = {}) {
    const calls = [];
    const permissions = [];
    const storageReads = [];
    const storageWrites = [];
    const logs = [];
    const timers = new Map();
    let nextTimer = 0;
    let listener;
    let accessLevel;
    const runtime = { id: 'fixture-extension', getURL: suffix => 'chrome-extension://fixture-extension/' + suffix, lastError: null, onMessage: { addListener: callback => { listener = callback; } } };
    const context = vm.createContext({
        URL, URLSearchParams, Headers, AbortController,
        chrome: {
            runtime,
            storage: { local: {
                get: (keys, callback) => { storageReads.push(plain(keys)); runtime.lastError = storageError ? { message: PRIVATE + KEY } : null; callback(storageError ? undefined : storage); runtime.lastError = null; },
                set: (values, callback) => { storageWrites.push(plain(values)); Object.assign(storage, values); if (callback) callback(); },
                setAccessLevel: (options, callback) => { accessLevel = options.accessLevel; callback(); }
            } },
            permissions: { contains: (options, callback) => { permissions.push(plain(options)); callback(typeof permission === 'function' ? permission(options) : permission); } }
        },
        fetch: async (url, options) => {
            calls.push({ url, options, body: options.body === undefined ? undefined : options.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(options.body)) : JSON.parse(options.body) });
            if (!fetchMock) throw new Error('Test has no network fixture');
            return fetchMock(url, options);
        },
        console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
        setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
        clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(read('lib/provider-catalog.js') + '\nglobalThis.catalog = PROVIDER_CATALOG;', context);
    vm.runInContext(read('background/openai-provider.js'), context);
    vm.runInContext(read('background/provider-service.js'), context);
    context.importScripts = () => {};
    vm.runInContext(read('background/background.js'), context);
    const rpc = (request, sender = { id: runtime.id, url: runtime.getURL('options/options.html') }) => new Promise(resolve => {
        const accepted = listener(request, sender, resolve);
        if (accepted === false || accepted === undefined) resolve(undefined);
    });
    return { service: context.ProviderService, catalog: context.catalog, calls, permissions, storageReads, storageWrites, logs, timers, rpc, context, get accessLevel() { return accessLevel; } };
}

function output(protocol) {
    switch (protocol) {
        case 'openai-chat': case 'azure-openai': case 'watsonx-chat': case 'sap-openai-chat': return { choices: [{ finish_reason: 'stop', message: { content: jsonText } }] };
        case 'sap-orchestration-v2': return { final_result: output('openai-chat'), intermediate_results: { content: PRIVATE } };
        case 'openai-responses': return { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: jsonText }] }] };
        case 'anthropic-messages': case 'vertex-anthropic': return { stop_reason: 'end_turn', content: [{ type: 'text', text: jsonText }] };
        case 'gemini': case 'vertex-gemini': return { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: PRIVATE }, { text: jsonText }] } }] };
        case 'cohere-v2': return { finish_reason: 'COMPLETE', message: { content: [{ type: 'text', text: jsonText }] } };
        case 'bedrock-converse': return { stopReason: 'end_turn', output: { message: { content: [{ text: jsonText }] } } };
        default: throw new Error(protocol);
    }
}

const sapProfile = {
    model: 'gpt-4o', baseURL: 'https://api.ai.fixture.example', deploymentId: 'fixture-deployment', resourceGroup: 'default',
    clientId: 'fixture-client-id!t123', clientSecret: CLIENT_SECRET, tokenURL: 'https://fixture.authentication.example/oauth/token'
};

function tokenReply(overrides = {}) {
    return { access_token: TOKEN, token_type: 'Bearer', expires_in: 3600, expiration: Math.floor(Date.now() / 1000) + 3600, ...overrides };
}

test('IBM IAM ve SAP client credentials iki origin izniyle fresh token alıp yalnız APIye bearer gönderir', async t => {
    const cases = [
        ['watsonx', { model: 'ibm/granite-4-h-small', projectId: 'fixture-project' }, 'watsonx-chat', 'https://iam.cloud.ibm.com/identity/token', 'https://us-south.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-10-08'],
        ['watsonx', { model: 'ibm/granite-4-h-small', spaceId: 'fixture-space', baseURL: 'https://eu-de.ml.cloud.ibm.com' }, 'watsonx-chat', 'https://iam.cloud.ibm.com/identity/token', 'https://eu-de.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-10-08'],
        ['sap-ai-core', { ...sapProfile, model: 'anthropic--claude-4.7-opus' }, 'sap-orchestration-v2', sapProfile.tokenURL, 'https://api.ai.fixture.example/v2/inference/deployments/fixture-deployment/v2/completion'],
        ['sap-ai-core', { ...sapProfile, sapMode: 'openai' }, 'sap-openai-chat', sapProfile.tokenURL, 'https://api.ai.fixture.example/v2/inference/deployments/fixture-deployment/chat/completions?api-version=2023-05-15']
    ];
    for (const [id, profile, protocol, authURL, apiURL] of cases) {
        await t.test(protocol + '/' + (profile.projectId || profile.spaceId || profile.model), async () => {
            const h = harness({ storage: saved(id, profile), fetchMock: async url => reply(url === authURL ? tokenReply() : output(protocol)) });
            const origins = [new URL(apiURL).origin + '/*', new URL(authURL).origin + '/*'];
            assert.deepEqual(plain(h.service.getPermissionOrigins(id, { apiKey: KEY, ...profile })), origins);
            assert.equal(h.service.getPermissionOrigin(id, { apiKey: KEY, ...profile }), origins[0]);
            assert.equal(await h.service.correctText(PRIVATE + ' literal {{?unchanged}}'), 'Düzeltilmiş metin.\n\nİkinci paragraf.');
            assert.deepEqual(h.permissions, [{ origins }]);
            assert.equal(h.calls.length, 2);
            const [auth, api] = h.calls;
            assert.equal(auth.url, authURL);
            assert.equal(api.url, apiURL);
            assert.equal(auth.options.headers.get('authorization'), null);
            assert.equal(auth.options.headers.get('content-type'), 'application/x-www-form-urlencoded');
            assert.equal(api.options.headers.get('authorization'), 'Bearer ' + TOKEN);
            for (const call of h.calls) {
                assert.equal(call.options.redirect, 'error');
                assert.equal(call.options.credentials, 'omit');
                assert.equal(call.options.referrerPolicy, 'no-referrer');
                assert.equal(call.url.includes(KEY) || call.url.includes(TOKEN) || call.url.includes(CLIENT_SECRET), false);
            }
            assert.equal(JSON.stringify(auth.body).includes(PRIVATE), false);
            assert.equal(JSON.stringify(api.body).includes(KEY) || JSON.stringify(api.body).includes(CLIENT_SECRET), false);
            if (id === 'watsonx') {
                assert.deepEqual(auth.body, { grant_type: 'urn:ibm:params:oauth:grant-type:apikey', apikey: KEY });
                assert.equal(api.body.model_id, profile.model);
                assert.equal(api.body.model, undefined);
                assert.equal(api.body.project_id, profile.projectId);
                assert.equal(api.body.space_id, profile.spaceId);
                assert.equal(typeof api.body.messages[0].content, 'string');
                assert.equal(api.body.messages[1].content[0].text.includes(PRIVATE), true);
            } else {
                assert.deepEqual(auth.body, { grant_type: 'client_credentials', client_id: profile.clientId, client_secret: CLIENT_SECRET });
                assert.equal(api.options.headers.get('ai-resource-group'), 'default');
                if (protocol === 'sap-orchestration-v2') {
                    assert.equal(api.body.config.modules.prompt_templating.model.name, profile.model);
                    assert.equal(api.body.config.modules.prompt_templating.prompt.template[1].content, '{{?text}}');
                    assert.equal(api.body.placeholder_values.text, PRIVATE + ' literal {{?unchanged}}');
                    assert.equal(api.body.placeholder_values.system.includes('corrected_text'), true);
                } else {
                    assert.equal(api.body.model, undefined);
                    assert.equal(api.body.messages[1].content.includes(PRIVATE), true);
                }
            }
            assert.equal(h.timers.size, 0);
            assert.deepEqual(h.logs, []);
        });
    }
});

test('Token origin izni reddedilirse hiçbir anahtar veya kullanıcı metni gönderilmez', async () => {
    for (const [id, profile] of [['watsonx', { model: 'ibm/granite-4-h-small', projectId: 'fixture-project' }], ['sap-ai-core', sapProfile]]) {
        const h = harness({ storage: saved(id, profile), permission: ({ origins }) => !origins.some(origin => /iam.cloud.ibm.com|authentication.example/.test(origin)) });
        await assert.rejects(h.service.correctText(PRIVATE), { code: 'host_permission' });
        assert.equal(h.permissions[0].origins.length, 2);
        assert.equal(h.calls.length, 0);
    }
});

test('IBM/SAP özel auth ve zorunlu alanlar generic bearer/protocol override ile aşılmaz', () => {
    const h = harness();
    const cases = [
        ['watsonx', { model: 'ibm/granite-4-h-small', projectId: 'fixture-project', authType: 'bearer' }, 'unsupported_auth'],
        ['watsonx', { model: 'model', projectId: 'project', protocol: 'openai-chat' }, 'unsupported_auth'],
        ['watsonx', { model: 'model' }, 'configuration'],
        ['watsonx', { model: 'model', projectId: 'project', spaceId: 'space' }, 'configuration'],
        ['watsonx', { model: 'model', projectId: 'project', tokenURL: 'https://another.example/token' }, 'configuration'],
        ['sap-ai-core', { ...sapProfile, authType: 'bearer' }, 'unsupported_auth'],
        ['sap-ai-core', { ...sapProfile, protocol: 'openai-chat' }, 'unsupported_protocol'],
        ['sap-ai-core', { ...sapProfile, resourceGroup: '' }, 'configuration'],
        ['sap-ai-core', { ...sapProfile, deploymentId: '' }, 'configuration'],
        ['sap-ai-core', { ...sapProfile, tokenURL: 'https://fixture.example/token' }, 'endpoint'],
        ['sap-ai-core', { ...sapProfile, tokenURL: 'https://Fixture-Client-Secret-Never-Real.example/oauth/token' }, 'endpoint'],
        ['sap-ai-core', { ...sapProfile, baseURL: 'https://api.ai.fixture.example/v2/inference/deployments/another-id' }, 'configuration']
    ];
    for (const [id, profile, code] of cases) assert.throws(() => h.service.resolveProfile(id, { apiKey: KEY, ...profile }), { code }, id + '/' + code);
    assert.equal(h.calls.length, 0);
});

test('Bozuk, süresi dolmuş veya reddedilmiş token yanıtı inference başlatmaz ve sırları göstermez', async t => {
    const badTokens = [null, {}, tokenReply({ access_token: '' }), tokenReply({ access_token: 'bad token' }), tokenReply({ token_type: 'Basic' }), tokenReply({ expires_in: 0 }), tokenReply({ expires_in: -1 }), tokenReply({ expiration: Math.floor(Date.now() / 1000) - 1 }), tokenReply({ access_token: PRIVATE + ' bad' })];
    for (const [index, data] of badTokens.entries()) {
        await t.test('token schema/' + index, async () => {
            const h = harness({ storage: saved('watsonx', { model: 'ibm/granite-4-h-small', projectId: 'fixture-project' }), fetchMock: async () => reply(data) });
            await assert.rejects(h.service.correctText(PRIVATE), error => error.code === 'authentication_response' && !error.message.includes(KEY) && !error.message.includes(PRIVATE));
            assert.equal(h.calls.length, 1);
            assert.equal(h.timers.size, 0);
            assert.deepEqual(h.logs, []);
        });
    }
    const rejected = harness({ storage: saved('sap-ai-core', sapProfile), fetchMock: async () => reply({ error: 'invalid_client', error_description: PRIVATE + CLIENT_SECRET }, 401) });
    await assert.rejects(rejected.service.correctText(PRIVATE), error => error.code === 'authentication' && !error.message.includes(CLIENT_SECRET) && !error.message.includes(PRIVATE));
    assert.equal(rejected.calls.length, 1);
    const redirect = harness({ storage: saved('sap-ai-core', sapProfile), fetchMock: async () => ({ ...reply(tokenReply()), redirected: true }) });
    await assert.rejects(redirect.service.correctText(PRIVATE), { code: 'redirect' });
    assert.equal(redirect.calls.length, 1);
});

test('Tokenlar yeniden kullanılmaz veya profile/correction/status cevabına kaydedilmez', async () => {
    let tokenRequests = 0;
    const storage = saved('watsonx', { model: 'ibm/granite-4-h-small', projectId: 'fixture-project' });
    const before = JSON.stringify(storage);
    const h = harness({ storage, fetchMock: async url => reply(url.includes('identity/token') ? tokenReply({ access_token: TOKEN + '-' + ++tokenRequests }) : output('watsonx-chat')) });
    await h.service.correctText('metin');
    await h.service.correctText('metin');
    assert.equal(tokenRequests, 2);
    assert.equal(h.calls[1].options.headers.get('authorization'), 'Bearer ' + TOKEN + '-1');
    assert.equal(h.calls[3].options.headers.get('authorization'), 'Bearer ' + TOKEN + '-2');
    assert.equal(JSON.stringify(storage), before);
    const status = await h.service.getProviderStatus();
    assert.equal(status.configured, true);
    assert.equal(JSON.stringify(status).includes(TOKEN), false);
    assert.equal(h.calls.length, 4);
});

test('Token kökeni diğer API kökenine veya URLye taşınamaz; native kısmi sonuçlar reddedilir', async () => {
    const h = harness({ storage: saved('sap-ai-core', sapProfile), fetchMock: async () => reply(tokenReply()) });
    const resolved = h.service.resolveProfile('sap-ai-core', sapProfile);
    await assert.rejects(h.service.fetchJSON(resolved, 'https://another.example/completion', {}), { code: 'endpoint' });
    assert.equal(h.calls.length, 0);
    const expiredInference = harness({ storage: saved('watsonx', { model: 'ibm/granite-4-h-small', projectId: 'fixture-project' }), fetchMock: async url => reply(url.includes('identity/token') ? tokenReply() : { error: { message: PRIVATE + TOKEN } }, url.includes('identity/token') ? 200 : 401) });
    await assert.rejects(expiredInference.service.correctText(PRIVATE), error => error.code === 'authentication' && !error.message.includes(TOKEN) && !error.message.includes(PRIVATE));
    assert.equal(expiredInference.calls.length, 2);
    assert.throws(() => h.service.readOutput({ protocol: 'watsonx-chat' }, { choices: [{ finish_reason: 'TIME_LIMIT', message: { content: jsonText } }] }), { code: 'incomplete_response' });
    assert.throws(() => h.service.readOutput({ protocol: 'sap-orchestration-v2' }, { final_result: { choices: [{ finish_reason: 'content_filter', message: { content: jsonText } }] }, intermediate_results: output('openai-chat') }), { code: 'refused' });
});

const fixtures = [
    ['openai', { model: 'gpt-4o' }, 'openai-chat', 'https://api.openai.com/v1/chat/completions', 'authorization', 'Bearer ' + KEY],
    ['openrouter', { model: 'openai/gpt-4o' }, 'openai-chat', 'https://openrouter.ai/api/v1/chat/completions', 'authorization', 'Bearer ' + KEY],
    ['anthropic', { model: 'claude-sonnet-4-5' }, 'anthropic-messages', 'https://api.anthropic.com/v1/messages', 'x-api-key', KEY],
    ['google', { model: 'gemini-2.5-flash' }, 'gemini', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', 'x-goog-api-key', KEY],
    ['cohere', { model: 'command-r-plus' }, 'cohere-v2', 'https://api.cohere.com/v2/chat', 'authorization', 'Bearer ' + KEY],
    ['azure', { model: 'deployment-name', resourceName: 'fixture-resource' }, 'azure-openai', 'https://fixture-resource.openai.azure.com/openai/v1/chat/completions', 'api-key', KEY],
    ['amazon-bedrock', { model: 'anthropic.claude-sonnet-v1:0', region: 'eu-west-1' }, 'bedrock-converse', 'https://bedrock-runtime.eu-west-1.amazonaws.com/model/anthropic.claude-sonnet-v1%3A0/converse', 'authorization', 'Bearer ' + KEY],
    ['google-vertex', { model: 'gemini-2.5-flash', projectId: 'fixture-project', location: 'europe-west4' }, 'vertex-gemini', 'https://europe-west4-aiplatform.googleapis.com/v1/projects/fixture-project/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent', 'authorization', 'Bearer ' + KEY],
    ['google-vertex-anthropic', { model: 'claude-sonnet-4-5@20250929', projectId: 'fixture-project', location: 'global' }, 'vertex-anthropic', 'https://aiplatform.googleapis.com/v1/projects/fixture-project/locations/global/publishers/anthropic/models/claude-sonnet-4-5%4020250929:rawPredict', 'authorization', 'Bearer ' + KEY],
    ['custom', { model: 'fixture-model', protocol: 'openai-responses', baseURL: 'https://fixture.example/api/v1' }, 'openai-responses', 'https://fixture.example/api/v1/responses', 'authorization', 'Bearer ' + KEY],
    ['snowflake-cortex', { model: 'fixture-model', account: 'fixture-org-account' }, 'openai-chat', 'https://fixture-org-account.snowflakecomputing.com/api/v2/cortex/v1/chat/completions', 'authorization', 'Bearer ' + KEY],
    ['cloudflare-workers-ai', { model: '@cf/meta/llama-model', accountId: 'fixture-account' }, 'openai-chat', 'https://api.cloudflare.com/client/v4/accounts/fixture-account/ai/v1/chat/completions', 'authorization', 'Bearer ' + KEY]
];

test('Her protokol ailesi gerçek katalogla doğru endpoint, kimlik başlığı ve native gövde kullanır', async t => {
    for (const [id, profile, protocol, expectedURL, header, value] of fixtures) {
        await t.test(id + ' / ' + protocol, async () => {
            const h = harness({ storage: saved(id, profile), fetchMock: async () => reply(output(protocol)) });
            assert.equal(await h.service.correctText(PRIVATE), 'Düzeltilmiş metin.\n\nİkinci paragraf.');
            const call = h.calls[0];
            assert.equal(call.url, expectedURL);
            assert.equal(call.options.headers.get(header), value);
            assert.equal(call.options.redirect, 'error');
            assert.equal(call.options.credentials, 'omit');
            assert.equal(call.options.referrerPolicy, 'no-referrer');
            assert.equal(call.url.includes(KEY), false);
            assert.equal(h.permissions[0].origins[0], new URL(expectedURL).origin + '/*');
            assert.equal(h.timers.size, 0);
            assert.deepEqual(h.logs, []);
            if (['gemini', 'vertex-gemini'].includes(protocol)) {
                assert.equal(call.body.generationConfig.responseMimeType, 'application/json');
                assert.equal(call.body.contents[0].parts[0].text, PRIVATE);
            } else if (protocol === 'bedrock-converse') {
                assert.equal(call.body.system[0].text.includes('corrected_text'), true);
                assert.equal(call.body.messages[0].content[0].text, PRIVATE);
                assert.equal(call.body.model, undefined);
            } else if (protocol === 'vertex-anthropic') {
                assert.equal(call.body.anthropic_version, 'vertex-2023-10-16');
                assert.equal(call.body.model, undefined);
                assert.equal(call.body.max_tokens > 0, true);
            } else if (protocol === 'anthropic-messages') {
                assert.equal(call.options.headers.get('anthropic-version'), '2023-06-01');
                assert.equal(call.body.max_tokens > 0, true);
            } else if (protocol === 'openai-responses') assert.equal(call.body.input[1].content, PRIVATE);
            else assert.equal(call.body.messages[1].content, PRIVATE);
            if (id === 'openai') {
                assert.equal(call.body.store, false);
                assert.equal(call.body.temperature, 0.3);
                assert.deepEqual(call.body.response_format, { type: 'json_object' });
            }
        });
    }
});

test('Gateway, Azure Claude ve Vertex partner modelleri katalog override kullanır', async () => {
    const cases = [
        ['cloudflare-ai-gateway', { model: 'anthropic/claude-sonnet-4.5', accountId: 'fixture-account', gatewayId: 'fixture-gateway' }, 'openai-chat', 'https://gateway.ai.cloudflare.com/v1/fixture-account/fixture-gateway/compat/chat/completions', 'cf-aig-authorization', 'Bearer ' + KEY],
        ['azure', { model: 'claude-haiku-4-5', resourceName: 'fixture-resource' }, 'anthropic-messages', 'https://fixture-resource.services.ai.azure.com/anthropic/v1/messages', 'api-key', KEY],
        ['google-vertex', { model: 'claude-haiku-4-5@20251001', projectId: 'fixture-project', location: 'europe-west1' }, 'vertex-anthropic', 'https://europe-west1-aiplatform.googleapis.com/v1/projects/fixture-project/locations/europe-west1/publishers/anthropic/models/claude-haiku-4-5%4020251001:rawPredict', 'authorization', 'Bearer ' + KEY],
        ['google-vertex', { model: 'deepseek-ai/deepseek-v3.1-maas', projectId: 'fixture-project', location: 'us-central1' }, 'openai-chat', 'https://us-central1-aiplatform.googleapis.com/v1/projects/fixture-project/locations/us-central1/endpoints/openapi/chat/completions', 'authorization', 'Bearer ' + KEY]
    ];
    for (const [id, profile, protocol, url, header, value] of cases) {
        const h = harness({ storage: saved(id, profile), fetchMock: async () => reply(output(protocol)) });
        await h.service.correctText('metin');
        assert.equal(h.calls[0].url, url);
        assert.equal(h.calls[0].options.headers.get(header), value);
        if (id === 'cloudflare-ai-gateway') assert.equal(h.calls[0].options.headers.has('authorization'), false);
        if (protocol === 'openai-chat' && id === 'google-vertex') {
            assert.equal(h.calls[0].body.messages.length, 1);
            assert.equal(h.calls[0].body.messages[0].role, 'user');
            assert.equal(h.calls[0].body.messages[0].content.includes('corrected_text'), true);
            assert.equal(h.calls[0].body.messages[0].content.endsWith('metin'), true);
        }
    }
});

test('Açık Azure legacy ModelInference override deployment yoluna dönüşmez', async () => {
    const h = harness({ storage: saved('azure', { model: 'DeepSeek-V3.1', resourceName: 'fixture-resource', baseURL: 'https://fixture-resource.services.ai.azure.com/models', apiVersion: '2024-05-01-preview' }), fetchMock: async () => reply(output('openai-chat')) });
    await h.service.correctText('metin');
    assert.equal(h.calls[0].url, 'https://fixture-resource.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview');
});

test('Azure deployment aliası seçilen modelin native protokolünü değiştirmez', async () => {
    const h = harness({ storage: saved('azure', { model: 'claude-haiku-4-5', resourceName: 'fixture-resource', deploymentName: 'my-claude-deployment' }), fetchMock: async () => reply(output('anthropic-messages')) });
    await h.service.correctText('metin');
    assert.equal(h.calls[0].url, 'https://fixture-resource.services.ai.azure.com/anthropic/v1/messages');
    assert.equal(h.calls[0].body.model, 'my-claude-deployment');
    assert.equal(h.calls[0].options.headers.get('api-key'), KEY);
    assert.equal(h.calls[0].options.headers.get('anthropic-version'), '2023-06-01');
    const legacy = harness({ storage: saved('azure', { model: 'gpt-4o', resourceName: 'fixture-resource', deploymentName: 'my-gpt-deployment', apiVersion: '2024-10-21' }), fetchMock: async () => reply(output('azure-openai')) });
    await legacy.service.correctText('metin');
    assert.equal(legacy.calls[0].url, 'https://fixture-resource.openai.azure.com/openai/deployments/my-gpt-deployment/chat/completions?api-version=2024-10-21');
    assert.equal(legacy.calls[0].body.model, 'my-gpt-deployment');
});

test('Responses-only OpenAI model capability olmadan JSONformat zorlanmaz; depolama kapatılır', async () => {
    const h = harness({ storage: saved('openai', { model: 'gpt-5.4-pro' }), fetchMock: async () => reply(output('openai-responses')) });
    await h.service.correctText('metin');
    assert.equal(h.calls[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(h.calls[0].body.store, false);
    assert.equal(h.calls[0].body.text, undefined);
    assert.equal(h.calls[0].body.input[0].content.includes('corrected_text'), true);
});

test('Bedrock Mantle modeli native Converse yerine Responses ve modele özel liste endpointi kullanır', async () => {
    const profile = { model: 'openai.gpt-oss-120b', region: 'us-west-2' };
    const h = harness({ storage: saved('amazon-bedrock', profile), fetchMock: async () => reply(output('openai-responses')) });
    await h.service.correctText('metin');
    assert.equal(h.calls[0].url, 'https://bedrock-mantle.us-west-2.api.aws/v1/responses');
    assert.equal(h.calls[0].body.store, false);
    assert.equal(h.calls[0].options.headers.get('authorization'), 'Bearer ' + KEY);
    const list = harness({ storage: saved('amazon-bedrock', profile), fetchMock: async () => reply({ data: [{ id: 'openai.gpt-oss-120b' }] }) });
    const result = await list.service.listProviderModels();
    assert.equal(list.calls[0].url, 'https://bedrock-mantle.us-west-2.api.aws/v1/models');
    assert.equal(result.models[0].protocol, 'openai-responses');
});

test('Eski OpenAI anahtarı/promptu korunur; açıkça boş yeni anahtar eskiye dönmez', async () => {
    const legacy = harness({ storage: { openai_api_key: KEY, custom_system_prompt: PRIVATE }, fetchMock: async () => reply(output('openai-chat')) });
    assert.equal(legacy.accessLevel, 'TRUSTED_CONTEXTS');
    await legacy.service.correctText('metin');
    assert.equal(legacy.calls[0].body.model, 'gpt-4o');
    assert.equal(legacy.calls[0].body.messages[0].content.startsWith(PRIVATE), true);
    const empty = harness({ storage: { ...saved('openai', { model: 'gpt-4o', apiKey: '' }), openai_api_key: KEY } });
    await assert.rejects(empty.service.correctText('metin'), { code: 'missing_key' });
    assert.equal(empty.calls.length, 0);
});

test('Saf izin çözümleyicisi kesin origin verir ve güvenli olmayan endpointleri reddeder', async t => {
    const h = harness();
    assert.equal(h.service.getPermissionOrigin('custom', { baseURL: 'http://127.0.0.1:11434/v1', authType: 'none' }), 'http://127.0.0.1:11434/*');
    assert.equal(h.service.getPermissionOrigin('custom', { baseURL: 'https://fixture.example:443/v1' }), 'https://fixture.example/*');
    for (const baseURL of ['http://remote.example/v1', 'ftp://fixture.example/v1', 'https://user:pass@fixture.example/v1', 'https://fixture.example/v1?key=' + KEY, 'https://fixture.example/v1#fragment', 'https://fixture.example/{missing}', 'https://fixture.example/' + KEY, 'https://fixture.example/%ZZ']) {
        await t.test(baseURL, () => assert.throws(() => h.service.getPermissionOrigin('custom', { baseURL, apiKey: KEY }), { code: 'endpoint' }));
    }
    assert.throws(() => h.service.getPermissionOrigin('custom', { baseURL: 'https://Fixture-KeyMixed.example/v1', apiKey: 'Fixture-KeyMixed' }), { code: 'endpoint' });
    assert.throws(() => h.service.getPermissionOrigin('custom', { baseURL: 'https://fixture-keymixed.example/v1', apiKey: 'Fixture-KeyMixed' }), { code: 'endpoint' });
    assert.equal(h.calls.length, 0);
});

test('İzin yoksa veya kaydedilmiş profil yoksa API isteği başlatılmaz', async () => {
    const h = harness({ storage: saved('openrouter', { model: 'openai/gpt-4o' }), permission: false });
    await assert.rejects(h.service.correctText('metin'), { code: 'host_permission' });
    assert.equal(h.calls.length, 0);
    await assert.rejects(h.service.listProviderModels('anthropic'), { code: 'configuration' });
    await assert.rejects(h.service.correctText('metin', 'anthropic'), { code: 'configuration' });
    assert.equal(h.calls.length, 0);
});

test('Yerel Ollama anahtarsız çalışır; uzak OpenAI anahtarsız kabul edilmez', async () => {
    const local = harness({ storage: saved('ollama', { apiKey: '', model: 'qwen2.5:7b' }), fetchMock: async () => reply(output('openai-chat')) });
    await local.service.correctText('metin');
    assert.equal(local.calls[0].options.headers.has('authorization'), false);
    assert.deepEqual(local.calls[0].body.response_format, {
        type: 'json_schema',
        json_schema: {
            name: 'text_correction', strict: true,
            schema: { type: 'object', properties: { corrected_text: { type: 'string' } }, required: ['corrected_text'], additionalProperties: false }
        }
    });
    assert.equal(local.calls[0].body.temperature, 0.2);
    assert.equal(local.calls[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
    for (const [id, profile] of [['openai', { model: 'gpt-4o' }], ['llamacpp', { model: 'fixture-model' }], ['custom', { baseURL: 'http://localhost:8080/v1', model: 'fixture-model' }]]) {
        const resolved = local.service.resolveProfile(id, { apiKey: KEY, ...profile });
        const request = local.service.buildCorrectionRequest(resolved, 'metin');
        assert.equal(request.body.temperature, id === 'openai' ? 0.3 : undefined);
        assert.deepEqual(request.body.response_format === undefined ? undefined : plain(request.body.response_format), id === 'openai' ? { type: 'json_object' } : undefined);
    }
    for (const profile of [{ model: 'gemma4:cloud' }, { model: 'qwen2.5:7b', baseURL: 'https://ollama.com/v1' }]) {
        const request = local.service.buildCorrectionRequest(local.service.resolveProfile('ollama', profile), 'metin');
        assert.deepEqual(plain(request.body.response_format), { type: 'json_object' });
    }
    const wrongField = harness({ storage: saved('ollama', { apiKey: '', model: 'qwen2.5:7b' }), fetchMock: async () => reply({ choices: [{ finish_reason: 'stop', message: { content: '{"correct_text":"Yanlış alan."}' } }] }) });
    await assert.rejects(wrongField.service.correctText('metin'), { code: 'invalid_response' });
    const h = harness();
    assert.throws(() => h.service.resolveProfile('openai', { authType: 'none' }), { code: 'authentication' });
});

test('Ollama model yenileme boş modelle tek native GET yapar, embedding modellerini yetenekle ayıklar', async () => {
    const rows = [
        { model: 'qwen2.5:7b', name: 'Qwen etiketi', capabilities: ['completion', 'tools'] },
        { model: 'chat-model:latest', capabilities: ['chat'] },
        { name: 'legacy-model:latest' },
        { name: 'nomic-embed-text:latest', capabilities: ['embedding'] },
        { name: 'tools-only', capabilities: ['tools'] },
        { name: 'no-capabilities', capabilities: [] },
        { name: 'malformed-capabilities', capabilities: 'completion' },
        null,
        { capabilities: ['completion'] }
    ];
    const h = harness({ storage: saved('ollama', { apiKey: '', model: '' }), fetchMock: async () => reply({ models: rows }) });
    assert.equal((await h.service.getProviderStatus()).configured, false);
    assert.equal(h.calls.length, 0);
    const result = await h.rpc({ action: 'listProviderModels', providerId: 'ollama', baseURL: 'https://unsaved.example/v1' });
    assert.deepEqual(plain(result), {
        models: [{ id: 'qwen2.5:7b', name: 'Qwen etiketi' }, { id: 'chat-model:latest', name: 'chat-model:latest' }, { id: 'legacy-model:latest', name: 'legacy-model:latest' }],
        source: 'provider', truncated: false
    });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].url, 'http://127.0.0.1:11434/api/tags');
    assert.equal(h.calls[0].options.method, 'GET');
    assert.equal(h.calls[0].body, undefined);
    assert.equal(h.calls[0].options.headers.has('authorization'), false);
    assert.deepEqual(h.permissions, [{ origins: ['http://127.0.0.1:11434/*'] }]);
    await assert.rejects(h.service.correctText('metin'), { code: 'model' });
    assert.equal(h.calls.length, 1);
});

test('Taslak yerel keşif yalnız GET yapar, kayıtlı sağlayıcıyı okumadan/değiştirmeden model listeler', async t => {
    for (const [id, baseURL, endpoint, data, expected] of [
        ['ollama', 'http://localhost:11434/draft/v1', 'http://localhost:11434/draft/api/tags', { models: [{ model: 'qwen2.5:7b', capabilities: ['completion'] }, { model: 'nomic:latest', capabilities: ['embedding'] }] }, [{ id: 'qwen2.5:7b', name: 'qwen2.5:7b' }]],
        ['llamacpp', 'https://127.0.0.1:8443/v1', 'https://127.0.0.1:8443/v1/models', { data: [{ id: 'local-llama' }] }, [{ id: 'local-llama', name: 'local-llama' }]]
    ]) {
        await t.test(id, async () => {
            const storage = saved('openrouter', { model: 'openai/gpt-4o' });
            storage.ai_provider_config.providers.ollama = { baseURL: 'http://127.0.0.1:9999/v1', model: 'saved-model', apiKey: KEY };
            const before = plain(storage);
            const h = harness({ storage, storageError: true, fetchMock: async () => reply(data) });
            const result = await h.rpc({ action: 'discoverLocalModels', providerId: id, baseURL });
            assert.deepEqual(plain(result), { models: expected, source: 'provider', truncated: false });
            assert.deepEqual(storage, before);
            assert.deepEqual(h.storageReads, []);
            assert.deepEqual(h.storageWrites, []);
            assert.equal(h.calls.length, 1);
            assert.equal(h.calls[0].url, endpoint);
            assert.equal(h.calls[0].options.method, 'GET');
            assert.equal(h.calls[0].body, undefined);
            assert.equal(h.calls[0].options.headers.has('authorization'), false);
            assert.deepEqual(h.permissions, [{ origins: [new URL(baseURL).origin + '/*'] }]);
        });
    }
    const defaults = harness({ storageError: true, fetchMock: async () => reply({ models: [] }) });
    assert.deepEqual(plain(await defaults.service.discoverLocalModels('ollama')), { models: [], source: 'provider', truncated: false });
    assert.equal(defaults.calls[0].url, 'http://127.0.0.1:11434/api/tags');
    assert.deepEqual(defaults.storageReads, []);
});

test('Taslak keşif bulut/özel sağlayıcı, uzak adres, kimlik/protokol alanı veya eksik izinle ağ açmaz', async t => {
    for (const [id, profile, code] of [
        ['openai', { baseURL: 'http://localhost:11434/v1' }, 'configuration'],
        ['custom', { baseURL: 'http://localhost:11434/v1' }, 'configuration'],
        ['ollama', { baseURL: 'https://evil.example/v1' }, 'endpoint'],
        ['ollama', { baseURL: 'https://localhost.evil.example/v1' }, 'endpoint'],
        ['ollama', { baseURL: 'http://remote.example/v1' }, 'endpoint'],
        ['ollama', { baseURL: 'https://user:password@localhost:11434/v1' }, 'endpoint'],
        ['ollama', { baseURL: 'http://localhost:11434/v1?key=secret' }, 'endpoint'],
        ['ollama', { baseURL: 'http://localhost:11434/v1', apiKey: KEY }, 'configuration'],
        ['ollama', { baseURL: 'http://localhost:11434/v1', model: 'unused-model' }, 'configuration'],
        ['ollama', { baseURL: 'http://localhost:11434/v1', authType: 'bearer' }, 'configuration'],
        ['ollama', { baseURL: 'http://localhost:11434/v1', protocol: 'openai-chat' }, 'configuration'],
        ['ollama', { baseURL: 123 }, 'configuration'],
        ['ollama', null, 'configuration']
    ]) {
        await t.test(id + '/' + JSON.stringify(profile), async () => {
            const h = harness();
            await assert.rejects(h.service.discoverLocalModels(id, profile), { code });
            assert.equal(h.calls.length, 0);
            assert.deepEqual(h.permissions, []);
            assert.deepEqual(h.storageReads, []);
        });
    }
    const denied = harness({ permission: false });
    await assert.rejects(denied.service.discoverLocalModels('ollama', { baseURL: 'http://localhost:11434/v1' }), { code: 'host_permission' });
    assert.equal(denied.calls.length, 0);
    assert.deepEqual(denied.storageReads, []);
});

test('Taslak keşif RPC yalnız aynı eklentinin ayarlar sayfasına açıktır; diğer taslak alanlar reddedilir', async () => {
    const h = harness({ fetchMock: async () => reply({ models: [] }) });
    const request = { action: 'discoverLocalModels', providerId: 'ollama', baseURL: 'http://localhost:11434/v1' };
    for (const sender of [
        { id: 'fixture-extension', url: 'https://page.example/' },
        { id: 'fixture-extension', url: 'chrome-extension://fixture-extension/popup/popup.html' },
        { id: 'fixture-extension', url: 'chrome-extension://fixture-extension/options/options.html/child' },
        { id: 'another-extension', url: 'chrome-extension://fixture-extension/options/options.html' },
        { id: 'fixture-extension' }
    ]) assert.equal(await h.rpc(request, sender), undefined);
    assert.equal(h.calls.length, 0);
    for (const extra of [{ apiKey: KEY }, { model: 'unused-model' }, { profile: { baseURL: 'https://evil.example/v1' } }]) {
        const result = await h.rpc({ ...request, ...extra });
        assert.equal(result.errorCode, 'configuration');
    }
    assert.equal(h.calls.length, 0);
    assert.deepEqual(h.storageReads, []);
    const result = await h.rpc(request, { id: 'fixture-extension', url: 'chrome-extension://fixture-extension/options/options.html?panel=local' });
    assert.deepEqual(plain(result), { models: [], source: 'provider', truncated: false });
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.storageWrites, []);
});

test('Ollama native keşfi yalnız son v1 yolunu çıkarır, proxy kökü ve izin originini korur', async t => {
    for (const [baseURL, endpoint] of [
        ['http://localhost:11434/v1/', 'http://localhost:11434/api/tags'],
        ['http://127.0.0.1:11434/proxy/v1', 'http://127.0.0.1:11434/proxy/api/tags'],
        ['https://fixture.example/v1/proxy/v1/', 'https://fixture.example/v1/proxy/api/tags']
    ]) {
        await t.test(baseURL, async () => {
            const h = harness({ storage: saved('ollama', { apiKey: '', model: '', baseURL }), fetchMock: async () => reply({ models: [{ name: 'legacy:latest' }] }) });
            const result = await h.service.listProviderModels();
            assert.deepEqual(plain(result.models), [{ id: 'legacy:latest', name: 'legacy:latest' }]);
            assert.equal(h.calls.length, 1);
            assert.equal(h.calls[0].url, endpoint);
            assert.deepEqual(h.permissions, [{ origins: [new URL(baseURL).origin + '/*'] }]);
        });
    }
});

test('Ollama keşfi izinsiz ağ açmaz; bozuk native listeyi veya sunucu 403 yanıtını saklamaz', async t => {
    const denied = harness({ storage: saved('ollama', { apiKey: '', model: '' }), permission: false });
    await assert.rejects(denied.service.listProviderModels(), { code: 'host_permission' });
    assert.equal(denied.calls.length, 0);
    for (const [data, status, code] of [[{ data: [{ id: 'wrong-api-shape' }] }, 200, 'invalid_response'], [{ models: null }, 200, 'invalid_response'], [{ message: PRIVATE }, 403, 'permission']]) {
        await t.test(code + '/' + status, async () => {
            const h = harness({ storage: saved('ollama', { apiKey: '', model: '' }), fetchMock: async () => reply(data, status) });
            await assert.rejects(h.service.listProviderModels(), error => error.code === code && !error.message.includes(PRIVATE));
            assert.equal(h.calls.length, 1);
            assert.equal(h.calls[0].options.redirect, 'error');
            assert.equal(h.calls[0].options.credentials, 'omit');
            assert.equal(h.calls[0].options.referrerPolicy, 'no-referrer');
            assert.deepEqual(h.logs, []);
        });
    }
});

test('Yerel bağlantı ve erişim hataları sunucu/origin kontrolünü anlatır, bulut mesajları korunur', async t => {
    const offline = async () => { throw new Error(KEY + PRIVATE); };
    const forbiddenText = async () => ({ ok: false, status: 403, json: async () => { throw new Error('Forbidden ' + PRIVATE); } });
    for (const [id, profile, fetchMock, code, message] of [
        ['ollama', { apiKey: '', model: '' }, offline, 'connection', 'Yerel sunucuya bağlanılamadı. Sunucunun çalıştığını, adresini, portunu ve eklenti origin iznini kontrol edin.'],
        ['ollama', { apiKey: '', model: '' }, forbiddenText, 'permission', 'Yerel sunucu erişime izin vermedi. Sunucu adresini, portunu, erişim ayarlarını ve eklenti origin iznini kontrol edin.'],
        ['ollama', { apiKey: '', model: '' }, async () => reply({ error: { message: PRIVATE } }, 403), 'permission', 'Yerel sunucu erişime izin vermedi. Sunucu adresini, portunu, erişim ayarlarını ve eklenti origin iznini kontrol edin.'],
        ['openai', { model: 'gpt-4o' }, offline, 'connection', 'Sağlayıcıya bağlanılamadı. İnternet bağlantısını ve doğrudan API adresini kontrol edin.'],
        ['openai', { model: 'gpt-4o' }, forbiddenText, 'permission', 'Sağlayıcı erişime izin vermedi. Anahtar izinlerini, modeli ve bulut proje erişimini kontrol edin.']
    ]) {
        await t.test(id + '/' + code, async () => {
            const h = harness({ storage: saved(id, profile), fetchMock });
            await assert.rejects(h.service.listProviderModels(), error => error.code === code && error.message === message);
            assert.deepEqual(h.logs, []);
            assert.equal(h.calls.length, 1);
            assert.equal(h.timers.size, 0);
        });
    }
});

test('Tüm seçilebilir katalog modelleri yapılandırılmış fixture ile tek geçerli API yolu oluşturur', t => {
    const h = harness();
    let providers = 0;
    let models = 0;
    for (const entry of h.catalog.providers.filter(item => item.selectable !== false)) {
        providers++;
        const profile = { apiKey: KEY, resourceName: 'fixture-resource', region: 'us-central1', location: 'us-central1', projectId: 'fixture-project', accountId: 'fixture-account', gatewayId: 'fixture-gateway', account: 'fixture-org-account', host: 'fixture.cloud.databricks.com', productId: '123', gatewayBaseURL: 'https://fixture.example', vertexEndpoint: 'us-central1-aiplatform.googleapis.com', clientId: 'fixture-client-id', clientSecret: 'fixture-client-secret', tokenURL: 'https://fixture.authentication.example/oauth/token', deploymentId: 'fixture-deployment', resourceGroup: 'default' };
        if (entry.requiresBaseURL) profile.baseURL = 'https://fixture.api.example';
        if (entry.id === 'watsonx') delete profile.tokenURL;
        for (const field of entry.fields || []) if (!(field.key in profile) && field.key !== 'apiKey' && (field.required || field.default)) profile[field.key] = field.default || 'fixture';
        for (const model of (entry.models.length ? entry.models : [{ id: 'fixture-model' }]).filter(item => item.selectable !== false)) {
            models++;
            const resolved = h.service.resolveProfile(entry.id, { ...profile, model: model.id });
            const request = h.service.buildCorrectionRequest(resolved, 'metin');
            const url = new URL(request.url);
            assert.equal(url.protocol === 'https:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost', true, entry.id + '/' + model.id);
            assert.equal(url.pathname.match(/\/projects\//g)?.length || 0, resolved.isVertex ? 1 : 0, entry.id + '/' + model.id);
            assert.equal(/[{}$<>]/.test(request.url), false, entry.id + '/' + model.id);
            assert.equal(url.origin, new URL(resolved.baseURL).origin, entry.id + '/' + model.id);
            assert.ok(request.body, entry.id + '/' + model.id);
        }
    }
    assert.ok(providers > 200);
    assert.ok(models > 7000);
    t.diagnostic(providers + ' sağlayıcı / ' + models + ' katalog ve manuel model fixture: URL/gövde kontrolü; canlı hesap testi değildir.');
});

test('Katalogdaki uygulanmamış oturum/SDK akışları yanlış bearer isteğine dönüşmez', () => {
    const h = harness();
    const unsupported = h.catalog.providers.filter(item => item.selectable === false);
    assert.ok(unsupported.length > 0);
    for (const entry of unsupported) assert.throws(() => h.service.resolveProfile(entry.id, { model: 'model', apiKey: KEY, baseURL: 'https://fixture.example/v1', protocol: 'openai-chat', authType: 'bearer' }), { code: 'unsupported_auth' }, entry.id);
    assert.equal(h.calls.length, 0);
});

test('Model yenileme yalnız kaydedilmiş sağlayıcıdan gelir; bulut liste desteği uydurulmaz', async () => {
    const remote = harness({ storage: saved('openrouter', { model: 'openai/gpt-4o' }), fetchMock: async () => reply({ data: [{ id: 'a/b', name: '<model label>' }] }) });
    assert.deepEqual(plain(await remote.service.listProviderModels()), { models: [{ id: 'a/b', name: '<model label>' }], source: 'provider', truncated: false });
    assert.equal(remote.calls[0].url, 'https://openrouter.ai/api/v1/models');
    assert.equal(remote.calls[0].options.method, 'GET');
    for (const [id, profile] of fixtures.filter(row => ['azure', 'amazon-bedrock', 'google-vertex', 'snowflake-cortex'].includes(row[0]))) {
        const h = harness({ storage: saved(id, profile) });
        const result = await h.service.listProviderModels();
        assert.equal(result.source, 'catalog', id);
        assert.equal(h.calls.length, 0, id);
    }
});

test('Durum RPC kimlik bilgisi/prompt içermez ve ayar testi yalnız eklenti sayfasından gelir', async () => {
    const h = harness({ storage: saved('openai', { model: 'gpt-4o' }), fetchMock: async () => reply(output('openai-chat')) });
    const status = await h.rpc({ action: 'getProviderStatus' });
    assert.deepEqual(plain(status), { providerId: 'openai', providerName: 'OpenAI', model: 'gpt-4o', configured: true, baseURL: 'https://api.openai.com/v1' });
    assert.equal(JSON.stringify(status).includes(KEY), false);
    assert.equal(JSON.stringify(status).includes(PRIVATE), false);
    assert.equal(h.calls.length, 0);
    assert.equal(await h.rpc({ action: 'testProvider', providerId: 'openai' }, { id: 'fixture-extension', url: 'https://page.example/' }), undefined);
    assert.equal(await h.rpc({ action: 'correctText', text: 'metin' }, { id: 'another-extension', url: 'https://page.example/' }), undefined);
    const testResult = await h.rpc({ action: 'testProvider', providerId: 'openai', apiKey: 'unsaved-key', text: PRIVATE });
    assert.deepEqual(plain(testResult), { success: true });
    assert.equal(h.calls[0].body.messages[1].content, 'Bu bir test metnidir.');
    assert.equal(h.calls[0].options.headers.get('authorization'), 'Bearer ' + KEY);
});

test('Eksik bulut projesi veya geçersiz anahtar durum özetini hazır göstermez', async () => {
    for (const storage of [saved('google-vertex', { model: 'gemini-2.5-flash', projectId: '' }), saved('openai', { model: 'gpt-4o', apiKey: 'bad key' }), saved('openai', { model: '', apiKey: '' })]) {
        const h = harness({ storage });
        assert.equal((await h.service.getProviderStatus()).configured, false);
        assert.equal(h.calls.length, 0);
    }
});

test('HTTP hataları, bozuk yanıt ve yönlendirme özel verileri loga veya kullanıcı hatasına taşımaz', async t => {
    for (const [status, data, code] of [[401, {}, 'authentication'], [403, {}, 'permission'], [402, {}, 'quota'], [429, { error: { code: 'insufficient_quota', message: KEY + PRIVATE } }, 'quota'], [429, {}, 'rate_limit'], [400, { error: { code: 'context_length_exceeded' } }, 'text_too_long'], [503, {}, 'service'], [404, {}, 'model'], [504, {}, 'timeout']]) {
        await t.test(String(status) + '/' + code, async () => {
            const h = harness({ fetchMock: async () => reply(data, status) });
            await assert.rejects(h.service.correctText(PRIVATE), error => error.code === code && !error.message.includes(KEY) && !error.message.includes(PRIVATE));
            assert.deepEqual(h.logs, []);
            assert.equal(h.timers.size, 0);
        });
    }
    const malformed = harness({ fetchMock: async () => ({ ok: true, status: 200, json: async () => { throw new Error(KEY + PRIVATE); } }) });
    await assert.rejects(malformed.service.correctText(PRIVATE), { code: 'invalid_response' });
    const redirected = harness({ fetchMock: async () => ({ ...reply(output('openai-chat')), redirected: true }) });
    await assert.rejects(redirected.service.correctText(PRIVATE), { code: 'redirect' });
    const brokenStorage = harness({ storageError: true });
    const result = await brokenStorage.rpc({ action: 'correctText', text: PRIVATE });
    assert.equal(result.errorCode, 'storage');
    assert.equal(result.error.includes(PRIVATE), false);
});

test('Kesilmiş/reddedilmiş native çıktılar ve yanlış corrected_text asıl metni değiştirmez', () => {
    const h = harness();
    for (const protocol of h.service.PROTOCOLS) {
        const resolved = { protocol };
        assert.equal(h.service.readOutput(resolved, output(protocol)), 'Düzeltilmiş metin.\n\nİkinci paragraf.');
        assert.throws(() => h.service.readOutput(resolved, {}), { code: 'invalid_response' });
    }
    assert.throws(() => h.service.readOutput({ protocol: 'anthropic-messages' }, { stop_reason: 'max_tokens', content: [{ type: 'text', text: jsonText }] }), { code: 'incomplete_response' });
    assert.throws(() => h.service.readOutput({ protocol: 'gemini' }, { promptFeedback: { blockReason: 'SAFETY' } }), { code: 'refused' });
    assert.throws(() => h.service.readOutput({ protocol: 'openai-responses' }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: PRIVATE }] }] }), { code: 'refused' });
    assert.throws(() => h.service.readOutput({ protocol: 'bedrock-converse' }, { stopReason: 'end_turn', output: { message: { content: [{ text: '{"corrected_text":42}' }] } } }), { code: 'invalid_response' });
});

test('Zaman aşımı gövde okunurken de istekten sonra da temizlenir', async () => {
    let start;
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const h = harness({ fetchMock: async () => ({ ok: true, status: 200, json: () => { start(); return pending; } }) });
    const entered = new Promise(resolve => { start = resolve; });
    const operation = h.service.correctText('metin');
    await entered;
    assert.equal(h.timers.size, 1);
    h.timers.values().next().value();
    assert.equal(h.calls[0].options.signal.aborted, true);
    finish(output('openai-chat'));
    await assert.rejects(operation, { code: 'timeout' });
    assert.equal(h.timers.size, 0);
});
