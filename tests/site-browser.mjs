/* Local static site in a disposable Chromium context. External navigation/video use fixtures only. */
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
const output = path.join(root, 'output/playwright/site');
const evidence = path.join(root, 'evidence/site-ui-results.json');
const captureLayouts = !process.argv.includes('--interactions-only');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const headersFile = await readFile(path.join(site, '_headers'), 'utf8');
const securityHeaders = Object.fromEntries(headersFile.split('\n').filter(line => /^  (Content-Security-Policy|Referrer-Policy|X-Content-Type-Options|X-Frame-Options|Permissions-Policy|Cross-Origin-Opener-Policy):/.test(line)).map(line => {
    const separator = line.indexOf(':');
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
}));
const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(site, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
        if (!file.startsWith(site + path.sep)) { response.writeHead(400).end(); return; }
        let content;
        let status = 200;
        let extension = path.extname(file);
        try { content = await readFile(file); }
        catch { content = await readFile(path.join(site, '404.html')); status = 404; extension = '.html'; }
        response.writeHead(status, { ...securityHeaders, 'Content-Type': types[extension] || 'application/octet-stream' });
        response.end(content);
    } catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
const checks = [];
const errors = [];
const externalRequests = [];
const screenshots = [];
const configSource = await readFile(path.join(site, 'assets/js/config.js'), 'utf8');
const files = ['site/index.html', 'site/support/index.html', 'site/privacy/index.html', 'site/404.html', 'site/assets/css/site.css', 'site/assets/js/site.js', 'site/assets/js/config.js', 'site/_headers', ...['popup-light', 'popup-dark', 'options-desktop', 'options-openrouter', 'editor-before', 'editor-preview', 'editor-accepted', 'video-cover'].map(name => 'site/assets/img/' + name + '.png')];
const inputHashes = {};
for (const file of files) inputHashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
let configOverride = null;
const pages = [{ name: 'home', url: '/', title: 'Türkçe metninizi' }, { name: 'support', url: '/support/', title: 'Kurulum ve sorun giderme' }, { name: 'privacy', url: '/privacy/', title: 'Gizlilik' }, { name: '404', url: '/missing/deep/page', title: 'Sayfa bulunamadı' }];
try {
    await mkdir(output, { recursive: true });
    await mkdir(path.dirname(evidence), { recursive: true });
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(10000);
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && url.pathname === '/assets/js/config.js' && configOverride) {
            await route.fulfill({ status: 200, contentType: types['.js'], body: configSource + '\nwindow.SITE_CONFIG = Object.freeze(Object.assign({}, window.SITE_CONFIG, ' + JSON.stringify(configOverride) + '));' });
        } else if (url.origin === origin) await route.continue();
        else { externalRequests.push(url.href); await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>External destination fixture</title>' }); }
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404 (Not Found)')) errors.push(message.text()); });
    const load = async url => {
        const response = await page.goto(origin + url);
        await page.waitForFunction(() => document.documentElement.classList.contains('js'));
        return response;
    };
    const readyForImage = async () => {
        await page.evaluate(async () => {
            document.activeElement?.blur();
            for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
                scrollTo(0, y);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            await Promise.all(Array.from(document.images).filter(image => image.getClientRects().length).map(image => image.decode().catch(() => {})));
            scrollTo(0, 0);
        });
        await page.waitForFunction(() => scrollY === 0);
    };
    const checkLocalLinks = async () => {
        const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.href));
        for (const href of new Set(links)) {
            const url = new URL(href);
            if (url.origin !== origin) continue;
            const response = await context.request.get(url.origin + url.pathname);
            const isCurrent404Fragment = url.pathname === '/missing/deep/page' && url.hash;
            assert.equal(response.status(), isCurrent404Fragment ? 404 : 200, 'Local link resolves: ' + url.pathname);
            if (url.hash && response.headers()['content-type']?.includes('text/html')) {
                const body = await response.text();
                assert.ok(body.includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"'), 'Local fragment exists: ' + url.pathname + url.hash);
            }
        }
    };
    await load('/');
    const videoConfiguration = await page.evaluate(() => ({ url: window.SITE_CONFIG.video, durationSeconds: window.SITE_CONFIG.videoDurationSeconds, cover: window.SITE_CONFIG.videoCover, title: window.SITE_CONFIG.videoTitle }));
    for (const entry of captureLayouts ? pages : []) {
        for (const theme of ['light', 'dark']) {
            await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
            for (const width of [320, 390, 768, 1024, 1440]) {
                await page.setViewportSize({ width, height: 1000 });
                const response = await load(entry.url);
                assert.equal(response.status(), entry.name === '404' ? 404 : 200);
                assert.match(await page.locator('h1').innerText(), new RegExp(entry.title, 'i'));
                assert.equal(await page.locator('h1').count(), 1);
                assert.equal(await page.locator('main').count(), 1);
                assert.equal(await page.locator('html').getAttribute('lang'), 'tr');
                assert.equal(await page.locator('main').getAttribute('tabindex'), '-1');
                await readyForImage();
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${entry.name}/${theme}/${width}px horizontal overflow`);
                assert.equal(await page.locator('img').evaluateAll(nodes => nodes.every(node => node.hasAttribute('alt') && (!node.getClientRects().length || node.complete && node.naturalWidth > 0))), true, 'Visible images load and all images have alt attributes');
                assert.equal(await page.evaluate(() => {
                    const ids = Array.from(document.querySelectorAll('[id]'), node => node.id);
                    return ids.length === new Set(ids).size;
                }), true, 'Unique anchor/label IDs');
                const image = `${entry.name}-${theme}-${width}.png`;
                await page.screenshot({ path: path.join(output, image), fullPage: true });
                screenshots.push('output/playwright/site/' + image);
                checks.push(`${entry.name}: ${theme}, ${width}px; HTTP, landmarks, loaded images and no horizontal overflow.`);
            }
        }
        await checkLocalLinks();
        checks.push(entry.name + ': every local link and fragment resolves.');
        console.log(entry.name + ': responsive and link checks passed');
    }
    assert.deepEqual(externalRequests, [], 'No third-party requests before explicit external actions');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 1000 });
    await load('/');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'icerik');
    const toggle = page.locator('[data-nav-toggle]');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.getElementById('site-menu').contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-nav-toggle')), true);
    await toggle.click();
    const menuBounds = await page.locator('#site-menu').boundingBox();
    assert.ok(menuBounds.y + menuBounds.height < 980, 'Menu leaves an outside pointer target');
    await page.mouse.click(10, 980);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    checks.push('Mobile keyboard skip link, menu focus, Escape and outside dismissal work.');
    await toggle.click();
    await page.locator('#site-menu a[href="#sss"]').click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(new URL(page.url()).hash, '#sss');
    await page.locator('.faq summary').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.faq details').first().evaluate(node => node.open), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.faq details').first().evaluate(node => node.open), false);
    assert.equal(await page.locator('.faq summary').first().evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
    checks.push('FAQ opens/closes using keyboard and has a visible focus outline.');
    const requestsBeforeDemo = externalRequests.length;
    await page.locator('[data-demo-action="accepted"]').click();
    assert.equal(await page.locator('[data-demo-result]').innerText(), await page.locator('[data-demo]').getAttribute('data-after'));
    assert.equal(await page.locator('[data-demo-action="accepted"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-demo-action="cancelled"]').click();
    assert.equal(await page.locator('[data-demo-result]').innerText(), await page.locator('[data-demo]').getAttribute('data-before'));
    assert.equal(await page.locator('[data-demo-result-cell]').getAttribute('aria-live'), 'polite');
    assert.equal(await page.locator('[data-demo-result]').evaluate(node => parseFloat(getComputedStyle(node).animationDuration)), 0.00001);
    assert.equal(externalRequests.length, requestsBeforeDemo);
    checks.push('Accept/cancel demo changes only literal sample text, announces results, respects reduced motion and sends nothing.');
    configOverride = { video: null };
    await load('/');
    assert.equal(await page.locator('[data-video-section]').isVisible(), false);
    assert.equal(await page.locator('iframe').count(), 0);
    checks.push('Unconfigured video stays hidden with no iframe or third-party request.');
    configOverride = null;
    for (const entry of pages.filter(entry => ['support', 'privacy'].includes(entry.name))) {
        await load(entry.url);
        const headings = await page.locator('[data-toc-source] h2').count();
        assert.equal(await page.locator('[data-toc] a').count(), headings);
        await page.waitForFunction(() => document.querySelector('[data-toc] a')?.getAttribute('aria-current') === 'true');
        await page.locator('[data-toc] a').last().click();
        assert.ok(new URL(page.url()).hash);
        await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-toc] a')).at(-1)?.getAttribute('aria-current') === 'true');
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForFunction(() => document.querySelector('[data-toc] a')?.getAttribute('aria-current') === 'true');
        assert.equal(await page.locator('[data-toc] a[aria-current="true"]').count(), 1);
        checks.push(entry.name + ': generated contents navigate to sections; the current section resets correctly after scrolling to the top.');
    }
    await load('/missing/deep/page');
    await page.locator('.notfound a[href="/support/"]').click();
    assert.equal(new URL(page.url()).pathname, '/support/');
    checks.push('Nested 404 uses root asset/navigation paths and support recovery works.');
    const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 1000 } });
    await noJS.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const plain = await noJS.newPage();
    for (const entry of pages) {
        await plain.goto(origin + entry.url);
        assert.equal(await plain.locator('#site-menu').isVisible(), true);
        assert.equal(await plain.locator('h1').count(), 1);
        assert.equal(await plain.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await plain.goto(origin + '/');
    await plain.locator('#site-menu a[href="support/"]').click();
    assert.equal(new URL(plain.url()).pathname, '/support/');
    await noJS.close();
    checks.push('All four pages retain content, menu links and a usable 320px layout with JavaScript disabled.');
    for (const theme of captureLayouts ? ['light', 'dark'] : []) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        for (const width of [390, 1440]) {
            await page.setViewportSize({ width, height: 1000 });
            await load('/');
            await readyForImage();
            const sections = [['hero', '.hero'], ['demo', '#ornek'], ['flow', '#nasil-calisir'], ['connection', '.gallery-row:nth-child(2)'], ['rules', '.gallery-row:nth-child(3)']];
            if (videoConfiguration.url) sections.push(['video', '#video']);
            for (const [name, selector] of sections) {
                const image = `home-${name}-${theme}-${width}.png`;
                await page.evaluate(() => scrollTo(0, 0));
                const bounds = await page.locator(selector).boundingBox();
                await page.screenshot({ path: path.join(output, image), fullPage: true, clip: bounds });
                screenshots.push('output/playwright/site/' + image);
            }
            for (const entry of pages.filter(entry => ['support', 'privacy'].includes(entry.name))) {
                await load(entry.url);
                await readyForImage();
                const image = `${entry.name}-intro-${theme}-${width}.png`;
                await page.screenshot({ path: path.join(output, image) });
                screenshots.push('output/playwright/site/' + image);
            }
        }
    }
    for (const video of ['https://www.youtube.com/watch?v=bad', 'https://youtu.be/aBcdEF12_-3extra', 'https://www.youtube.com/embed/aBcdEF12_-3extra', 'https://example.com/watch?v=aBcdEF12_-3']) {
        configOverride = { video };
        await load('/');
        assert.equal(await page.locator('[data-video-section]').isVisible(), false, 'Malformed/foreign video URL stays hidden: ' + video);
        assert.equal(await page.locator('iframe').count(), 0);
    }
    checks.push('Malformed, truncated and foreign video URLs cannot expose a broken player.');
    const videoId = 'aBcdEF12_-3';
    for (const video of [videoId, 'https://youtu.be/' + videoId, 'https://www.youtube.com/watch?v=' + videoId, 'https://www.youtube-nocookie.com/embed/' + videoId, 'https://www.youtube.com/shorts/' + videoId]) {
        configOverride = { video, videoDurationSeconds: 65 };
        await load('/');
        assert.equal(await page.locator('[data-video-section]').isVisible(), true);
        assert.equal(await page.locator('[data-video-duration]').innerText(), '1:05');
        assert.equal(await page.locator('[data-video-duration]').getAttribute('datetime'), 'PT1M5S');
        assert.equal(await page.locator('iframe').count(), 0);
    }
    checks.push('Exact video IDs and supported YouTube URL formats prepare an accessible local cover without loading a player.');
    configOverride = { video: videoId, videoDurationSeconds: 'Infinity' };
    await load('/');
    assert.equal(await page.locator('[data-video-duration]').isVisible(), false);
    checks.push('Non-finite duration is omitted rather than announced as invalid minutes.');
    await page.locator('[data-video-play]').evaluate(button => button.click());
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(externalRequests.length, 0);
    configOverride = videoConfiguration.url ? null : { video: videoId, videoDurationSeconds: 32 };
    await load('/');
    await page.locator('[data-video-play]').scrollIntoViewIfNeeded();
    await page.locator('[data-video-cover]').evaluate(image => image.decode());
    const configuredId = videoConfiguration.url ? new URL(videoConfiguration.url).searchParams.get('v') || new URL(videoConfiguration.url).pathname.split('/').filter(Boolean).at(-1) : videoId;
    const expectedDuration = videoConfiguration.url ? videoConfiguration.durationSeconds : 32;
    assert.match(configuredId, /^[A-Za-z0-9_-]{11}$/);
    assert.equal(await page.locator('[data-video-section]').isVisible(), true);
    assert.equal(await page.locator('[data-video-duration]').innerText(), '0:' + String(expectedDuration).padStart(2, '0'));
    assert.equal(await page.locator('[data-video-duration]').getAttribute('datetime'), 'PT' + expectedDuration + 'S');
    assert.equal(await page.locator('[data-video-cover]').getAttribute('src'), './' + videoConfiguration.cover);
    assert.equal(await page.locator('[data-video-cover]').evaluate(image => image.naturalWidth === 1280 && image.naturalHeight === 720), true);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(externalRequests.length, 0);
    checks.push('Configured video exposes its current local 1280x720 cover and duration while making no third-party request before play.');
    const videoRequest = page.waitForRequest(request => request.url().startsWith('https://www.youtube-nocookie.com/embed/'));
    await page.locator('[data-video-play]').focus();
    await page.keyboard.press('Enter');
    const iframeRequest = await videoRequest;
    const playerURL = new URL(iframeRequest.url());
    assert.equal(playerURL.pathname, '/embed/' + configuredId);
    assert.equal(playerURL.searchParams.get('mute'), '1');
    assert.equal(playerURL.searchParams.get('cc_lang_pref'), 'tr');
    assert.equal(playerURL.searchParams.get('cc_load_policy'), '1');
    assert.equal(await page.locator('iframe').getAttribute('title'), 'AI Türkçe Metin Düzeltici tanıtım videosu');
    checks.push('Keyboard play loads only a fixture of the privacy-enhanced YouTube player, muted with Turkish caption preference.');
    configOverride = null;
    await load('/');
    const storeURL = await page.evaluate(() => window.SITE_CONFIG.store);
    assert.equal(await page.locator('[data-link="store"]').first().getAttribute('href'), storeURL);
    const storeNavigation = page.waitForRequest(request => request.isNavigationRequest() && request.url() === storeURL);
    const [storeRequest] = await Promise.all([
        storeNavigation,
        page.locator('[data-link="store"]').first().click().catch(error => {
            if (!page.isClosed()) throw error;
        })
    ]);
    assert.equal(storeRequest.url(), storeURL);
    checks.push('Chrome Web Store action requests the configured canonical destination; the response uses a fixture.');
    assert.deepEqual(errors, []);
    const hashes = {};
    for (const file of files) hashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
    assert.deepEqual(hashes, inputHashes, 'Runtime sources, security headers and screenshot/cover assets remain stable during the suite');
    const result = { checkedOn: new Date().toISOString(), browser: browser.version(), checkCount: checks.length, responsiveCases: captureLayouts ? 40 : 0, checks, screenshots, sourceHashes: hashes, video: { ...videoConfiguration, playerId: configuredId, fixturePlayerURL: iframeRequest.url(), actualRemotePlaybackVerified: false }, pageErrors: errors, externalRequests, realExternalCalls: 0, localOnly: true, deploymentVerified: false, visualReviewPending: true };
    if (captureLayouts) await writeFile(evidence, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ checkCount: checks.length, responsiveCases: result.responsiveCases, pageErrors: errors, screenshotCount: screenshots.length, evidence: captureLayouts ? path.relative(root, evidence) : null }, null, 2));
    await context.close();
} finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
}
