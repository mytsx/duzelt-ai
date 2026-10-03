const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const providerSource = fs.readFileSync(path.join(root, 'background/openai-provider.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'background/provider-service.js'), 'utf8');
const TEST_KEY = 'sk-test-only-not-real';
const PRIVATE_MARKER = 'PRIVATE_TEST_DATA_NEVER_SHOW';

function makeProvider(fetchMock, overrides = {}) {
    const logs = [];
    const timers = new Map();
    let timerId = 0;
    const context = vm.createContext({
        fetch: fetchMock,
        Headers,
        URL,
        URLSearchParams,
        AbortController,
        chrome: { runtime: {} },
        console: {
            log: (...args) => logs.push(args),
            error: (...args) => logs.push(args),
            warn: (...args) => logs.push(args)
        },
        setTimeout: callback => {
            timers.set(++timerId, callback);
            return timerId;
        },
        clearTimeout: id => timers.delete(id),
        ...overrides
    });
    vm.runInContext(providerSource + '\nglobalThis.provider = OpenAIProvider;', context);
    vm.runInContext(serviceSource, context);
    return { provider: context.provider, context, logs, timers };
}

function responseFor(data, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function completion(text, finishReason = 'stop') {
    return { choices: [{ finish_reason: finishReason, message: { content: JSON.stringify({ corrected_text: text }) } }] };
}

function expectPrivateSafe(error, code) {
    assert.equal(error.code, code);
    assert.equal(error.message.includes(PRIVATE_MARKER), false);
    assert.equal(error.message.includes(TEST_KEY), false);
    return true;
}

test('Türkçe metin, paragraflar ve mevcut model/ayarlar aynı istekle korunur', async () => {
    const original = '  yarın toplantı var.\n\nİkinci paragraf: ş, ğ, ü, ö, ç.  ';
    const corrected = '  Yarın toplantı var.\n\nİkinci paragraf: ş, ğ, ü, ö, ç.  ';
    let request;
    const harness = makeProvider(async (url, options) => {
        request = { url, options, body: JSON.parse(options.body) };
        return responseFor(completion(corrected));
    });
    assert.equal(await harness.provider.correctText(original, '  ' + TEST_KEY + '  '), corrected);
    assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(request.body.model, 'gpt-4o');
    assert.equal(request.body.temperature, 0.3);
    assert.deepEqual(request.body.response_format, { type: 'json_object' });
    assert.equal(request.body.store, false);
    assert.equal(request.body.messages[1].content, original);
    assert.equal(request.options.headers.get('Authorization'), 'Bearer ' + TEST_KEY);
    assert.equal(request.options.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(harness.timers.size, 0);
    assert.deepEqual(harness.logs, []);
});

test('JSON talimatı olmayan özel prompt çıktı sözleşmesini bozmaz', async () => {
    let body;
    const harness = makeProvider(async (url, options) => {
        body = JSON.parse(options.body);
        return responseFor(completion('Merhaba.'));
    });
    await harness.provider.correctText('merhaba', TEST_KEY, 'Samimi bir Türkçe üslup kullan.');
    assert.ok(body.messages[0].content.startsWith('Samimi bir Türkçe üslup kullan.'));
    assert.ok(body.messages[0].content.includes('JSON'));
    assert.ok(body.messages[0].content.includes('corrected_text'));
});

test('Eksik anahtar, geçersiz başlık karakterleri ve boş metin ağ isteği yapmaz', async t => {
    const cases = [
        ['metin', null, 'missing_key'],
        ['metin', '   ', 'missing_key'],
        ['metin', 'sk-anahtar iceride', 'invalid_key'],
        ['metin', 'sk-şifre', 'invalid_key'],
        ['metin', 'sk-key\ninjection', 'invalid_key'],
        ['', TEST_KEY, 'empty_text'],
        ['   ', TEST_KEY, 'empty_text'],
        [null, TEST_KEY, 'empty_text']
    ];
    for (const [index, [input, key, code]] of cases.entries()) {
        await t.test(code + ' / ' + index, async () => {
            let calls = 0;
            const harness = makeProvider(async () => { calls++; });
            await assert.rejects(harness.provider.correctText(input, key), error => expectPrivateSafe(error, code));
            assert.equal(calls, 0);
            assert.deepEqual(harness.logs, []);
        });
    }
});

test('API hata türleri ayrılır; ham hata metni ve özel veriler gösterilmez', async t => {
    const cases = [
        [401, { code: 'invalid_api_key' }, 'authentication'],
        [403, {}, 'permission'],
        [429, { code: 'insufficient_quota' }, 'quota'],
        [429, { code: 'credit_balance_exhausted' }, 'quota'],
        [429, { code: 'project_spend_limit_exceeded' }, 'quota'],
        [429, { code: 'organization_spend_limit_exceeded' }, 'quota'],
        [429, { code: 'organization_usage_limit_exceeded' }, 'quota'],
        [429, { type: 'insufficient_quota' }, 'quota'],
        [429, { code: 'rate_limit_exceeded' }, 'rate_limit'],
        [408, {}, 'timeout'],
        [504, {}, 'timeout'],
        [500, {}, 'service'],
        [503, {}, 'service'],
        [400, { code: 'context_length_exceeded' }, 'text_too_long'],
        [400, {}, 'api']
    ];
    for (const [status, metadata, code] of cases) {
        await t.test(status + ' / ' + code + ' / ' + (metadata.code || metadata.type || 'generic'), async () => {
            const harness = makeProvider(async () => responseFor({ error: { ...metadata, message: PRIVATE_MARKER + TEST_KEY } }, status));
            await assert.rejects(harness.provider.correctText(PRIVATE_MARKER, TEST_KEY, PRIVATE_MARKER), error => expectPrivateSafe(error, code));
            assert.deepEqual(harness.logs, []);
            assert.equal(harness.timers.size, 0);
        });
    }
});

test('JSON olmayan HTTP hata gövdesi güvenli bir hataya dönüşür', async () => {
    const harness = makeProvider(async () => ({ ok: false, status: 502, json: async () => { throw new Error(PRIVATE_MARKER); } }));
    await assert.rejects(harness.provider.correctText('metin', TEST_KEY), error => expectPrivateSafe(error, 'service'));
    assert.deepEqual(harness.logs, []);
});

test('Yanlış yanıt şeması, boş sonuç ve ham model çıktısı reddedilir', async t => {
    const malformed = [
        null, {}, { choices: [] }, { choices: [null] },
        { choices: [{ finish_reason: 'stop', message: { content: PRIVATE_MARKER } }] },
        { choices: [{ finish_reason: 'stop', message: { content: 'null' } }] },
        { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ corrected_text: 3 }) } }] },
        { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text: PRIVATE_MARKER }) } }] },
        { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify([{ corrected_text: PRIVATE_MARKER }]) } }] },
        completion(''), completion('   '), completion('metin', null)
    ];
    for (let index = 0; index < malformed.length; index++) {
        await t.test('şema ' + index, async () => {
            const harness = makeProvider(async () => responseFor(malformed[index]));
            await assert.rejects(harness.provider.correctText('metin', TEST_KEY), error => expectPrivateSafe(error, 'invalid_response'));
            assert.deepEqual(harness.logs, []);
            assert.equal(harness.timers.size, 0);
        });
    }
});

