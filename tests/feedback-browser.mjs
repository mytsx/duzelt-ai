/* Disposable local Chromium UI proof. Turnstile/config/POST are intercepted fixtures; no real CAPTCHA or mail. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const output = path.join(root, 'output/playwright/feedback');
const sourceFiles = ['site/support/index.html', 'site/assets/css/feedback.css', 'site/assets/js/feedback.js', 'site/assets/js/site.js', 'site/assets/js/config.js', 'site/_headers'];
const sourceHashes = {};
for (const file of sourceFiles) sourceHashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
const headersSource = await readFile(path.join(site, '_headers'), 'utf8');
const headers = Object.fromEntries(headersSource.split('\n').filter(line => /^  (Content-Security-Policy|Referrer-Policy|X-Content-Type-Options|X-Frame-Options|Permissions-Policy|Cross-Origin-Opener-Policy):/.test(line)).map(line => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
}));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(site, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
        if (!file.startsWith(site + path.sep)) { response.writeHead(400).end(); return; }
        let content; let status = 200; let extension = path.extname(file);
        try { content = await readFile(file); }
        catch { content = await readFile(path.join(site, '404.html')); status = 404; extension = '.html'; }
        response.writeHead(status, { ...headers, 'Content-Type': types[extension] || 'application/octet-stream' });
        response.end(content);
    } catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const checks = [];
const screenshots = [];
const pageErrors = [];
const unexpectedExternalRequests = [];
let browser;
let activeContexts = [];

function turnstileFixture(options) {
    return `(() => {
        const fixture = window.feedbackFixture = { renders: 0, resets: 0, generation: 0, readyCalls: 0, options: null };
        const complete = () => {
            if (${JSON.stringify(options.autoToken !== false)}) setTimeout(() => fixture.options.callback('fixture-token-' + (++fixture.generation)), 20);
        };
        window.turnstile = {
            ready: callback => {
                fixture.readyCalls++;
                const script = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
                if (script && (script.async || script.defer)) throw new Error('Remove async/defer from the Turnstile api.js script tag before using turnstile.ready().');
                callback();
            },
            render: (selector, config) => {
                fixture.options = config; fixture.renders++;
                const frame = document.createElement('iframe');
                frame.src = 'https://challenges.cloudflare.com/feedback-browser-fixture';
                frame.title = 'Yerel test doğrulaması'; frame.width = '150'; frame.height = '140';
                document.querySelector(selector).appendChild(frame);
                ${options.widgetError ? "setTimeout(() => config['error-callback']('fixture-error'), 10);" : 'complete();'}
                return 'fixture-widget';
            },
            reset: id => { if (id !== 'fixture-widget') throw new Error('Unknown widget'); fixture.resets++; complete(); },
            remove: () => document.querySelector('#feedback-turnstile').replaceChildren()
        };
    })();`;
}

async function scenario(options = {}) {
    const context = await browser.newContext({ viewport: { width: options.width || 390, height: 1000 }, colorScheme: options.theme || 'light', reducedMotion: 'reduce', javaScriptEnabled: options.javaScriptEnabled !== false });
    activeContexts.push(context);
    const state = { configRequests: 0, posts: [], scripts: [], frameRequests: [], options };
    await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === origin && url.pathname === '/api/feedback/config') {
            state.configRequests++;
            if (options.configAbort) { await route.abort('failed'); return; }
            if (options.configHold) await options.configHold;
            await route.fulfill({ status: options.configStatus || 200, contentType: 'application/json', body: JSON.stringify(options.config || { enabled: true, siteKey: '1x00000000000000000000AA', action: 'feedback' }) });
        } else if (url.origin === origin && url.pathname === '/api/feedback') {
            state.posts.push({ body: request.postDataJSON(), headers: request.headers() });
            if (options.postHold) await options.postHold;
            if (options.postAbort) { await route.abort('failed'); return; }
            await route.fulfill({ status: options.postStatus || 202, contentType: 'application/json', body: options.postMalformed ? 'not-json' : JSON.stringify(options.postBody || { accepted: true, id: 'abc12345', message: 'Geri bildiriminiz alındı.' }) });
        } else if (url.origin === origin) {
            await route.continue();
        } else if (url.origin === 'https://challenges.cloudflare.com' && url.pathname === '/turnstile/v0/api.js') {
            state.scripts.push(url.href);
            if (options.scriptAbort) { await route.abort('failed'); return; }
            await route.fulfill({ status: 200, contentType: 'text/javascript', body: turnstileFixture(options) });
        } else if (url.origin === 'https://challenges.cloudflare.com' && url.pathname === '/feedback-browser-fixture') {
            state.frameRequests.push(url.href);
            await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="color-scheme" content="light dark"><style>body{margin:0;min-height:140px;display:grid;align-content:center;gap:8px;padding:12px;box-sizing:border-box;font:13px system-ui;color:#27347d;background:#f2f5ff}strong{font-size:15px}@media(prefers-color-scheme:dark){body{color:#ebedf2;background:#161a26}}</style><body><strong>Yerel test</strong><span>Gerçek CAPTCHA veya posta gönderimi yapılmaz.</span></body></html>' });
        } else {
            unexpectedExternalRequests.push(url.href);
            await route.abort('blockedbyclient');
        }
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(origin + '/support/' + (options.hash ? '#geri-bildirim' : ''));
    return {
        page, context, state,
        async open({ token = true } = {}) {
            await page.locator('#feedback-open').click();
            await page.waitForFunction(() => !document.getElementById('feedback-panel').hidden);
            if (token) await page.waitForFunction(() => !document.getElementById('feedback-submit').disabled);
        },
        async finish() { await context.close(); activeContexts = activeContexts.filter(item => item !== context); }
    };
}

async function capture(page, filename) {
    const viewport = page.viewportSize();
    const frame = page.locator('#feedback-turnstile iframe');
    if (await frame.count()) {
        await frame.scrollIntoViewIfNeeded();
        await page.frameLocator('#feedback-turnstile iframe').getByText('Yerel test', { exact: true }).waitFor();
    }
    await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
    await page.waitForFunction(() => scrollY === 0);
    let bounds = await page.locator('#geri-bildirim').boundingBox();
    // Chromium can omit offscreen cross-origin iframe pixels in captureBeyondViewport.
    // Keep the same tested width and put the whole section in the viewport for native capture.
    await page.setViewportSize({ width: viewport.width, height: Math.ceil(bounds.y + bounds.height + 24) });
    try {
        await page.waitForTimeout(50);
        bounds = await page.locator('#geri-bildirim').boundingBox();
        await page.screenshot({ path: path.join(output, filename), clip: bounds });
    } finally {
        await page.setViewportSize(viewport);
    }
    screenshots.push('output/playwright/feedback/' + filename);
}

async function completeMessage(page) {
    await page.locator('#feedback-message').fill('Düzeltme önizlemesindeki düğme dar ekranda görünmüyor. Yeniden üretme adımlarını burada paylaşabilirim.');
}

try {
    await mkdir(output, { recursive: true });
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    for (const theme of ['light', 'dark']) {
        for (const width of [320, 390, 768, 1440]) {
            const s = await scenario({ width, theme, hash: true });
            assert.equal(s.state.configRequests, 0);
            assert.deepEqual(s.state.scripts, []);
            assert.equal(await s.page.locator('#feedback-panel').isVisible(), false);
            assert.equal(await s.page.locator('#feedback-email-fallback').isVisible(), true);
            await s.open();
            assert.equal(await s.page.evaluate(() => window.feedbackFixture.readyCalls), 0, 'Async-loaded SDK is rendered after onload without turnstile.ready()');
            await completeMessage(s.page);
            await s.page.locator('.feedback-details summary').click();
            assert.equal(await s.page.locator('#feedback-version').inputValue(), '');
            assert.equal(await s.page.locator('#feedback-browser').inputValue(), '');
            assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.equal(await s.page.locator('.feedback-field input, .feedback-field textarea, .feedback-field select').evaluateAll(nodes => nodes.every(node => {
                const rect = node.getBoundingClientRect();
                return rect.left >= 0 && rect.right <= innerWidth && node.labels.length > 0;
            })), true);
            assert.equal(await s.page.locator('#feedback-form').getAttribute('aria-busy'), 'false');
            assert.equal(await s.page.locator('#feedback-status').getAttribute('aria-live'), 'polite');
            assert.equal(await s.page.locator('#feedback-email-fallback').getAttribute('href'), 'mailto:iletisim@mehmetyerli.com');
            assert.equal(await s.page.locator('#feedback-website').getAttribute('tabindex'), '-1');
            await capture(s.page, `form-${theme}-${width}.png`);
            checks.push(`${theme}/${width}: lazy opening, labelled fields, empty optional details, visible email and no overflow.`);
            await s.finish();
        }
    }

    {
        const s = await scenario();
        await s.page.locator('#feedback-open').evaluate(node => node.click());
        assert.equal(s.state.configRequests, 0);
        assert.equal(await s.page.locator('#feedback-panel').isVisible(), false);
        await s.page.locator('#feedback-open').focus();
        await s.page.keyboard.press('Enter');
        await s.page.waitForFunction(() => !document.getElementById('feedback-submit').disabled);
        assert.equal(await s.page.evaluate(() => window.feedbackFixture.readyCalls), 0);
        assert.equal(await s.page.evaluate(() => document.activeElement.id), 'feedback-type');
        assert.equal(await s.page.locator('#feedback-open').getAttribute('aria-expanded'), 'true');
        assert.equal(await s.page.getByRole('combobox', { name: 'Bildirim türü' }).count(), 1);
        assert.equal(await s.page.getByRole('textbox', { name: 'Mesajınız (zorunlu)' }).count(), 1);
        assert.equal(await s.page.getByRole('textbox', { name: 'Yanıt e-postası (isteğe bağlı)' }).count(), 1);
        assert.match(await s.page.locator('#feedback-form').ariaSnapshot(), /Geri bildirim formu/);
        await s.page.locator('.feedback-details summary').focus();
        await s.page.keyboard.press('Enter');
        assert.equal(await s.page.locator('.feedback-details').evaluate(node => node.open), true);
        assert.equal(await s.page.locator('.feedback-details summary').evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
        await s.page.keyboard.press('Tab');
        assert.equal(await s.page.evaluate(() => document.activeElement.id), 'feedback-version');
        assert.equal(await s.page.locator('#feedback-submit').evaluate(node => getComputedStyle(node).transitionDuration), '1e-05s');
        checks.push('Trusted keyboard opening, async SDK onload without ready(), focus placement, computed accessible names, native disclosure and reduced motion work; synthetic opening sends nothing.');
        await s.finish();
    }

    {
        const s = await scenario(); await s.open();
        await s.page.locator('#feedback-submit').click();
        assert.equal(s.state.posts.length, 0);
        assert.equal(await s.page.evaluate(() => document.activeElement.id), 'feedback-message');
        await s.page.locator('#feedback-message').fill('   ');
        await s.page.locator('#feedback-submit').click();
        assert.equal(s.state.posts.length, 0);
        await completeMessage(s.page);
        await s.page.locator('#feedback-email').fill('adres-degil');
        await s.page.locator('#feedback-submit').click();
        assert.equal(s.state.posts.length, 0);
        assert.equal(await s.page.evaluate(() => document.activeElement.id), 'feedback-email');
        await s.page.locator('#feedback-message').fill('a'.repeat(4001));
        assert.equal((await s.page.locator('#feedback-message').inputValue()).length, 4000);
        assert.match(await s.page.locator('#feedback-count').innerText(), /^4000 \/ 4000/);
        checks.push('Empty/whitespace message and invalid optional email cannot submit; user text is limited to 4000 characters.');
        await s.finish();
    }

    for (const type of ['bug', 'suggestion', 'feature']) {
        const s = await scenario(); await s.open(); await completeMessage(s.page);
        await s.page.locator('#feedback-type').selectOption(type);
        await s.page.locator('#feedback-submit').click();
        await s.page.waitForFunction(() => document.getElementById('feedback-status').dataset.state === 'success');
        assert.equal(s.state.posts.length, 1);
        assert.deepEqual(Object.keys(s.state.posts[0].body).sort(), ['type', 'message', 'replyEmail', 'appVersion', 'browser', 'website', 'turnstileToken'].sort());
        assert.equal(s.state.posts[0].body.type, type);
        assert.equal(s.state.posts[0].body.replyEmail, '');
        assert.equal(s.state.posts[0].body.appVersion, '');
        assert.equal(s.state.posts[0].body.browser, '');
        assert.equal(s.state.posts[0].body.website, '');
        assert.equal(s.state.posts[0].headers['content-type'], 'application/json');
        assert.equal(s.state.posts[0].headers.cookie, undefined);
        assert.equal(s.state.posts[0].headers.referer, undefined);
        assert.match(await s.page.locator('#feedback-status').innerText(), /abc12345/);
        assert.match(await s.page.locator('#feedback-status').innerText(), /dönüş yapamayız/);
        assert.doesNotMatch(await s.page.locator('#feedback-status').innerText(), /teslim edildi/);
        assert.equal(await s.page.locator('#feedback-message').inputValue(), '');
        assert.equal(await s.page.evaluate(() => window.feedbackFixture.resets), 1);
        if (type === 'bug') await capture(s.page, 'accepted-without-email.png');
        checks.push(`${type}: exact seven-field payload, no email/automatic metadata, acknowledged queue acceptance and single widget reset.`);
        await s.finish();
    }

    {
        const s = await scenario(); await s.open(); await completeMessage(s.page);
        await s.page.locator('#feedback-email').fill('example@example.com');
        await s.page.locator('.feedback-details summary').click();
        await s.page.locator('#feedback-version').fill('3.4.0');
        await s.page.locator('#feedback-browser').fill('Chrome — kullanıcı tarafından yazıldı');
        await s.page.locator('#feedback-submit').click();
        await s.page.waitForFunction(() => document.getElementById('feedback-status').dataset.state === 'success');
        assert.equal(s.state.posts[0].body.replyEmail, 'example@example.com');
        assert.equal(s.state.posts[0].body.appVersion, '3.4.0');
        assert.equal(s.state.posts[0].body.browser, 'Chrome — kullanıcı tarafından yazıldı');
        assert.doesNotMatch(await s.page.locator('#feedback-status').innerText(), /dönüş yapamayız/);
        checks.push('Optional email and manually written technical details are sent only when explicitly filled.');
        await s.finish();
    }

    {
        let release; const hold = new Promise(resolve => { release = resolve; });
        const s = await scenario({ postHold: hold }); await s.open(); await completeMessage(s.page);
        await s.page.locator('#feedback-form').evaluate(node => node.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(s.state.posts.length, 0);
        await s.page.locator('#feedback-submit').click();
        await s.page.waitForFunction(() => document.getElementById('feedback-form').getAttribute('aria-busy') === 'true');
        assert.equal(await s.page.locator('#feedback-submit').isDisabled(), true);
        assert.equal(await s.page.locator('#feedback-message').isDisabled(), true);
        assert.match(await s.page.locator('#feedback-status').innerText(), /Gönderiliyor/);
        await s.page.locator('#feedback-form').evaluate(node => { node.requestSubmit(); node.requestSubmit(); });
        assert.equal(s.state.posts.length, 1);
        await capture(s.page, 'pending-single-request.png');
        release();
        await s.page.waitForFunction(() => document.getElementById('feedback-status').dataset.state === 'success');
        assert.equal(await s.page.locator('#feedback-form').getAttribute('aria-busy'), 'false');
        checks.push('Pending state disables editing/submission; repeated in-flight submit attempts produce one POST and no automatic retry.');
        await s.finish();
    }

    const failures = [[400, 'validation'], [400, 'honeypot'], [400, 'turnstile'], [429, 'rate_limit'], [413, 'too_large'], [503, 'unavailable'], [403, 'origin'], [415, 'content_type'], [400, 'invalid_json']];
    for (const [postStatus, error] of failures) {
        const s = await scenario({ postStatus, postBody: { error } }); await s.open(); await completeMessage(s.page);
        await s.page.locator('#feedback-email').fill('example@example.com');
        const text = await s.page.locator('#feedback-message').inputValue();
        await s.page.locator('#feedback-submit').click();
        await s.page.waitForFunction(() => document.getElementById('feedback-status').dataset.state === 'error');
        assert.equal(await s.page.locator('#feedback-message').inputValue(), text);
        assert.equal(await s.page.locator('#feedback-email').inputValue(), 'example@example.com');
        assert.equal(await s.page.locator('#feedback-email-fallback').isVisible(), true);
        assert.equal(await s.page.evaluate(() => window.feedbackFixture.resets), 1);
        assert.equal(s.state.posts.length, 1);
        if (error === 'turnstile') await capture(s.page, 'error-message-preserved.png');
        checks.push(`${postStatus}/${error}: message/email preserved, email alternative remains visible, spent token reset once.`);
        await s.finish();
    }

    for (const options of [{ postAbort: true }, { postMalformed: true }, { postStatus: 200, postBody: { accepted: true, id: 'abc12345' } }, { postBody: { accepted: true, id: '<script>' } }]) {
        const s = await scenario(options); await s.open();
        const literal = '<img src=x onerror=window.feedbackInjected=true> Gönderilemezse bu metin korunmalı.';
        await s.page.locator('#feedback-message').fill(literal);
        await s.page.locator('#feedback-submit').click();
        await s.page.waitForFunction(() => document.getElementById('feedback-status').dataset.state === 'error');
        assert.equal(await s.page.locator('#feedback-message').inputValue(), literal);
        assert.equal(await s.page.evaluate(() => window.feedbackInjected), undefined);
        assert.equal(await s.page.locator('#feedback-status img, #feedback-status script').count(), 0);
        assert.equal(await s.page.locator('#feedback-email-fallback').isVisible(), true);
        assert.equal(await s.page.evaluate(() => window.feedbackFixture.resets), 1);
        checks.push('Network/malformed/unacknowledged response failure preserves literal message, never inserts response HTML or claims delivery.');
        await s.finish();
    }

    for (const options of [{ config: { enabled: false, siteKey: '', action: 'feedback' } }, { configAbort: true }, { config: { enabled: true, siteKey: 'fixture', action: 'wrong' } }, { config: { enabled: true, siteKey: { invalid: true }, action: 'feedback' } }, { scriptAbort: true }, { widgetError: true }]) {
        const s = await scenario(options); await s.open({ token: false });
        await s.page.waitForFunction(() => !document.getElementById('feedback-retry').hidden);
        await completeMessage(s.page);
        assert.equal(await s.page.locator('#feedback-submit').isDisabled(), true);
        assert.equal(await s.page.locator('#feedback-email-fallback').isVisible(), true);
        assert.equal(s.state.posts.length, 0);
        assert.ok(await s.page.locator('#feedback-verification-status').innerText());
        if (options.config?.enabled === false) {
            assert.deepEqual(s.state.scripts, []);
            await capture(s.page, 'unavailable-email-alternative.png');
        }
        checks.push('Disabled, invalid, offline or broken CAPTCHA setup fails closed with draft text and visible email alternative.');
        await s.finish();
    }

    {
        const s = await scenario(); await s.open(); await completeMessage(s.page);
        const config = await s.page.evaluate(() => {
            const o = window.feedbackFixture.options;
            return { action: o.action, size: o.size, language: o.language, retry: o.retry, expired: o['refresh-expired'], timeout: o['refresh-timeout'], response: o['response-field'] };
        });
        assert.deepEqual(config, { action: 'feedback', size: 'compact', language: 'tr', retry: 'never', expired: 'manual', timeout: 'manual', response: false });
        for (const callback of ['expired-callback', 'timeout-callback', 'unsupported-callback']) {
            await s.page.evaluate(name => window.feedbackFixture.options[name](), callback);
            assert.equal(await s.page.locator('#feedback-submit').isDisabled(), true);
            assert.equal(await s.page.locator('#feedback-retry').isVisible(), true);
            await s.page.locator('#feedback-retry').click();
            await s.page.waitForFunction(() => !document.getElementById('feedback-submit').disabled);
        }
        assert.equal(s.state.configRequests, 1);
        assert.equal(s.state.scripts.length, 1);
        assert.equal(await s.page.evaluate(() => window.feedbackFixture.renders), 1);
        assert.equal(await s.page.evaluate(() => window.feedbackFixture.resets), 3);
        assert.equal(s.state.posts.length, 0);
        checks.push('Expiry/timeout/unsupported state revokes the token; explicit retry resets one existing compact Turkish widget without duplicate loaders.');
        await s.finish();
    }

    {
        let release; const hold = new Promise(resolve => { release = resolve; });
        const s = await scenario({ configHold: hold }); await s.open({ token: false });
        await s.page.locator('#feedback-open-inline').click();
        assert.equal(s.state.configRequests, 1);
        await completeMessage(s.page);
        const text = await s.page.locator('#feedback-message').inputValue();
        release(); await s.page.waitForFunction(() => !document.getElementById('feedback-submit').disabled);
        assert.equal(await s.page.locator('#feedback-message').inputValue(), text);
        assert.equal(s.state.scripts.length, 1);
        checks.push('Repeated opening during config loading produces one setup request and preserves text typed while preparing.');
        await s.finish();
    }

    {
        const s = await scenario({ javaScriptEnabled: false, width: 320, hash: true });
        assert.equal(await s.page.locator('#feedback-email-fallback').isVisible(), true);
        assert.equal(await s.page.locator('noscript').isVisible(), true);
        assert.equal(await s.page.locator('#feedback-panel').isVisible(), false);
        assert.equal(await s.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(s.state.configRequests, 0);
        assert.deepEqual(s.state.scripts, []);
        await capture(s.page, 'no-javascript-320.png');
        checks.push('Without JavaScript, email and separate GitHub routes remain usable at 320px and no CAPTCHA/network submission is attempted.');
        await s.finish();
    }
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(unexpectedExternalRequests, []);
    for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(createHash('sha256').update(await readFile(path.join(root, file))).digest('hex'), hash, 'Captured source remains stable: ' + file);
    const results = { checkedOn: new Date().toISOString(), browser: browser.version(), checkCount: checks.length, responsiveCases: 8, checks, sourceHashes, screenshots, pageErrors, realExternalCalls: 0, turnstileAndMail: 'All config, widget script/iframe and POST responses are local intercepted fixtures. No real CAPTCHA, credentials, queue or email delivery was exercised.', accessibilityScope: 'Native Chromium accessibility names/tree, labels, keyboard and status attributes; not a standalone screen-reader session.', captureMethod: 'Native section clip at the tested width, temporarily increasing viewport height to include the loaded cross-origin fixture iframe. No DOM or product style changes/masks; original viewport restored after capture.', visualReviewPending: true };
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify({ checks: checks.length, responsiveCases: 8, screenshots: screenshots.length, pageErrors, realExternalCalls: 0, output: 'output/playwright/feedback/results.json' }, null, 2));
} finally {
    for (const context of activeContexts) await context.close().catch(() => {});
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
}
