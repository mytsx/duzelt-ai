const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const PRIVATE_TEXT = 'PRIVATE_REVIEW_INPUT_ONLY';
const PRIVATE_PROMPT = 'PRIVATE_REVIEW_PROMPT_ONLY';
const IBM_KEY = 'Review-KeyMixed-IBM';
const SAP_SECRET = 'Review-SecretMixed-SAP';
const TOKEN = 'Review-AccessToken-Only';
const correction = 'Düzeltilmiş örnek metin.';
const tokenResponse = { access_token: TOKEN, token_type: 'bearer', expires_in: 3600 };
const chatResponse = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ corrected_text: correction }) } }] };
const reply = (data, status = 200, extra = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => data, ...extra });
const fixtures = [
    ['watsonx', { apiKey: IBM_KEY, model: 'ibm/granite-3-3-8b-instruct', projectId: 'review-project', baseURL: 'https://us-south.ml.cloud.ibm.com' }],
    ['sap-ai-core', { apiKey: '', model: 'gpt-4o', clientId: 'review-client', clientSecret: SAP_SECRET, tokenURL: 'https://review.authentication.example/oauth/token', baseURL: 'https://review.aicore.example/v2', resourceGroup: 'default', deploymentId: 'review-deployment', sapMode: 'openai' }]
];

