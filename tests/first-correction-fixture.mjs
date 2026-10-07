/* Source UI in a regular ephemeral browser. No extension load, real grant, key or network. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const testRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.env.DUZELT_SOURCE_ROOT || testRoot);
const label = process.env.DUZELT_FIXTURE_LABEL || 'local';
assert.match(label, /^[a-z0-9-]+$/);
const output = path.join(testRoot, 'output/playwright/first-correction-fixture', label);
// HTTPS is intercepted entirely in memory and gives crypto.randomUUID a secure context.
const fixtureOrigin = 'https://duzelt-fixture.test';
const extensionId = 'fixture-extension-no-install';
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const testHarnessSHA256 = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
const sourceFiles = [
    'manifest.json', 'popup/popup.html', 'popup/popup.js', 'popup/popup.css',
    'options/options.html', 'options/options.js', 'options/options.css',
    'lib/product-config.js', 'lib/provider-catalog.js', 'lib/diff.min.js',
    'background/background.js', 'background/openai-provider.js', 'background/provider-service.js',
    'content/editor-bridge.js', 'content/content.js', 'content/content.css', 'icons/icon48.png'
];
const sources = new Map(await Promise.all(sourceFiles.map(async file => [file, await readFile(path.join(root, file))])));
const sourceSHA256 = Object.fromEntries([...sources].map(([file, bytes]) => [file, createHash('sha256').update(bytes).digest('hex')]));
async function capture(page, filename) {
    await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: 'disabled' });
}
const local = {};
const sync = {};
const grants = new Set();
const requests = [];
const permissionRequests = [];
const checks = [];
const errors = [];
const unexpectedNetworkRequests = [];
let allowPermission = false;
let correctionMode = 'correct';
let heldCorrection;
let holdStarted;
let releaseCorrection;
let listener;
let optionsOpened = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const runtime = {
    id: extensionId, lastError: null, getURL: suffix => `chrome-extension://${extensionId}/${suffix}`,
    onMessage: { addListener(callback) { listener = callback; } }
};
const backend = vm.createContext({
    URL, URLSearchParams, Headers, AbortController, setTimeout, clearTimeout,
    chrome: {
        runtime,
        storage: { local: {
            get(keys, callback) { callback(clone(local)); },
            set(values, callback) { Object.assign(local, clone(values)); callback?.(); },
            setAccessLevel(options, callback) { assert.equal(options.accessLevel, 'TRUSTED_CONTEXTS'); callback(); }
        } },
        permissions: { contains({ origins }, callback) { callback(origins.every(origin => grants.has(origin))); } }
    },
    console: Object.fromEntries(['log', 'warn', 'error'].map(method => [method, () => { throw new Error('Unexpected provider log'); }])),
    fetch: async (url, options) => {
        const target = new URL(url);
        assert.ok(['http://127.0.0.1:11434', 'http://127.0.0.1:8080', 'https://api.openai.com'].includes(target.origin));
        if (target.protocol === 'http:') assert.equal(options.headers.has('authorization'), false);
        else assert.equal(options.headers.get('authorization'), 'Bearer synthetic-only-not-a-real-credential');
        requests.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : null });
        if (correctionMode === 'offline') throw new TypeError('Synthetic fixture offline');
        if (target.pathname === '/v1/models') return { ok: true, status: 200, json: async () => ({ data: [{ id: 'fixture-llama' }] }) };
        if (target.pathname === '/api/tags') {
            return { ok: true, status: 200, json: async () => ({ models: [
                { name: 'fixture-turkish:latest', capabilities: ['completion'] },
                { name: 'fixture-embedding:latest', capabilities: ['embedding'] }
            ] }) };
        }
        assert.equal(target.pathname, '/v1/chat/completions');
        const mode = correctionMode;
        if (mode === 'hold') {
            heldCorrection = true;
            holdStarted?.();
            await new Promise(resolve => { releaseCorrection = resolve; });
        }
        const body = JSON.parse(options.body);
        const text = body.messages.find(item => item.role === 'user').content;
        let corrected = text.replaceAll('bugun', 'bugün').replaceAll('cok', 'çok').replaceAll('guzel', 'güzel');
        if (mode === 'paragraph') corrected = corrected.replace('\n', '\nYeni paragraf.\n');
        if (mode === 'malicious') corrected += ' <img src=x onerror="window.fixtureExecuted=true"><script>window.fixtureExecuted=true</script>';
        const result = mode === 'broken' ? [] : corrected;
        return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ corrected_text: result }) } }] }) };
    }
});
for (const file of ['lib/provider-catalog.js', 'background/openai-provider.js', 'background/provider-service.js']) {
    vm.runInContext(sources.get(file).toString(), backend);
}
backend.importScripts = () => {};
vm.runInContext(sources.get('background/background.js').toString(), backend);

const banner = '<aside style="padding:10px;background:#fff4c4;color:#332900;font:14px system-ui">SENTETİK TEST · Eklenti kurulmadı · Chrome izinleri ve servis yanıtları taklit · Gerçek sağlayıcı/mağaza testi değildir</aside>';
const initialHTML = '<p>Merhaba <strong>Ali</strong>, bugun cok guzel.</p><p><em>Örnek metin</em> ve <a href="https://example.test/">bağlantı</a>.</p><ul><li>birinci madde</li></ul>';
const editorHTML = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Sentetik ilk düzeltme</title><link rel="stylesheet" href="/content/content.css"><style>body{font:16px system-ui;margin:30px;max-width:1000px}.ql-toolbar{padding:10px;border:1px solid #ccc}.ql-container{padding:20px;border:1px solid #ccc}.ql-editor{min-height:180px}</style></head><body>${banner}<h1>İlk düzeltme: sentetik editör API fixture</h1><div class="ql-toolbar"></div><div class="ql-container"><div class="ql-editor" contenteditable="true"></div></div><label>Normal input <input></label><label>Normal textarea <textarea></textarea></label><script src="/fixture-editor.js"></script><script src="/content/editor-bridge.js"></script><script src="/lib/diff.min.js"></script><script src="/content/content.js"></script></body></html>`;
const editorScript = `
    const root = document.querySelector('.ql-editor');
    root.innerHTML = ${JSON.stringify(initialHTML)};
    class SyntheticQuill { static version = '2.0.3'; }
    window.fixtureEditor = Object.assign(new SyntheticQuill(), {
        root, isEnabled: () => true, getContents: () => ({}),
        getSemanticHTML: () => root.innerHTML,
        getModule: () => ({ container: document.querySelector('.ql-toolbar') }),
        clipboard: { convert: value => ({ html: value.html }) },
        history: { cutoff() {} },
        setContents(delta) { root.innerHTML = delta.html; }
    });
    document.querySelector('.ql-container').__quill = window.fixtureEditor;
`;

await mkdir(output, { recursive: true });
let browser;
try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    context.setDefaultTimeout(10000);
    await context.exposeBinding('fixtureRPC', async ({ page }, request) => {
        const area = request.area === 'sync' ? sync : local;
        if (request.method === 'get') return clone(area);
        if (request.method === 'set') {
            const changes = Object.fromEntries(Object.entries(request.values).map(([key, value]) => [key, { oldValue: area[key], newValue: value }]));
            Object.assign(area, clone(request.values));
            for (const openPage of context.pages()) await openPage.evaluate(({ changes, areaName }) => window.fixtureNotify?.(changes, areaName), { changes, areaName: request.area });
            return null;
        }
        if (request.method === 'remove') { for (const key of request.keys) delete area[key]; return null; }
        if (request.method === 'permissionRequest') {
            permissionRequests.push(clone(request.origins));
            if (allowPermission) request.origins.forEach(origin => grants.add(origin));
            return allowPermission;
        }
        if (request.method === 'permissionContains') return request.origins.every(origin => grants.has(origin));
        if (request.method === 'openOptions') { optionsOpened++; return null; }
        if (request.method !== 'message') throw new Error('Unknown fixture RPC');
        const pathname = new URL(page.url()).pathname;
        const sender = { id: extensionId, url: pathname.startsWith('/options/') || pathname.startsWith('/popup/') ? runtime.getURL(pathname.slice(1)) : page.url() };
        return new Promise(resolve => {
            const accepted = listener(request.payload, sender, response => resolve(clone(response)));
            if (accepted !== true) resolve(null);
        });
    });
    await context.addInitScript(({ extensionId, manifest }) => {
        const listeners = [];
        const invoke = (request, callback) => window.fixtureRPC(request).then(value => { callback?.(value); return value; });
        const area = areaName => ({
            get: (keys, callback) => invoke({ method: 'get', area: areaName, keys }, callback),
            set: (values, callback) => invoke({ method: 'set', area: areaName, values }, callback),
            remove: (keys, callback) => invoke({ method: 'remove', area: areaName, keys }, callback)
        });
        window.fixtureNotify = (changes, namespace) => listeners.forEach(listener => listener(changes, namespace));
        window.chrome = {
            runtime: {
                id: extensionId, lastError: null, getManifest: () => manifest,
                getURL: suffix => `chrome-extension://${extensionId}/${suffix}`,
                sendMessage: (payload, callback) => invoke({ method: 'message', payload }, callback),
                openOptionsPage: callback => invoke({ method: 'openOptions' }, callback)
            },
            storage: { local: area('local'), sync: area('sync'), onChanged: { addListener: listener => listeners.push(listener) } },
            permissions: {
                request: ({ origins }, callback) => invoke({ method: 'permissionRequest', origins }, callback),
                contains: ({ origins }, callback) => invoke({ method: 'permissionContains', origins }, callback)
            }
        };
    }, { extensionId, manifest });
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const file = url.pathname.slice(1);
        if (url.origin !== fixtureOrigin) {
            unexpectedNetworkRequests.push(url.origin);
            await route.abort('blockedbyclient');
            return;
        }
        let bytes = sources.get(file);
        if (file === 'editor.html') bytes = Buffer.from(editorHTML);
        if (file === 'fixture-editor.js') bytes = Buffer.from(editorScript);
        if (!bytes) { unexpectedNetworkRequests.push(url.pathname); await route.abort('blockedbyclient'); return; }
        if (file.endsWith('.html')) bytes = Buffer.from(bytes.toString().replace('<body>', '<body>' + (file === 'editor.html' ? '' : banner)));
        const contentType = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'image/png';
        await route.fulfill({ status: 200, contentType, body: bytes });
    });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const popup = await context.newPage();
    await popup.goto(fixtureOrigin + '/popup/popup.html');
    await popup.waitForFunction(() => !document.getElementById('enabled-toggle').disabled);
    assert.equal(await popup.locator('#enabled-toggle').isChecked(), true);
    assert.match(await popup.locator('#provider-info').innerText(), /tamamlayın/);
    assert.deepEqual(local, {});
    assert.equal(requests.length, 0);
    checks.push('Fresh empty memory storage: enabled by default; popup says provider setup is required; no inference or model discovery.');
    await capture(popup, 'fresh-popup.png');
    await popup.locator('#open-settings').click();
    assert.equal(optionsOpened, 1);
    checks.push('Popup options click reaches the openOptionsPage stub. Native extension tab opening is outside this test.');

    const options = await context.newPage();
    await options.goto(fixtureOrigin + '/options/options.html');
    await options.waitForFunction(() => !document.getElementById('save-api-btn').disabled);
    assert.equal(await options.locator('#openai-key').inputValue(), '');
    assert.match(await options.locator('#connection-state').innerText(), /Ayar gerekli/);
    const editor = await context.newPage();
    const alerts = [];
    editor.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
    await editor.goto(fixtureOrigin + '/editor.html');
    const button = editor.locator('.ai-text-corrector-button');
    const modal = editor.locator('#ai-text-corrector-modal');
    const accept = modal.locator('[data-action="accept"]');
    const cancel = modal.locator('[data-action="reject"]');
    const readHTML = () => editor.locator('.ql-editor').innerHTML();
    const seed = html => editor.locator('.ql-editor').evaluate((node, html) => { node.innerHTML = html; }, html);
    const preview = async () => { await button.click(); await modal.waitFor({ state: 'visible' }); };
    const errorCorrection = async () => {
        const alertsBefore = alerts.length;
        const shownError = editor.waitForEvent('dialog');
        await button.click();
        await shownError;
        await editor.waitForFunction(() => !document.querySelector('.ai-text-corrector-button').disabled);
        assert.ok(alerts.length > alertsBefore);
        assert.equal(await modal.count(), 0);
        assert.equal(await readHTML(), initialHTML);
    };
    await button.waitFor({ state: 'visible' });
    await errorCorrection();
    assert.equal(requests.length, 0);
    assert.match(alerts.at(-1), /anahtar|bağlantı|sağlayıcı/i);
    checks.push('Fresh first correction without setup explains the missing connection, preserves text and makes no transport call.');
    await options.locator('[data-provider="ollama"]').click();
    await options.waitForFunction(() => !document.getElementById('refresh-models').disabled);
    assert.match(await options.locator('#connection-status').innerText(), /izni verilmedi/);
    assert.equal(requests.length, 0);
    assert.deepEqual(local, {});
    assert.deepEqual(permissionRequests.at(-1), ['http://127.0.0.1:11434/*']);
    checks.push('Denied permission fixture leaves saved storage empty and makes no model/inference transport call.');
    await capture(options, 'permission-denied.png');
    allowPermission = true;
    await options.locator('#refresh-models').click();
    await options.waitForFunction(() => !document.getElementById('refresh-models').disabled);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'http://127.0.0.1:11434/api/tags');
    assert.equal(await options.locator('#model-options [role="option"]').count(), 1);
    await options.locator('#model-options [data-value="fixture-turkish:latest"]').click();
    assert.deepEqual(local, {});
    await options.locator('#save-api-btn').click();
    await options.waitForFunction(() => document.getElementById('connection-save-state').dataset.state === 'saved');
    assert.equal(local.ai_provider_config.activeProviderId, 'ollama');
    assert.equal(local.ai_provider_config.providers.ollama.model, 'fixture-turkish:latest');
    assert.equal(local.ai_provider_config.providers.ollama.apiKey, '');
    checks.push('Allowed permission stub discovers one synthetic text model, filters embedding-only, and saves keyless Ollama only after Save.');
    await options.locator('#test-btn').click();
    await options.waitForFunction(() => !document.getElementById('test-btn').disabled);
    assert.match(await options.locator('#connection-status').innerText(), /Bağlantı başarılı/);
    assert.equal(requests.at(-1).body.messages.find(item => item.role === 'user').content, 'Bu bir test metnidir.');
    checks.push('Connection Test traverses the actual background and ProviderService sources with saved model and deterministic transport.');
    await capture(options, 'saved-settings.png');

    await button.waitFor({ state: 'visible' });
    assert.equal(await button.count(), 1);
    assert.equal(await editor.locator('.ql-toolbar > .ai-text-corrector-button').count(), 1);
    assert.equal(await editor.locator('label .ai-text-corrector-button').count(), 0);
    const callsBeforeScript = requests.length;
    await button.evaluate(node => node.click());
    await editor.waitForTimeout(50);
    assert.equal(requests.length, callsBeforeScript);
    checks.push('Synthetic Quill-shaped API fixture gets one button; ordinary fields get none; script click cannot start correction.');
    const before = await readHTML();
    await preview();
    assert.equal(await readHTML(), before);
    assert.match(await modal.innerText(), /bugün/);
    await capture(editor, 'first-preview.png');
    await cancel.click();
    await modal.waitFor({ state: 'detached' });
    assert.equal(await readHTML(), before);
    checks.push('First synthetic correction shows diff before writing; Cancel preserves exact original HTML.');
    await preview();
    await editor.keyboard.press('Escape');
    await modal.waitFor({ state: 'detached' });
    assert.equal(await readHTML(), before);
    checks.push('Escape preserves exact original HTML.');
    await preview();
    await accept.evaluate(node => node.click());
    await editor.waitForTimeout(50);
    assert.equal(await readHTML(), before);
    await accept.click();
    await modal.waitFor({ state: 'detached' });
    const accepted = await readHTML();
    assert.match(accepted, /bugün çok güzel/);
    assert.match(accepted, /<strong>Ali<\/strong>/);
    assert.match(accepted, /<em>Örnek metin<\/em>/);
    assert.match(accepted, /href="https:\/\/example.test\/"/);
    assert.match(accepted, /<li>birinci madde<\/li>/);
    checks.push('Script Accept cannot write; trusted Accept updates synthetic editor HTML while preserving mapped bold, italic, link and list.');
    await capture(editor, 'accepted.png');
    await seed(initialHTML);
    await preview();
    const newHTML = '<p>Önizleme açıkken yazılan yeni metin korunmalıdır.</p>';
    await seed(newHTML);
    await accept.click();
    await modal.locator('.ai-corrector-error').waitFor({ state: 'visible' });
    assert.equal(await readHTML(), newHTML);
    await cancel.click();
    checks.push('Accept after an intervening editor change refuses the stale result and preserves the new text.');
    await seed(initialHTML);
    correctionMode = 'hold';
    const pendingStarted = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Mocked correction did not start')), 10000);
        holdStarted = () => { clearTimeout(timer); resolve(); };
    });
    await button.click();
    await pendingStarted;
    await editor.waitForFunction(() => document.querySelector('.ai-text-corrector-button').disabled);
    assert.equal(heldCorrection, true);
    await seed(newHTML);
    releaseCorrection();
    await button.waitFor({ state: 'visible' });
    await editor.waitForFunction(() => !document.querySelector('.ai-text-corrector-button').disabled);
    assert.equal(await modal.count(), 0);
    assert.equal(await readHTML(), newHTML);
    assert.match(alerts.at(-1), /değişti/);
    checks.push('A held mocked transport result cannot replace editor text changed during correction.');
    correctionMode = 'broken';
    await seed(initialHTML);
    await button.click();
    await editor.waitForFunction(() => !document.querySelector('.ai-text-corrector-button').disabled);
    assert.equal(await modal.count(), 0);
    assert.equal(await readHTML(), initialHTML);
    assert.match(alerts.at(-1), /geçersiz|döndürmedi|yanıt/);
    checks.push('Invalid corrected_text fixture shows an error, opens no diff and preserves original HTML.');
    correctionMode = 'paragraph';
    await preview();
    assert.equal(await modal.locator('.ai-corrector-warning').isVisible(), true);
    await cancel.click();
    assert.equal(await readHTML(), initialHTML);
    checks.push('Structural edit fixture discloses plain-text fallback; Cancel preserves formatting.');
    correctionMode = 'malicious';
    await preview();
    assert.equal(await modal.locator('img, script').count(), 0);
    await accept.click();
    await modal.waitFor({ state: 'detached' });
    assert.match(await readHTML(), /&lt;img/);
    assert.equal(await editor.evaluate(() => window.fixtureExecuted), undefined);
    checks.push('Model HTML-looking text is escaped in preview and accepted text; no script executes.');
    correctionMode = 'correct';
    await seed(initialHTML);
    await preview();
    await popup.locator('#enabled-toggle').uncheck();
    await button.waitFor({ state: 'detached' });
    assert.equal(await modal.count(), 0);
    assert.equal(await readHTML(), initialHTML);
    await popup.locator('#enabled-toggle').check();
    await button.waitFor({ state: 'visible' });
    assert.equal(await button.count(), 1);
    checks.push('Popup toggle stub cancels preview, preserves text, removes button, then restores exactly one button.');

    await options.locator('[data-provider="openai"]').click();
    await options.locator('#save-api-btn').click();
    await options.waitForFunction(() => !document.getElementById('save-api-btn').disabled);
    const callsBeforeKey = requests.length;
    await errorCorrection();
    assert.equal(requests.length, callsBeforeKey);
    assert.match(alerts.at(-1), /anahtar/i);
    checks.push('Saved cloud profile with an empty key remains incomplete and cannot make a correction transport call.');
    await options.locator('#openai-key').fill('synthetic-only-not-a-real-credential');
    await options.locator('#save-api-btn').click();
    await options.waitForFunction(() => document.getElementById('connection-save-state').dataset.state === 'saved');
    grants.delete('https://api.openai.com/*');
    const callsBeforePermission = requests.length;
    await errorCorrection();
    assert.equal(requests.length, callsBeforePermission);
    assert.match(alerts.at(-1), /izin/i);
    checks.push('Revoked cloud permission stub blocks correction before mocked transport.');
    grants.add('https://api.openai.com/*');
    correctionMode = 'offline';
    await errorCorrection();
    assert.match(alerts.at(-1), /bağlantı|bağlan|eriş/i);
    checks.push('Offline cloud transport fixture shows the fixed connection error and preserves the original.');
    correctionMode = 'correct';
    await options.locator('#test-btn').click();
    await options.waitForFunction(() => !document.getElementById('test-btn').disabled);
    assert.match(await options.locator('#connection-status').innerText(), /Bağlantı başarılı/);
    assert.equal(requests.at(-1).body.model, 'gpt-4o');
    assert.equal(requests.at(-1).body.messages.find(item => item.role === 'user').content, 'Bu bir test metnidir.');
    checks.push('Saved synthetic OpenAI connection Test succeeds before the editor correction, with the saved gpt-4o model.');
    await preview();
    assert.equal(requests.at(-1).body.store, false);
    assert.equal(requests.at(-1).body.model, 'gpt-4o');
    await cancel.click();
    assert.equal(await readHTML(), initialHTML);
    await preview();
    await accept.click();
    await modal.waitFor({ state: 'detached' });
    assert.match(await readHTML(), /bugün çok güzel/);
    checks.push('Synthetic OpenAI/gpt-4o response uses the same Cancel/Accept flow with store:false; no live key or inference.');
    await seed(initialHTML);
    await options.locator('[data-provider="llamacpp"]').click();
    await options.waitForFunction(() => !document.getElementById('refresh-models').disabled);
    assert.equal(requests.at(-1).url, 'http://127.0.0.1:8080/v1/models');
    await options.locator('#model-options [data-value="fixture-llama"]').click();
    await options.locator('#save-api-btn').click();
    await options.waitForFunction(() => document.getElementById('connection-save-state').dataset.state === 'saved');
    assert.equal(local.ai_provider_config.activeProviderId, 'llamacpp');
    await options.locator('#test-btn').click();
    await options.waitForFunction(() => !document.getElementById('test-btn').disabled);
    assert.match(await options.locator('#connection-status').innerText(), /Bağlantı başarılı/);
    assert.equal(requests.at(-1).body.model, 'fixture-llama');
    assert.equal(requests.at(-1).body.messages.find(item => item.role === 'user').content, 'Bu bir test metnidir.');
    checks.push('Saved keyless llama.cpp connection Test succeeds before correction, using the selected synthetic model.');
    await preview();
    await cancel.click();
    assert.equal(await readHTML(), initialHTML);
    await preview();
    await accept.click();
    await modal.waitFor({ state: 'detached' });
    assert.match(await readHTML(), /bugün çok güzel/);
    checks.push('Keyless llama.cpp fixture uses /v1/models and saved model, with Cancel preserving original and Accept applying text.');
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedNetworkRequests, []);
    checks.push('No browser page errors or unexpected external requests; all requests fulfilled from memory.');
    const result = {
        generatedAt: new Date().toISOString(), extensionVersion: manifest.version, browser: browser.version(), sourceRoot: root, label,
        command: 'node tests/first-correction-fixture.mjs', testHarnessSHA256, checkCount: checks.length, checks, sourceSHA256,
        realExtensionInstalled: false, realChromePermissionGranted: false, persistentProfileUsed: false,
        realCredentialConfigured: false, realProviderNetworkCalls: 0, realStoreInstallTest: 'NOT RUN',
        mockedTransportCalls: requests.length, mockedPermissionRequests: permissionRequests.length,
        pageErrors: errors, unexpectedNetworkRequests,
        limitations: [
            'Source UI scripts run in ordinary pages with chrome API stubs; MAIN/ISOLATED extension worlds, real Chrome permission dialogs and MV3 lifetime are not exercised.',
            'The editor is a small synthetic Quill-shaped API fixture, not the upstream Quill library or a CMS compatibility result.',
            'Mocked OpenAI, Ollama and llama.cpp responses validate application flow, not a live server, provider model quality, billing or store installation.'
        ]
    };
    await writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ checkCount: checks.length, realStoreInstallTest: result.realStoreInstallTest, realProviderNetworkCalls: 0, evidence: path.relative(testRoot, path.join(output, 'results.json')) }, null, 2));
} finally {
    if (releaseCorrection) releaseCorrection();
    if (browser) await browser.close();
}
