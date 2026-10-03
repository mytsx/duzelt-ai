// Real unpacked extension + upstream editors, with mocked OpenAI transport.
// Run: node tests/editor-browser.mjs
// Set PLAYWRIGHT_MODULE if Playwright is not installed or bundled on this host.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const requestedEditors = process.env.EDITOR_FILTER ? process.env.EDITOR_FILTER.split(',') : ['ck4', 'ck5', 'summernote', 'tiny', 'quill', 'quill1'];
const scratch = await mkdtemp(path.join(tmpdir(), 'duzelt-editor-test-'));
const output = path.join(root, 'output/playwright/editors');
await mkdir(output, { recursive: true });
const packages = {
    ck4: ['ckeditor4', '4.22.1'],
    ck5: ['ckeditor5', '48.5.2'],
    tiny: ['tinymce', '8.9.2'],
    summernote: ['summernote', '0.9.1'],
    jquery: ['jquery', '3.7.1'],
    quill: ['quill', '2.0.3'],
    quill1: ['quill', '1.3.7']
};
const assetCache = path.join(tmpdir(), 'duzelt-public-editor-assets');
await mkdir(assetCache, { recursive: true });
for (const [id, [name, version]] of Object.entries(packages)) {
    const dir = path.join(scratch, id);
    await mkdir(dir);
    const archive = path.join(assetCache, `${name}-${version}.tgz`);
    try { await readFile(archive); } catch {
        const response = await fetch(`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`);
        assert.equal(response.ok, true, `Download ${name}@${version}`);
        await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    }
    execFileSync('tar', ['-xzf', archive, '-C', dir, '--strip-components=1']);
}
const initialHTML = '<p>Merhaba <strong>Ali Ali</strong>, bugun cok guzel.</p><p><em>İstanbul\'da</em> bir <a href="https://example.com">baglanti</a> var.</p><ul><li>birinci madde</li><li>ikinci madde</li></ul>';
function fixture(type) {
    const styles = {
        ck4: '', ck5: '<link rel="stylesheet" href="/vendor/ck5/dist/ckeditor5.css">',
        tiny: '', summernote: '<link rel="stylesheet" href="/vendor/summernote/dist/summernote-lite.css">',
        quill: '<link rel="stylesheet" href="/vendor/quill/dist/quill.snow.css">',
        quill1: '<link rel="stylesheet" href="/vendor/quill1/dist/quill.snow.css">'
    };
    const scripts = {
        ck4: '<script src="/vendor/ck4/ckeditor.js"></script>',
        ck5: '',
        tiny: '<script src="/vendor/tiny/tinymce.min.js"></script>',
        summernote: '<script src="/vendor/jquery/dist/jquery.min.js"></script><script src="/vendor/summernote/dist/summernote-lite.js"></script>',
        quill: '<script src="/vendor/quill/dist/quill.js"></script>',
        quill1: '<script src="/vendor/quill1/dist/quill.js"></script>'
    };
    const setup = {
        ck4: "window.editor = CKEDITOR.replace('source', { versionCheck: false, height: 230 }); await new Promise(resolve => editor.on('instanceReady', resolve)); window.writeEditor = html => new Promise(resolve => editor.setData(html, {callback:resolve})); window.readEditor = () => editor.getData(); window.undoEditor = () => editor.execCommand('undo');",
        ck5: "const { ClassicEditor, Essentials, Paragraph, Bold, Italic, Link, List, Undo } = await import('/vendor/ck5/dist/browser/ckeditor5.js'); window.editor = await ClassicEditor.create(document.querySelector('#source'), { licenseKey: 'GPL', plugins: [Essentials, Paragraph, Bold, Italic, Link, List, Undo], toolbar: ['undo','redo','bold','italic','link','bulletedList','numberedList'] }); window.writeEditor = html => editor.setData(html); window.readEditor = () => editor.getData(); window.undoEditor = () => editor.execute('undo');",
        tiny: "window.editor = (await tinymce.init({selector:'#source', license_key:'gpl', base_url:'/vendor/tiny', suffix:'.min', height:360, promotion:false, branding:false, menubar:false, plugins:'lists link', toolbar:'undo redo bold italic link bullist numlist'}))[0]; window.writeEditor = html => editor.setContent(html); window.readEditor = () => editor.getContent(); window.undoEditor = () => editor.undoManager.undo();",
        summernote: "$('#source').summernote({height:230, toolbar:[['style',['bold','italic']],['para',['ul','ol']],['insert',['link']]]}); window.editor = $('#source'); window.writeEditor = html => editor.summernote('code', html); window.readEditor = () => editor.summernote('code'); window.undoEditor = () => editor.summernote('undo');",
        quill: "window.editor = new Quill('#quill', {theme:'snow'}); window.writeEditor = html => editor.setContents(editor.clipboard.convert({html}), 'api'); window.readEditor = () => editor.getSemanticHTML(); window.undoEditor = () => editor.history.undo();",
        quill1: "window.editor = new Quill('#quill', {theme:'snow'}); window.writeEditor = html => editor.setContents(editor.clipboard.convert(html), 'api'); window.readEditor = () => editor.root.innerHTML; window.undoEditor = () => editor.history.undo();"
    };
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${type} — Düzelt test</title>${styles[type]}<style>body{margin:0;background:#f3f4f8;font:16px system-ui;color:#202636}main{max-width:1060px;margin:40px auto;padding:30px;background:white;border-radius:12px}h1{font-size:25px}.fixture-note{color:#626a80;font-size:14px}.ql-editor{min-height:230px}textarea,input{margin:12px 0}body[data-design-capture] #source,body[data-design-capture] #unrelated{display:none}.ck-editor__editable{min-height:230px}</style></head><body><main><h1>AI Türkçe Metin Düzeltici</h1><p class="fixture-note">Gerçek ${type} editörü · Örnek metin · API yanıtı deterministik test verisidir.</p><textarea id="source"></textarea><div id="quill"${type.startsWith('quill')?'':' hidden'}></div><div id="unrelated"><input aria-label="Normal input"><textarea aria-label="Normal textarea"></textarea></div></main>${scripts[type]}<script>(async()=>{try { ${setup[type]} await writeEditor(${JSON.stringify(initialHTML)}); window.fixtureReady=true; } catch(error){window.fixtureError=error.message;} })();</script></body></html>`;
}
let server;
let context;
const results = [];
const pageErrors = [];
try {
    server = http.createServer(async (request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        if (pathname.startsWith('/vendor/')) {
            if (pathname === '/vendor/ck4/skins/moono-lisa/editor.css' || pathname === '/vendor/tiny/themes/silver/theme.min.js') await new Promise(resolve => setTimeout(resolve, 1200));
            const file = path.resolve(scratch, pathname.slice('/vendor/'.length));
            if (!file.startsWith(scratch + path.sep)) { response.writeHead(403).end(); return; }
            try {
                const bytes = await readFile(file);
                const extension = path.extname(file);
                response.writeHead(200, { 'Content-Type': extension === '.js' ? 'application/javascript' : extension === '.css' ? 'text/css' : extension === '.woff2' ? 'font/woff2' : 'application/octet-stream' });
                response.end(bytes);
            } catch { response.writeHead(404).end(); }
            return;
        }
        const type = pathname.slice(1) || 'quill';
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(fixture(type in packages && type !== 'jquery' ? type : 'quill'));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    context = await playwright.chromium.launchPersistentContext(path.join(scratch, 'profile'), {
        channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 },
        args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
    });
    await context.route('https://api.openai.com/**', route => route.abort());
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    // Use the actual provider with a transport fixture. This prevents any paid
    // API call, even when service worker routing differs between browser builds.
    await worker.evaluate(async () => {
        await chrome.storage.local.set({ openai_api_key: 'sk-test-fixture-not-a-real-credential', custom_system_prompt: 'TEST FIXTURE: return corrected_text JSON.' });
        await chrome.storage.sync.set({ ai_corrector_enabled: true });
        globalThis.fixtureControl = { mode: 'correct', delay: 0, calls: 0 };
        globalThis.fetch = async (url, options) => {
            if (!String(url).startsWith('https://api.openai.com/v1/')) throw new Error('Unexpected test network');
            const control = { ...globalThis.fixtureControl };
            globalThis.fixtureControl.calls++;
            globalThis.fixtureLastText = JSON.parse(options.body).messages.find(message => message.role === 'user').content;
            await new Promise(resolve => setTimeout(resolve, control.delay));
            const original = JSON.parse(options.body).messages.find(message => message.role === 'user').content.replaceAll('\u00a0', ' ');
            let corrected = original.replaceAll('bugun','bugün').replaceAll('cok','çok').replaceAll('guzel','güzel').replaceAll('baglanti','bağlantı');
            if (control.mode === 'insert-delete') corrected = corrected.replace('Merhaba', 'Sayın Merhaba').replace('birinci madde', 'madde');
            if (control.mode === 'malicious') corrected += ' <img src=x onerror="window.fixtureExecuted=true"> <script>window.fixtureExecuted=true</script>';
            if (control.mode === 'design-example') corrected = original.replace('bugun toplantida aldigimiz kararlari yarin paylasacagiz.', 'Bugün toplantıda aldığımız kararları yarın paylaşacağız.').replace('baglanti', 'bağlantı');
            if (control.mode === 'paragraph') corrected = corrected.replace('\n', '\nYeni paragraf.\n');
            const payload = control.mode === 'broken' ? { corrected_text: [] } : { corrected_text: corrected };
            return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        };
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    const alerts = [];
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
    const button = page.locator('.ai-text-corrector-button');
    const accept = page.locator('#ai-text-corrector-modal [data-action="accept"]');
    const reject = page.locator('#ai-text-corrector-modal [data-action="reject"]');
    async function control(mode = 'correct', delay = 0) { await worker.evaluate(({mode,delay}) => { globalThis.fixtureControl.mode=mode;globalThis.fixtureControl.delay=delay; }, {mode,delay}); }
    async function seed(html = initialHTML) { await page.evaluate(html => window.writeEditor(html), html); }
    async function read() { return page.evaluate(() => window.readEditor()); }
    async function textHTML(html) { return page.evaluate(html => new DOMParser().parseFromString(html, 'text/html').body.textContent.replaceAll('\u00a0', ' '), html); }
    async function openPreview() { await button.click(); await accept.waitFor({ state:'visible', timeout:15000 }); }
    for (const type of requestedEditors) {
        await control();
        await page.goto(`${baseURL}/${type}`);
        await page.waitForFunction(() => window.fixtureReady || window.fixtureError, { timeout:20000 });
        const fixtureError = await page.evaluate(() => window.fixtureError);
        assert.equal(fixtureError, undefined, `${type} initialization`);
        await button.waitFor({ state:'visible', timeout:10000 });
        assert.equal(await button.count(), 1, `${type}: one button`);
        const buttonStyle = await button.evaluate(element => { const style=getComputedStyle(element);return {image:style.backgroundImage,color:style.backgroundColor,width:element.getBoundingClientRect().width}; });
        assert.ok(buttonStyle.image!=='none'||buttonStyle.color!=='rgba(0, 0, 0, 0)',`${type}: button remains visible against editor CSS`);
        assert.ok(buttonStyle.width>=50,`${type}: correction label fits button`);
        const callsBeforeScriptClick = await worker.evaluate(() => globalThis.fixtureControl.calls);
        await button.evaluate(element => element.click());
        await page.waitForTimeout(100);
        assert.equal(await worker.evaluate(() => globalThis.fixtureControl.calls), callsBeforeScriptClick, `${type}: programmatic click cannot send text`);
        assert.equal(await page.locator('#unrelated .ai-text-corrector-button').count(), 0, `${type}: plain fields unsupported`);
        await page.evaluate(() => {
            for(let index=0;index<80;index++) document.querySelector('#unrelated').appendChild(document.createElement('div'));
        });
        await page.waitForTimeout(350);
        assert.equal(await button.count(), 1, `${type}: no duplicate after dynamic changes`);
        await openPreview();
        await page.screenshot({path:path.join(output, `${type}-preview.png`), fullPage:true});
        const beforeScriptAccept = await read();
        await accept.evaluate(element=>element.click());
        assert.equal(await read(),beforeScriptAccept,`${type}: programmatic accept cannot write`);
        await accept.click();
        await page.locator('#ai-text-corrector-modal').waitFor({state:'detached'});
        let html = await read();
        assert.ok((await textHTML(html)).includes('bugün çok güzel'), `${type}: native model changed: ${html}`);
        assert.match(html, /<(strong|b)>Ali(?: |&nbsp;)Ali<\/(strong|b)>/, `${type}: bold`);
        assert.match(html, /<(em|i)>İstanbul(?:'|&#39;)da<\/(em|i)>/, `${type}: italic`);
        assert.match(html, /href="https:\/\/example.com\/?"/, `${type}: link`);
        assert.ok(html.includes('<li') && (html.includes('<ul') || type.startsWith('quill')), `${type}: list`);
        await page.screenshot({path:path.join(output, `${type}-accepted.png`), fullPage:true});
        const checks = ['editor-css-visible-button','script-triggered-correction-blocked','script-triggered-accept-blocked','real-unpacked-MAIN-ISOLATED','native-model-accept','turkish-paragraph-list-bold-italic-link','one-button','plain-fields-excluded'];
        // Undo must restore original in editors with a correction transaction.
        if (['ck4','ck5','summernote','tiny','quill','quill1'].includes(type)) {
            await page.evaluate(() => window.undoEditor());
            html = await read();
            assert.ok((await textHTML(html)).includes('bugun cok guzel'), `${type}: undo restores original`);
            checks.push('undo-restores-original');
        }
        await seed();
        await control('insert-delete');
        await openPreview();
        assert.equal(await page.locator('.ai-corrector-warning').isVisible(), false, `${type}: insert/delete mapping`);
        await accept.click();
        await page.locator('#ai-text-corrector-modal').waitFor({state:'detached'});
        html = await read();
        assert.ok((await textHTML(html)).includes('Sayın Merhaba') && !html.includes('birinci'), `${type}: insertion/deletion exact`);
        assert.match(html, /<(strong|b)>Ali(?: |&nbsp;)Ali<\/(strong|b)>/, `${type}: insert/delete retains bold`);
        checks.push('insert-delete-retains-format');
        await seed();
        await control();
        const beforeCancel = await read();
        await openPreview();
        await page.keyboard.press('Tab');
        assert.equal(await accept.evaluate(el=>el===document.activeElement), true, `${type}: tab accept`);
        await page.keyboard.press('Tab');
        assert.equal(await reject.evaluate(el=>el===document.activeElement), true, `${type}: focus trapped`);
        await page.keyboard.press('Escape');
        assert.equal(await read(), beforeCancel, `${type}: ESC cancel preserves exact original`);
        checks.push('cancel-preserves-original','keyboard-focus-and-Escape');
        await control('correct', 500);
        const previousAlerts = alerts.length;
        await button.click();
        await seed('<p>Yazmaya devam edildi; bu yeni metin korunmalıdır.</p>');
        await page.waitForTimeout(900);
        assert.equal(await page.locator('#ai-text-corrector-modal').count(), 0, `${type}: stale response no preview`);
        assert.ok((await textHTML(await read())).includes('bu yeni metin korunmalıdır'), `${type}: in-flight edit retained`);
        assert.ok(alerts.length > previousAlerts, `${type}: stale response explanation`);
        checks.push('in-flight-edit-protected');
        await seed();
        await control();
        await openPreview();
        await seed('<p>Önizleme açıkken metin değişti; korunmalıdır.</p>');
        await accept.click();
        await page.locator('.ai-corrector-error').waitFor({state:'visible'});
        assert.ok((await textHTML(await read())).includes('Önizleme açıkken'), `${type}: preview edit retained`);
        await reject.click();
        checks.push('accept-time-edit-protected');
        await seed();
        await control('malicious');
        await openPreview();
        assert.equal(await page.locator('#ai-text-corrector-modal img, #ai-text-corrector-modal script').count(), 0, `${type}: preview escaping`);
        await accept.click();
        await page.locator('#ai-text-corrector-modal').waitFor({state:'detached'});
        html = await read();
        assert.ok(html.includes('&lt;img') && html.includes('&lt;script'), `${type}: model output stays text`);
        assert.equal(await page.evaluate(() => window.fixtureExecuted), undefined, `${type}: no execution`);
        checks.push('model-html-not-executed');
        await seed();
        await control('paragraph');
        await openPreview();
        assert.equal(await page.locator('.ai-corrector-warning').isVisible(), true, `${type}: structural fallback disclosed`);
        await reject.click();
        checks.push('paragraph-change-warning');
        await control('broken');
        const previousBrokenAlerts = alerts.length;
        await button.click();
        await page.waitForFunction(() => !document.querySelector('.ai-text-corrector-button').disabled);
        assert.ok(alerts.length > previousBrokenAlerts, `${type}: invalid response explained`);
        assert.ok((await textHTML(await read())).includes('bugun'), `${type}: malformed API preserves original`);
        checks.push('broken-response-preserves-original');
        await control('correct', 500);
        await button.click();
        await worker.evaluate(() => chrome.storage.sync.set({ai_corrector_enabled:false}));
        await button.waitFor({state:'detached'});
        await page.waitForTimeout(900);
        assert.equal(await page.locator('#ai-text-corrector-modal').count(),0, `${type}: disable drops stale answer`);
        await worker.evaluate(() => chrome.storage.sync.set({ai_corrector_enabled:true}));
        await button.waitFor({state:'visible'});
        assert.equal(await button.count(),1,`${type}: toggle restores one button`);
        checks.push('disable-drops-pending-response','toggle-restores-one-button');
        if (['ck5','quill','quill1','tiny','ck4'].includes(type)) {
            await page.evaluate(type => { if(type==='ck5')editor.enableReadOnlyMode('fixture');else if(type==='tiny')editor.mode.set('readonly');else if(type==='ck4')editor.setReadOnly(true);else editor.disable(); },type);
            await button.waitFor({state:'detached'});
            await page.evaluate(type => { if(type==='ck5')editor.disableReadOnlyMode('fixture');else if(type==='tiny')editor.mode.set('design');else if(type==='ck4')editor.setReadOnly(false);else editor.enable(); },type);
            await button.waitFor({state:'visible'});
            checks.push('read-only-transition');
        }
        results.push({ editor:type, package:packages[type], checks });
        console.log(`${type}: ${checks.length} checks passed`);
    }
    // A dynamically-created real Quill instance receives one button. Removing
    // the instance also clears references; reinserting it remains usable.
    await page.goto(`${baseURL}/quill`);
    await page.waitForFunction(()=>window.fixtureReady);
    await button.waitFor();
    await control();
    await seed('<ul><li>üst madde<ul><li>alt madde</li></ul></li></ul>');
    await openPreview();
    const nestedText = await worker.evaluate(() => globalThis.fixtureLastText.replaceAll('\u00a0', ' '));
    assert.ok(nestedText.includes('üst madde\nalt madde'), 'nested list keeps API text boundaries');
    await reject.click();
    await page.evaluate(() => {
        const area=document.createElement('div');area.id='dynamic';document.querySelector('main').appendChild(area);
        window.dynamicEditor=new Quill(area,{theme:'snow'});dynamicEditor.setText('Dinamik editör örnek metni.');
    });
    await page.waitForFunction(()=>document.querySelectorAll('.ai-text-corrector-button').length===2);
    await page.evaluate(()=> { window.detachedDynamic=document.querySelector('#dynamic'); window.detachedToolbar=detachedDynamic.previousElementSibling;detachedToolbar.remove();detachedDynamic.remove(); });
    await page.waitForFunction(()=>document.querySelectorAll('.ai-text-corrector-button').length===1);
    await page.evaluate(()=> { document.querySelector('main').append(detachedToolbar,detachedDynamic); });
    await page.waitForFunction(()=>document.querySelectorAll('.ai-text-corrector-button').length===2);
    await page.goto(`${baseURL}/quill`);
    await page.waitForFunction(()=>window.fixtureReady);
    await button.waitFor();
    await control();
    await page.evaluate(() => {
        window.originalSemantic = editor.getSemanticHTML.bind(editor);
        editor.getSemanticHTML = () => '<p onclick="window.fixtureExecuted=true" style="color:red;background-image:url(https://example.com/pixel)">Merhaba bugun <a href="javascript:window.fixtureExecuted=true">baglanti</a> <a href="https://example.com">guzel link</a><img src=x onerror="window.fixtureExecuted=true"></p><script>window.fixtureExecuted=true</script><svg onload="window.fixtureExecuted=true"></svg>';
        const originalConvert = editor.clipboard.convert.bind(editor.clipboard);
        editor.clipboard.convert = data => { window.writtenHTML=data.html; return originalConvert(data); };
    });
    await openPreview();
    await accept.click();
    await page.locator('#ai-text-corrector-modal').waitFor({state:'detached'});
    const safety = await page.evaluate(() => ({html:window.writtenHTML,executed:window.fixtureExecuted}));
    assert.equal(safety.executed,undefined,'unsafe source markup not executed');
    assert.doesNotMatch(safety.html,/onclick|onerror|javascript:|<script|<svg|background-image/,'source HTML active content removed');
    assert.match(safety.html,/href="https:\/\/example.com"/,'safe link survives sanitization');
    results.push({editor:'html-safety',checks:['source-script-svg-event-url-css-removed','safe-link-preserved','no-script-execution']});
    results.push({editor:'dynamic-quill',checks:['nested-list-text-boundaries','late-initialization','remove-instance','reinsert-instance','no-duplicate']});
    await page.goto(`${baseURL}/quill`);
    await page.waitForFunction(()=>window.fixtureReady);
    await button.waitFor();
    await seed('<p>bugun toplantida aldigimiz <strong>kararlari</strong> yarin paylasacagiz.</p><p><em>Örnek metindeki</em> <a href="https://example.com">baglanti</a> korunur.</p><ul><li>birinci örnek madde</li><li>ikinci örnek madde</li></ul>');
    await control('design-example');
    await page.evaluate(()=>{document.body.dataset.designCapture='true';document.querySelector('.fixture-note').textContent='Gerçek Quill 2.0.3 editörü · Örnek metin · Düzeltme yanıtı deterministik test verisidir.';});
    await page.screenshot({path:path.join(output,'quill-before.png'),fullPage:true});
    await openPreview();
    await page.screenshot({path:path.join(output,'quill-preview.png'),fullPage:true});
    await accept.click();
    await page.locator('#ai-text-corrector-modal').waitFor({state:'detached'});
    await page.screenshot({path:path.join(output,'quill-accepted.png'),fullPage:true});
    assert.equal(pageErrors.length,0,`No page errors: ${pageErrors.join('; ')}`);
    const report = {
        scope: requestedEditors.length===6 ? 'full' : 'targeted:'+requestedEditors.join(','),
        generatedAt:new Date().toISOString(), extensionVersion:JSON.parse(await readFile(path.join(root,'manifest.json'))).version,
        browser:await context.browser()?.version() || 'Chromium persistent',
        api:'Actual background/provider; deterministic fetch fixture, fake local-profile key. No paid API requests or quality evaluation.',
        testBoundary:'Upstream local classic editors only; no claim about WordPress, Notion, Drupal, CMS frameworks, cross-origin embedded editors, CKEditor multi-root or collaboration.',
        results, pageErrors
    };
    await writeFile(path.join(output,requestedEditors.length===6?'results.json':'results-targeted.json'),JSON.stringify(report,null,2)+'\n');
    await mkdir(path.join(root,'evidence'),{recursive:true});
    await writeFile(path.join(root,requestedEditors.length===6?'evidence/editor-results.json':'evidence/editor-results-targeted.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`${results.reduce((sum,item)=>sum+item.checks.length,0)} browser checks passed. Evidence: output/playwright/editors/${requestedEditors.length===6?'results.json':'results-targeted.json'}`);
} finally {
    if(context) await context.close();
    if(server) await new Promise(resolve=>server.close(resolve));
    await rm(scratch,{recursive:true,force:true});
}