test('Bozuk HTTP JSON yanıtı metin olarak kabul edilmez veya loglanmaz', async () => {
    const harness = makeProvider(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(PRIVATE_MARKER); } }));
    await assert.rejects(harness.provider.correctText('metin', TEST_KEY), error => expectPrivateSafe(error, 'invalid_response'));
    assert.deepEqual(harness.logs, []);
});

test('Kesilmiş ve reddedilmiş yanıtlar geçerli JSON içerse bile uygulanmaz', async t => {
    const cases = [
        [completion('metin', 'length'), 'incomplete_response'],
        [completion('metin', 'content_filter'), 'refused'],
        [{ choices: [{ finish_reason: 'stop', message: { refusal: PRIVATE_MARKER, content: '{}' } }] }, 'refused']
    ];
    for (const [data, code] of cases) {
        await t.test(code, async () => {
            const harness = makeProvider(async () => responseFor(data));
            await assert.rejects(harness.provider.correctText('metin', TEST_KEY), error => expectPrivateSafe(error, code));
        });
    }
});

test('Ağ hatası anahtar/metin içeren asıl hata mesajını taşımaz', async () => {
    const harness = makeProvider(async () => { throw new TypeError(PRIVATE_MARKER + TEST_KEY); });
    await assert.rejects(harness.provider.correctText('metin', TEST_KEY), error => expectPrivateSafe(error, 'connection'));
    assert.equal(harness.timers.size, 0);
    assert.deepEqual(harness.logs, []);
});

test('Zaman aşımı ağ isteğini iptal eder ve zamanlayıcı temizlenir', async () => {
    let requestStarted;
    const started = new Promise(resolve => { requestStarted = resolve; });
    const harness = makeProvider((url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error(PRIVATE_MARKER)));
        requestStarted();
    }));
    const result = harness.provider.correctText('metin', TEST_KEY);
    await started;
    assert.equal(harness.timers.size, 1);
    [...harness.timers.values()][0]();
    await assert.rejects(result, error => expectPrivateSafe(error, 'timeout'));
    assert.equal(harness.timers.size, 0);
    assert.deepEqual(harness.logs, []);
});

test('Zaman aşımı yanıt gövdesi okunurken de etkin kalır', async () => {
    let bodyStarted;
    const started = new Promise(resolve => { bodyStarted = resolve; });
    const harness = makeProvider(async (url, options) => ({
        ok: true,
        status: 200,
        json: () => new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error(PRIVATE_MARKER)));
            bodyStarted();
        })
    }));
    const result = harness.provider.correctText('metin', TEST_KEY);
    await started;
    [...harness.timers.values()][0]();
    await assert.rejects(result, error => expectPrivateSafe(error, 'timeout'));
    assert.equal(harness.timers.size, 0);
});