function harness(id, profile, { allowed = true, fetchMock } = {}) {
    const calls = [];
    const permissionCalls = [];
    const logs = [];
    const storageWrites = [];
    const events = [];
    const storage = { ai_provider_config: { version: 1, activeProviderId: id, providers: { [id]: profile } }, custom_system_prompt: PRIVATE_PROMPT };
    const context = vm.createContext({
        URL, URLSearchParams, Headers, AbortController, setTimeout, clearTimeout,
        chrome: {
            runtime: { lastError: null },
            permissions: { contains: (options, callback) => {
                permissionCalls.push(JSON.parse(JSON.stringify(options)));
                events.push('permission');
                callback(typeof allowed === 'function' ? allowed(options.origins) : allowed);
            } },
            storage: { local: {
                get: (keys, callback) => callback(storage),
                set: (...args) => storageWrites.push(args)
            } }
        },
        console: Object.fromEntries(['log', 'error', 'warn'].map(name => [name, (...args) => logs.push(args)])),
        fetch: async (url, options) => {
            events.push('fetch');
            calls.push({ url, options });
            if (!fetchMock) throw new Error('No network fixture');
            return fetchMock(url, options, calls.length);
        }
    });
    for (const file of ['lib/provider-catalog.js', 'background/openai-provider.js', 'background/provider-service.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    }
    return { service: context.ProviderService, calls, permissionCalls, logs, storageWrites, events };
}

function safeError(error) {
    const exposed = JSON.stringify({ code: error.code, message: error.message });
    for (const privateValue of [PRIVATE_TEXT, PRIVATE_PROMPT, IBM_KEY, SAP_SECRET, TOKEN]) assert.equal(exposed.includes(privateValue), false);
    return true;
}

test('Bağımsız IBM/SAP incelemesi: iki origin birlikte onaylanır, token formu ve native inference ayrılır', async t => {
    for (const [id, profile] of fixtures) await t.test(id, async () => {
        const h = harness(id, profile, { fetchMock: async (url, options, number) => reply(number === 1 ? tokenResponse : chatResponse) });
        assert.equal(await h.service.correctText(PRIVATE_TEXT), correction);
        assert.deepEqual(h.events, ['permission', 'fetch', 'fetch']);
        const resolved = h.service.resolveProfile(id, profile);
        const origins = [new URL(resolved.baseURL).origin + '/*', new URL(resolved.tokenURL).origin + '/*'];
        assert.deepEqual(h.permissionCalls[0].origins.sort(), origins.sort());
        assert.deepEqual(Array.from(h.service.getPermissionOrigins(id, profile)).sort(), origins.sort());
        const [tokenCall, inferenceCall] = h.calls;
        const form = new URLSearchParams(tokenCall.options.body);
        assert.equal(tokenCall.options.headers.get('content-type'), 'application/x-www-form-urlencoded');
        assert.equal(tokenCall.options.headers.get('authorization'), null);
        assert.equal(inferenceCall.options.headers.get('authorization'), 'Bearer ' + TOKEN);
        assert.equal(tokenCall.url, resolved.tokenURL);
        assert.equal(tokenCall.options.body.includes(PRIVATE_TEXT), false);
        assert.equal(tokenCall.options.body.includes(PRIVATE_PROMPT), false);
        const body = JSON.parse(inferenceCall.options.body);
        if (id === 'watsonx') {
            assert.equal(form.get('grant_type'), 'urn:ibm:params:oauth:grant-type:apikey');
            assert.equal(form.get('apikey'), IBM_KEY);
            assert.equal(body.project_id, 'review-project');
            assert.equal(body.space_id, undefined);
            assert.equal(body.model_id, profile.model);
            assert.equal(typeof body.messages[0].content, 'string');
            assert.equal(body.messages[1].content[0].text, PRIVATE_TEXT);
            assert.match(inferenceCall.url, /\/ml\/v1\/text\/chat\?version=\d{4}-\d{2}-\d{2}$/);
        } else {
            assert.equal(form.get('grant_type'), 'client_credentials');
            assert.equal(form.get('client_id'), 'review-client');
            assert.equal(form.get('client_secret'), SAP_SECRET);
            assert.equal(inferenceCall.options.headers.get('ai-resource-group'), 'default');
            assert.equal(body.messages[1].content, PRIVATE_TEXT);
            assert.equal(body.model, undefined);
            assert.match(inferenceCall.url, /\/v2\/inference\/deployments\/review-deployment\/chat\/completions\?api-version=/);
        }
        for (const call of h.calls) {
            assert.equal(call.options.redirect, 'error');
            assert.equal(call.options.credentials, 'omit');
            assert.equal(call.options.referrerPolicy, 'no-referrer');
            for (const secret of [IBM_KEY, SAP_SECRET, TOKEN]) assert.equal(call.url.includes(secret), false);
        }
        assert.deepEqual(h.logs, []);
        assert.deepEqual(h.storageWrites, []);
    });
});

test('Yalnız inference veya yalnız token izni varsa hiçbir kimlik isteği başlamaz', async t => {
    for (const [id, profile] of fixtures) for (const permission of ['inference-only', 'token-only']) await t.test(id + '/' + permission, async () => {
        const h = harness(id, profile, { allowed: origins => origins.every(origin => permission === 'inference-only' ? !origin.includes('iam.cloud') && !origin.includes('authentication') : origin.includes('iam.cloud') || origin.includes('authentication')) });
        await assert.rejects(h.service.correctText(PRIVATE_TEXT), error => error.code === 'host_permission' && safeError(error));
        assert.equal(h.calls.length, 0);
    });
});

test('Token hatası ve bozuk/boş/süresi dolmuş token inference başlatmaz; özel veri hata/log/depo çıktısına düşmez', async t => {
    const invalidReplies = [
        reply({ error: { message: PRIVATE_TEXT + PRIVATE_PROMPT + IBM_KEY + SAP_SECRET + TOKEN } }, 401),
        reply({ errors: [{ message: PRIVATE_TEXT + IBM_KEY + SAP_SECRET }] }, 500),
        reply({ ...tokenResponse, access_token: '' }),
        reply({ ...tokenResponse, access_token: TOKEN + '\n' }),
        reply({ ...tokenResponse, token_type: 'basic' }),
        reply({ ...tokenResponse, expires_in: 0 }),
        reply({ ...tokenResponse, expires_in: 'invalid' }),
        reply({ ...tokenResponse, expiration: Math.floor(Date.now() / 1000) - 5 }),
        reply(tokenResponse, 200, { redirected: true }),
        { ok: true, status: 200, json: async () => { throw new Error(PRIVATE_TEXT + IBM_KEY + SAP_SECRET); } }
    ];
    for (const [id, profile] of fixtures) for (let index = 0; index < invalidReplies.length; index++) await t.test(id + '/' + index, async () => {
        const h = harness(id, profile, { fetchMock: async () => invalidReplies[index] });
        await assert.rejects(h.service.correctText(PRIVATE_TEXT), safeError);
        assert.equal(h.calls.length, 1);
        assert.deepEqual(h.logs, []);
        assert.deepEqual(h.storageWrites, []);
    });
});

test('Kimlik bilgisi token/inference URL, model veya deployment yoluna yazıldığında ağ başlamaz', async t => {
    const [ibmId, ibmProfile] = fixtures[0];
    const [sapId, sapProfile] = fixtures[1];
    const profiles = [
        [ibmId, { ...ibmProfile, baseURL: 'https://' + IBM_KEY.toLowerCase() + '.example' }],
        [ibmId, { ...ibmProfile, baseURL: 'https://review.example/' + encodeURIComponent(IBM_KEY) }],
        [sapId, { ...sapProfile, baseURL: 'https://' + SAP_SECRET.toLowerCase() + '.example/v2' }],
        [sapId, { ...sapProfile, tokenURL: 'https://' + SAP_SECRET.toLowerCase() + '.example/oauth/token' }],
        [sapId, { ...sapProfile, tokenURL: 'https://review.authentication.example/' + encodeURIComponent(SAP_SECRET) + '/oauth/token' }],
        [sapId, { ...sapProfile, model: SAP_SECRET }],
        [sapId, { ...sapProfile, deploymentId: SAP_SECRET }]
    ];
    for (let index = 0; index < profiles.length; index++) await t.test(String(index), async () => {
        const [id, profile] = profiles[index];
        const h = harness(id, profile);
        await assert.rejects(h.service.correctText(PRIVATE_TEXT), safeError);
        assert.equal(h.calls.length, 0);
    });
});

test('Token yanıtındaki access token inference adresinde bulunuyorsa yalnız token isteği yapılır', async () => {
    const [id, original] = fixtures[1];
    const profile = { ...original, baseURL: 'https://' + TOKEN.toLowerCase() + '.example/v2' };
    const h = harness(id, profile, { fetchMock: async () => reply(tokenResponse) });
    await assert.rejects(h.service.correctText(PRIVATE_TEXT), error => error.code === 'endpoint' && safeError(error));
    assert.equal(h.calls.length, 1);
});

test('IBM/SAP yanlış kimlik ve deployment bağlamı generic bearer bağlantısına dönüşmez', () => {
    const [ibmId, ibmProfile] = fixtures[0];
    const [sapId, sapProfile] = fixtures[1];
    const h = harness(ibmId, ibmProfile);
    assert.throws(() => h.service.resolveProfile(ibmId, { ...ibmProfile, authType: 'bearer' }), { code: 'unsupported_auth' });
    assert.throws(() => h.service.resolveProfile(ibmId, { ...ibmProfile, spaceId: 'review-space' }), { code: 'configuration' });
    assert.throws(() => h.service.resolveProfile(ibmId, { ...ibmProfile, tokenURL: 'https://other.example/identity/token' }), { code: 'configuration' });
    assert.throws(() => h.service.resolveProfile(sapId, { ...sapProfile, authType: 'bearer' }), { code: 'unsupported_auth' });
    assert.throws(() => h.service.resolveProfile(sapId, { ...sapProfile, baseURL: 'https://review.aicore.example/v2/inference/deployments/other-deployment' }), { code: 'configuration' });
});

test('SAP orkestrasyon çıktısı final_result alanından okunur, IBM TIME_LIMIT kısmi metni kabul etmez', () => {
    const [id, original] = fixtures[1];
    const h = harness(id, original);
    const resolved = h.service.resolveProfile(id, { ...original, sapMode: 'orchestration', model: 'anthropic--claude-sonnet-4' });
    const request = h.service.buildCorrectionRequest(resolved, PRIVATE_TEXT, PRIVATE_PROMPT);
    assert.match(request.url, /\/v2\/completion$/);
    assert.equal(request.body.config.modules.prompt_templating.model.name, 'anthropic--claude-sonnet-4');
    assert.equal(request.body.placeholder_values.text, PRIVATE_TEXT);
    assert.equal(h.service.readOutput(resolved, { final_result: chatResponse }), correction);
    assert.throws(() => h.service.readOutput({ protocol: 'watsonx-chat' }, { choices: [{ finish_reason: 'TIME_LIMIT', message: { content: JSON.stringify({ corrected_text: correction }) } }] }), { code: 'incomplete_response' });
});
