import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker, { handleFeedback, deliverFeedback } from '../worker/index.mjs';
import { FeedbackError, SITE_ORIGIN, FEEDBACK_ACTION, MAX_BODY_BYTES, JOB_MAX_AGE_MS,
    validateFeedback, readFeedback, verifyTurnstile, feedbackJob, validateJob, ipRateKey, tokenClaimKey, emailMessage } from '../worker/feedback.mjs';
import { smtpOptions, sendFeedbackMail } from '../worker/mail.mjs';
import { TOKEN_CLAIM_TTL_MS } from '../worker/token-guard.mjs';

const NOW = Date.parse('2026-10-03T10:11:00Z');
const ID = 'a1234567-1234-4234-8234-123456789abc';
const VALID = { type: 'bug', message: 'Deneme: düzeltme düğmesi görünmüyor.', turnstileToken: 'fixture-single-use-token' };
const verify = async () => Response.json({ success: true, hostname: 'duzelt.yerli.dev', action: 'feedback' });
const logger = () => ({ logs: [], log(value) { this.logs.push(JSON.parse(value)); } });

function environment(overrides = {}) {
    const jobs = [];
    const claimedTokens = new Set();
    return {
        jobs, FEEDBACK_ENABLED: 'true', TURNSTILE_SITE_KEY: 'fixture-public-site-key',
        TURNSTILE_SECRET_KEY: 'fixture-private-turnstile-key', FEEDBACK_IP_HASH_KEY: 'fixture-hmac-key-at-least-thirty-two-characters',
        SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'true',
        SMTP_USER: 'fixture-smtp-user', SMTP_PASSWORD: 'fixture-smtp-password',
        MAIL_FROM: 'duzelt@example.test', MAIL_TO: 'owner@example.test',
        FEEDBACK_RATE_LIMITER: { limit: async () => ({ success: true }) },
        FEEDBACK_GLOBAL_LIMITER: { limit: async () => ({ success: true }) },
        FEEDBACK_TOKEN_GUARD: { getByName: key => ({ claim: async () => {
            if (claimedTokens.has(key)) return false;
            claimedTokens.add(key);
            return true;
        } }) },
        FEEDBACK_QUEUE: { send: async (job, options) => { jobs.push({ job, options }); } },
        ...overrides,
    };
}

function request(body = VALID, headers = {}) {
    return new Request(`${SITE_ORIGIN}/api/feedback`, {
        method: 'POST', headers: { Origin: SITE_ORIGIN, 'Content-Type': 'application/json',
            'Sec-Fetch-Site': 'same-origin', 'CF-Connecting-IP': '192.0.2.50', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

const dependencies = log => ({ fetcher: verify, logger: log || logger(), now: () => new Date(NOW), uuid: () => ID });
const job = (overrides = {}) => ({ ...feedbackJob(validateFeedback(VALID), { now: () => new Date(NOW), uuid: () => ID }), ...overrides });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error instanceof FeedbackError && error.code === code);

test('all three feedback types allow anonymous messages and preserve line breaks', () => {
    for (const type of ['bug', 'suggestion', 'feature']) {
        const input = validateFeedback({ ...VALID, type, message: '  Birinci satır\nİkinci satır  ' });
        assert.equal(input.message, 'Birinci satır\nİkinci satır');
        assert.equal(input.replyEmail, '');
        assert.equal(input.appVersion, '');
        assert.equal(input.browser, '');
    }
    assert.equal(validateFeedback({ ...VALID, message: 'x'.repeat(4000) }).message.length, 4000);
});

test('strict fields reject arbitrary recipients, headers, unknown types and invalid values', () => {
    for (const input of [null, [], 3, { ...VALID, to: 'attacker@example.test' },
        { ...VALID, from: 'attacker@example.test' }, { ...VALID, cc: 'attacker@example.test' },
        { ...VALID, smtpPassword: 'replacement' }, { ...VALID, type: '__proto__' },
        { ...VALID, message: '' }, { ...VALID, message: '   ' }, { ...VALID, message: 'x'.repeat(4001) },
        { ...VALID, message: 'Text\u0000injected' }, { ...VALID, message: 12 },
        { ...VALID, replyEmail: null }, { ...VALID, replyEmail: 'broken' },
        { ...VALID, replyEmail: 'a@example.test\r\nBcc: b@example.test' },
        { ...VALID, browser: 'Chrome\nInjected' }, { ...VALID, appVersion: '3.4\tInjected' },
        { ...VALID, appVersion: 'x'.repeat(65) }, { ...VALID, browser: 'x'.repeat(121) },
        { ...VALID, turnstileToken: '' }, { ...VALID, turnstileToken: 'x'.repeat(2049) }]) {
        assert.throws(() => validateFeedback(input), error => error.code === 'validation');
    }
});

test('honeypot is rejected rather than enqueued; whitespace-only honeypot is empty', () => {
    assert.throws(() => validateFeedback({ ...VALID, website: 'spam.test' }), error => error.code === 'honeypot');
    assert.equal(validateFeedback({ ...VALID, website: ' ' }).type, 'bug');
});

test('JSON size bound checks declared and actual bytes including chunked streams', async () => {
    await rejectsCode(readFeedback(request(VALID, { 'Content-Length': String(MAX_BODY_BYTES + 1) })), 'too_large');
    await rejectsCode(readFeedback(request('x'.repeat(MAX_BODY_BYTES + 1), { 'Content-Length': '1' })), 'too_large');
    let cancelled = false;
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('x'.repeat(8192)));
            controller.enqueue(new TextEncoder().encode('x'.repeat(8193)));
        }, cancel() { cancelled = true; },
    });
    const streamed = new Request(`${SITE_ORIGIN}/api/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
    });
    await rejectsCode(readFeedback(streamed), 'too_large');
    assert.equal(cancelled, true);
});

test('content type, malformed JSON and invalid UTF-8 fail safely', async () => {
    for (const type of ['text/plain', 'application/jsonp', '']) {
        await rejectsCode(readFeedback(request(VALID, { 'Content-Type': type })), 'content_type');
    }
    await rejectsCode(readFeedback(request('{private invalid JSON')), 'invalid_json');
    const badUtf8 = new Request(`${SITE_ORIGIN}/api/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff]),
    });
    await rejectsCode(readFeedback(badUtf8), 'invalid_json');
    assert.equal((await readFeedback(request(VALID, { 'Content-Type': 'application/json; charset=utf-8' }))).type, 'bug');
});

test('public config exposes only readiness, site key and action with no-store', async () => {
    const env = environment();
    const response = await handleFeedback(new Request(`${SITE_ORIGIN}/api/feedback/config`), env);
    assert.deepEqual(await response.json(), { enabled: true, siteKey: env.TURNSTILE_SITE_KEY, action: FEEDBACK_ACTION });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('missing bindings/secrets or unsafe SMTP disables public form and submission', async () => {
    for (const overrides of [{ FEEDBACK_ENABLED: 'false' }, { TURNSTILE_SECRET_KEY: '' },
        { FEEDBACK_IP_HASH_KEY: 'short' }, { FEEDBACK_QUEUE: null }, { FEEDBACK_RATE_LIMITER: null },
        { FEEDBACK_GLOBAL_LIMITER: null }, { FEEDBACK_TOKEN_GUARD: null }, { SMTP_PASSWORD: '' }, { SMTP_SECURE: 'invalid' },
        { SMTP_REQUIRE_TLS: 'false' }, { SMTP_REQUIRE_TLS: '' }, { MAIL_TO: 'multiple@example.test,other@example.test' }]) {
        const env = environment(overrides);
        const config = await (await handleFeedback(new Request(`${SITE_ORIGIN}/api/feedback/config`), env)).json();
        assert.deepEqual(config, { enabled: false, siteKey: '', action: 'feedback' });
        assert.equal((await handleFeedback(request(), env, dependencies())).status, 503);
        assert.equal(env.jobs.length, 0);
    }
});

test('only exact production origin may submit, including fetch metadata denial', async () => {
    const env = environment();
    let calls = 0;
    const deps = { ...dependencies(), fetcher: async () => { calls++; return verify(); } };
    for (const Origin of ['', 'null', 'http://duzelt.yerli.dev', 'https://www.duzelt.yerli.dev',
        'https://duzelt.yerli.dev/', 'https://duzelt.yerli.dev:444', 'https://duzelt.yerli.dev.evil.test']) {
        assert.equal((await handleFeedback(request(VALID, { Origin }), env, deps)).status, 403);
    }
    for (const value of ['cross-site', 'none']) {
        assert.equal((await handleFeedback(request(VALID, { 'Sec-Fetch-Site': value }), env, deps)).status, 403);
    }
    assert.equal(calls, 0);
    assert.equal(env.jobs.length, 0);
});

test('unknown paths and unsupported methods fail without static/API confusion', async () => {
    const env = environment();
    for (const [path, method, status, allow] of [
        ['/api/other', 'GET', 404, null], ['/api/feedback', 'GET', 405, 'POST'],
        ['/api/feedback', 'OPTIONS', 405, 'POST'], ['/api/feedback/config', 'POST', 405, 'GET'],
    ]) {
        const response = await handleFeedback(new Request(SITE_ORIGIN + path, { method }), env);
        assert.equal(response.status, status);
        assert.equal(response.headers.get('Allow'), allow);
    }
    const original = new Request(`${SITE_ORIGIN}/support/`);
    env.ASSETS = { fetch: async req => { assert.equal(req, original); return new Response('static'); } };
    assert.equal(await (await worker.fetch(original, env)).text(), 'static');
});

test('IP rate key is an HMAC with a private deployment key, never plain IP or bare hash', async () => {
    const ip = '192.0.2.50';
    const secret = environment().FEEDBACK_IP_HASH_KEY;
    const key = await ipRateKey(ip, secret);
    assert.equal(key, createHmac('sha256', secret).update('duzelt-feedback-ip\n' + ip).digest('hex'));
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.notEqual(key, await ipRateKey(ip, secret + 'different'));
    assert.notEqual(key, await ipRateKey('192.0.2.51', secret));
    await rejectsCode(ipRateKey(ip, 'short'), 'unavailable');
});

test('token object identity uses a separate private HMAC domain and never raw tokens', async () => {
    const secret = environment().FEEDBACK_IP_HASH_KEY;
    const hash = await tokenClaimKey(VALID.turnstileToken, secret);
    assert.equal(hash, createHmac('sha256', secret).update('duzelt-feedback-token\n' + VALID.turnstileToken).digest('hex'));
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, await ipRateKey(VALID.turnstileToken, secret));
    assert.notEqual(hash, await tokenClaimKey(VALID.turnstileToken, secret + 'other'));
    await rejectsCode(tokenClaimKey(VALID.turnstileToken, 'short'), 'unavailable');
});

test('replayed vendor success still accepts only one job and logs no token or hash', async () => {
    const env = environment();
    const logs = logger();
    const first = await handleFeedback(request(), env, dependencies(logs));
    const second = await handleFeedback(request(), env, dependencies(logs));
    assert.equal(first.status, 202);
    assert.equal(second.status, 400);
    assert.deepEqual(await second.json(), { error: 'turnstile' });
    assert.equal(env.jobs.length, 1);
    assert.deepEqual(logs.logs[1], { event: 'feedback_validation_failed', class: 'token_replay' });
    assert.doesNotMatch(JSON.stringify(logs.logs), /fixture|token-[a-f0-9]{64}|192\.0\.2/);
});

test('token guard failure or malformed response fails closed before queueing', async () => {
    for (const claim of [async () => { throw new Error('private token and credential'); },
        async () => undefined, async () => 'true', async () => ({ accepted: true })]) {
        const logs = logger();
        const env = environment({ FEEDBACK_TOKEN_GUARD: { getByName: name => {
            assert.match(name, /^duzelt-feedback-token-[a-f0-9]{64}$/);
            assert.doesNotMatch(name, /fixture|192\.0\.2/);
            return { claim: async (...args) => { assert.equal(args.length, 0); return claim(); } };
        } } });
        const response = await handleFeedback(request(), env, dependencies(logs));
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'unavailable' });
        assert.equal(env.jobs.length, 0);
        assert.deepEqual(logs.logs, [{ event: 'feedback_validation_failed', class: 'token_guard_unavailable' }]);
    }
});

test('invalid verification and exhausted app rate never claim a token', async () => {
    let claims = 0;
    for (const invalidToken of [true, false]) {
        const env = environment({
            FEEDBACK_GLOBAL_LIMITER: { limit: async () => ({ success: false }) },
            FEEDBACK_TOKEN_GUARD: { getByName: () => ({ claim: async () => { claims++; return true; } }) },
        });
        const response = await handleFeedback(request(), env, { ...dependencies(),
            fetcher: invalidToken ? async () => Response.json({ success: false }) : verify });
        assert.equal(response.status, invalidToken ? 400 : 429);
    }
    assert.equal(claims, 0);
});

test('queue failure retains the consumed token claim so retry cannot enqueue a duplicate', async () => {
    let queueCalls = 0;
    const env = environment({ FEEDBACK_QUEUE: { send: async () => { queueCalls++; throw new Error('private queue failure'); } } });
    assert.equal((await handleFeedback(request(), env, dependencies())).status, 503);
    assert.equal((await handleFeedback(request(), env, dependencies())).status, 400);
    assert.equal(queueCalls, 1);
});

test('real workerd SQLite token claims are atomic, survive restart, expire and remove alarms', async () => {
    const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
    const directory = await mkdtemp(join(tmpdir(), 'duzelt-feedback-guard-'));
    const epoch = Date.now() + 3_600_000;
    const options = convertV4MiniflareOptions({
        compatibilityDate: '2026-10-03', compatibilityFlags: ['nodejs_compat'],
        durableObjects: { FEEDBACK_TOKEN_GUARD: { className: 'TestTokenGuard', useSQLite: true } },
        resourcePersistencePath: directory,
        modules: [
            { type: 'ESModule', path: 'guard-test.mjs', contents: `
                import { FeedbackTokenGuard } from './worker/runtime.mjs';
                export class TestTokenGuard extends FeedbackTokenGuard {
                    setClock(now) { this.claims.now = () => now; }
                    inspect() {
                        const exists = this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='token_claim'").toArray();
                        const rows = exists.length ? this.ctx.storage.sql.exec('SELECT * FROM token_claim').toArray() : [];
                        return this.ctx.storage.getAlarm().then(alarm => ({rows,alarm,tables:exists.length}));
                    }
                    pruneForTest() { return this.alarm(); }
                }
                export default { async fetch(request,env) {
                    const stub = env.FEEDBACK_TOKEN_GUARD.getByName('fixture-hmac-object');
                    const epoch = ${epoch};
                    await stub.setClock(epoch);
                    if (new URL(request.url).pathname === '/restart') {
                        return Response.json({claimed:await stub.claim(),state:await stub.inspect()});
                    }
                    if (new URL(request.url).pathname === '/expire') {
                        await stub.setClock(epoch + ${TOKEN_CLAIM_TTL_MS - 1});
                        await stub.pruneForTest();
                        const before = await stub.inspect();
                        await stub.setClock(epoch + ${TOKEN_CLAIM_TTL_MS});
                        await stub.pruneForTest();
                        const expired = await stub.inspect();
                        const afterExpiry = await stub.claim();
                        return Response.json({before,expired,afterExpiry,state:await stub.inspect()});
                    }
                    const claimed = await Promise.all(Array.from({length:32},()=>env.FEEDBACK_TOKEN_GUARD.getByName('fixture-hmac-object').claim()));
                    const other = env.FEEDBACK_TOKEN_GUARD.getByName('independent-fixture-object');
                    await other.setClock(epoch);
                    return Response.json({claimed,independent:await other.claim(),state:await stub.inspect()});
                } }
            ` },
            { type: 'ESModule', path: 'worker/runtime.mjs', contents: await readFile(new URL('../worker/runtime.mjs', import.meta.url), 'utf8') },
            { type: 'ESModule', path: 'worker/token-guard.mjs', contents: await readFile(new URL('../worker/token-guard.mjs', import.meta.url), 'utf8') },
            // The HTTP/SMTP worker is outside this storage test. This stub has
            // no network operations and does not replace the production DO.
            { type: 'ESModule', path: 'worker/index.mjs', contents: 'export default {};' },
        ],
    });
    let runtime;
    try {
        runtime = new Miniflare(options);
        const result = await (await runtime.dispatchFetch('https://fixture.example.test/')).json();
        assert.equal(result.claimed.filter(value => value === true).length, 1);
        assert.equal(result.claimed.filter(value => value === false).length, 31);
        assert.equal(result.independent, true);
        assert.deepEqual(result.state, { rows: [{ id: 1, expires_at: epoch + TOKEN_CLAIM_TTL_MS }],
            alarm: epoch + TOKEN_CLAIM_TTL_MS, tables: 1 });
        await runtime.dispose();
        runtime = new Miniflare(options);
        const restarted = await (await runtime.dispatchFetch('https://fixture.example.test/restart')).json();
        assert.equal(restarted.claimed, false);
        assert.deepEqual(restarted.state, result.state);
        const expired = await (await runtime.dispatchFetch('https://fixture.example.test/expire')).json();
        assert.deepEqual(expired.before, result.state);
        assert.deepEqual(expired.expired, { rows: [], alarm: null, tables: 0 });
        assert.equal(expired.afterExpiry, true);
        assert.deepEqual(expired.state.rows, [{ id: 1, expires_at: epoch + 2 * TOKEN_CLAIM_TTL_MS }]);
        assert.equal(expired.state.alarm, epoch + 2 * TOKEN_CLAIM_TTL_MS);
    } finally {
        if (runtime) await runtime.dispose();
        await rm(directory, { recursive: true, force: true });
    }
});

test('IP limit denial occurs before token verification and never accepts a job', async () => {
    let key;
    let calls = 0;
    const env = environment({ FEEDBACK_RATE_LIMITER: { limit: async input => { key = input.key; return { success: false }; } } });
    const response = await handleFeedback(request(), env, { ...dependencies(), fetcher: async () => { calls++; return verify(); } });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(calls, 0);
    assert.equal(env.jobs.length, 0);
});

test('app limit is a fixed application key and denial prevents queue acceptance', async () => {
    let key;
    const env = environment({ FEEDBACK_GLOBAL_LIMITER: { limit: async input => { key = input.key; return { success: false }; } } });
    const response = await handleFeedback(request(), env, dependencies());
    assert.equal(response.status, 429);
    assert.equal(key, 'duzelt-feedback');
    assert.equal(env.jobs.length, 0);
});

test('limiter failures and malformed success responses fail closed with sanitized errors', async () => {
    for (const binding of ['FEEDBACK_RATE_LIMITER', 'FEEDBACK_GLOBAL_LIMITER']) {
        for (const limit of [async () => { throw new Error('private limiter credential'); }, async () => ({ success: 'true' })]) {
            const env = environment({ [binding]: { limit } });
            const response = await handleFeedback(request(), env, dependencies());
            assert.ok([429, 503].includes(response.status));
            assert.doesNotMatch(await response.text(), /private/);
            assert.equal(env.jobs.length, 0);
        }
    }
});

test('Turnstile uses server form secret and token without raw IP or URL credentials', async () => {
    const env = environment();
    await verifyTurnstile(validateFeedback(VALID), env, async (url, options) => {
        assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
        assert.equal(options.method, 'POST');
        assert.equal(options.redirect, 'manual');
        assert.equal(Object.hasOwn(options, 'credentials'), false);
        assert.equal(Object.hasOwn(options, 'referrerPolicy'), false);
        assert.equal(options.cache, 'no-store');
        assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
        assert.equal(typeof options.body, 'string');
        const form = new URLSearchParams(options.body);
        assert.deepEqual([...form.keys()].sort(), ['response', 'secret']);
        assert.equal(form.get('secret'), env.TURNSTILE_SECRET_KEY);
        assert.equal(form.get('response'), VALID.turnstileToken);
        return verify();
    });
});

test('real workerd Siteverify native fetch sends explicit no-store form and refuses redirects without external network', async () => {
    const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
    const outboundBodies = [];
    const runtime = new Miniflare(convertV4MiniflareOptions({
        compatibilityDate: '2026-10-03', compatibilityFlags: ['nodejs_compat'],
        outboundService: async request => {
            assert.equal(request.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
            assert.equal(request.method, 'POST');
            assert.equal(request.headers.get('Content-Type'), 'application/x-www-form-urlencoded');
            assert.equal(request.headers.get('Cache-Control'), 'no-cache');
            assert.equal(request.headers.get('Pragma'), 'no-cache');
            const body = await request.text();
            outboundBodies.push(body);
            assert.deepEqual(Object.fromEntries(new URLSearchParams(body)), {
                secret: 'fixture-secret+slash/', response: 'fixture-token+slash/',
            });
            return verify();
        },
        modules: [
            { type: 'ESModule', path: 'runtime-test.mjs', contents: `
                import { verifyTurnstile } from './worker/feedback.mjs';
                export default { async fetch(request) {
                    if (new URL(request.url).pathname === '/native') {
                        await verifyTurnstile({turnstileToken:'fixture-token+slash/'}, {TURNSTILE_SECRET_KEY:'fixture-secret+slash/'});
                        return Response.json({accepted:true});
                    }
                    const results = [];
                    for (const status of [200,301,302,307,308]) {
                        let calls = 0;
                        let mode;
                        try {
                            await verifyTurnstile({turnstileToken:'fixture-token'}, {TURNSTILE_SECRET_KEY:'fixture-secret'}, async (url,options) => {
                                calls++;
                                const request = new Request(url,options);
                                mode = request.redirect;
                                if (status !== 200) return new Response(null,{status,headers:{Location:'https://redirect-target.example.test/'}});
                                return Response.json({success:true,hostname:'duzelt.yerli.dev',action:'feedback'});
                            });
                            results.push({status,accepted:true,calls,mode});
                        } catch(error) {
                            results.push({status,accepted:false,calls,mode,code:error.code,diagnosticClass:error.diagnosticClass});
                        }
                    }
                    return Response.json(results);
                } }
            ` },
            { type: 'ESModule', path: 'worker/feedback.mjs', contents: await readFile(new URL('../worker/feedback.mjs', import.meta.url), 'utf8') },
            { type: 'ESModule', path: 'worker/email-template.mjs', contents: await readFile(new URL('../worker/email-template.mjs', import.meta.url), 'utf8') },
        ],
    }));
    try {
        const results = await (await runtime.dispatchFetch('https://fixture.example.test/')).json();
        assert.deepEqual(results[0], { status: 200, accepted: true, calls: 1, mode: 'manual' });
        for (const result of results.slice(1)) {
            assert.deepEqual(result, { status: result.status, accepted: false, calls: 1, mode: 'manual', code: 'unavailable', diagnosticClass: 'turnstile_http_status' });
        }
        for (let index = 0; index < 2; index++) {
            assert.deepEqual(await (await runtime.dispatchFetch('https://fixture.example.test/native')).json(), { accepted: true });
        }
        assert.equal(outboundBodies.length, 2);
        assert.equal(outboundBodies[0], outboundBodies[1]);
    } finally {
        await runtime.dispose();
    }
});

test('Turnstile rejects failed/replayed tokens, non-boolean success, wrong hostname/action and malformed result', async () => {
    for (const result of [{ success: false, 'error-codes': ['timeout-or-duplicate'] },
        { success: 'true', hostname: 'duzelt.yerli.dev', action: 'feedback' },
        { success: true, hostname: 'kalbur.yerli.dev', action: 'feedback' },
        { success: true, hostname: 'duzelt.yerli.dev', action: 'other' }, null, []]) {
        await rejectsCode(verifyTurnstile(validateFeedback(VALID), environment(), async () => Response.json(result)), 'turnstile');
    }
    const env = environment();
    assert.equal((await handleFeedback(request(), env, { ...dependencies(), fetcher: async () => Response.json({ success: false }) })).status, 400);
    assert.equal(env.jobs.length, 0);
});

test('Turnstile network/HTTP/JSON failures reveal no private server response', async () => {
    for (const fetcher of [async () => { throw new Error('private token and secret'); },
        async () => new Response('private provider HTML', { status: 502 }),
        async () => new Response('private malformed JSON', { status: 200 })]) {
        const env = environment();
        const response = await handleFeedback(request(), env, { ...dependencies(), fetcher });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'unavailable' });
        assert.equal(env.jobs.length, 0);
    }
});

test('Turnstile unavailable diagnostics distinguish stages using only fixed safe classes', async () => {
    for (const [fetcher, expected] of [
        [async () => { throw new Error('private token and secret'); }, 'turnstile_transport'],
        [async () => { throw Object.assign(new Error('private timeout'), { name: 'TimeoutError' }); }, 'turnstile_timeout'],
        [async () => new Response('private provider HTML', { status: 502 }), 'turnstile_http_status'],
        [async () => new Response('private malformed JSON', { status: 200 }), 'turnstile_json'],
    ]) {
        const logs = logger();
        const response = await handleFeedback(request(), environment(), { ...dependencies(logs), fetcher });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'unavailable' });
        assert.deepEqual(logs.logs, [{ event: 'feedback_validation_failed', class: expected }]);
        assert.doesNotMatch(JSON.stringify(logs.logs), /private|token|secret/);
    }
    const original = AbortSignal.timeout;
    const logs = logger();
    try {
        AbortSignal.timeout = () => { throw new Error('private runtime detail'); };
        const response = await handleFeedback(request(), environment(), dependencies(logs));
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'unavailable' });
        assert.deepEqual(logs.logs, [{ event: 'feedback_validation_failed', class: 'turnstile_runtime' }]);
    } finally {
        AbortSignal.timeout = original;
    }
});

test('queue resolution alone returns accepted; queued payload excludes token, IP and honeypot', async () => {
    let release;
    let queued;
    const env = environment({ FEEDBACK_QUEUE: { send: async (value, options) => {
        queued = value;
        assert.deepEqual(options, { contentType: 'json' });
        await new Promise(resolve => { release = resolve; });
    } } });
    let resolved = false;
    const promise = handleFeedback(request({ ...VALID, replyEmail: 'reply@example.test', appVersion: '3.4.0', browser: 'Chrome' }), env, dependencies())
        .then(response => { resolved = true; return response; });
    while (!release) await new Promise(resolve => setImmediate(resolve));
    assert.equal(resolved, false);
    release();
    const response = await promise;
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { accepted: true, id: ID.slice(0, 8), message: 'Geri bildiriminiz alındı.' });
    assert.deepEqual(Object.keys(queued).sort(), ['appVersion', 'browser', 'createdAt', 'id', 'message', 'replyEmail', 'type']);
    assert.equal(queued.message, VALID.message);
    assert.equal(queued.id, ID);
});

test('queue failure never says accepted and does not reveal provider errors', async () => {
    const logs = logger();
    const env = environment({ FEEDBACK_QUEUE: { send: async () => { throw new Error('private queue message email token password'); } } });
    const response = await handleFeedback(request(), env, dependencies(logs));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'unavailable' });
    assert.deepEqual(logs.logs, [{ event: 'feedback_accept_failed', class: 'unavailable' }]);
});

test('acceptance logs contain only event and UUID, not any personal data or credential', async () => {
    const logs = logger();
    const env = environment();
    await handleFeedback(request({ ...VALID, replyEmail: 'private-reply@example.test' }), env, dependencies(logs));
    assert.deepEqual(logs.logs, [{ event: 'feedback_accepted', id: ID }]);
    const serialized = JSON.stringify(logs.logs);
    for (const secret of [VALID.message, VALID.turnstileToken, env.SMTP_PASSWORD, env.TURNSTILE_SECRET_KEY, 'private-reply', '192.0.2.50']) {
        assert.equal(serialized.includes(secret), false);
    }
});

test('logger failure cannot turn an already accepted queue write into an error', async () => {
    const env = environment();
    const response = await handleFeedback(request(), env, { ...dependencies(), logger: { log() { throw new Error('logger offline'); } } });
    assert.equal(response.status, 202);
    assert.equal(env.jobs.length, 1);
});

test('email envelope and From/To are fixed while the optional address is Reply-To only', () => {
    const env = environment();
    const value = job({ replyEmail: 'reply+tag@example.test', appVersion: '3.4.0', browser: 'Chrome' });
    const mail = emailMessage(value, env);
    assert.deepEqual(mail.from, { name: 'Düzelt', address: env.MAIL_FROM });
    assert.equal(mail.to, env.MAIL_TO);
    assert.deepEqual(mail.envelope, { from: env.MAIL_FROM, to: [env.MAIL_TO] });
    assert.equal(mail.replyTo, value.replyEmail);
    assert.equal(mail.messageId, `<duzelt-feedback-${ID}@duzelt.yerli.dev>`);
    assert.match(mail.subject, /\[Düzelt\] Hata bildirimi · a1234567/);
    const anon = emailMessage(job(), env);
    assert.equal(Object.hasOwn(anon, 'replyTo'), false);
    assert.doesNotMatch(anon.html, /Kullanıcıya yanıtla|Yanıt adresi|Uygulama sürümü|Tarayıcı/);
    assert.match(anon.text, /e-postayla dönüş yapılamaz/);
});

test('HTML email escapes user content, preserves paragraphs and includes Turkish Istanbul date with no remote assets', () => {
    const env = environment();
    const mail = emailMessage(job({ message: '<img src="https://evil.test"> & \'quoted\'\nİkinci satır',
        browser: '<script>private</script>', appVersion: '3.4.0 & test', replyEmail: 'reply@example.test' }), env);
    assert.doesNotMatch(mail.html, /<img|<script|<iframe|@import|@font-face|<link|url\(/i);
    assert.match(mail.html, /&lt;img src=&quot;https:\/\/evil.test&quot;&gt; &amp; &#39;quoted&#39;<br>İkinci satır/);
    assert.match(mail.html, /&lt;script&gt;private&lt;\/script&gt;/);
    assert.match(mail.html, /3 Ekim 2026.*13:11/);
    assert.match(mail.html, /Türkiye saati/);
    assert.match(mail.html, /mailto:reply%40example.test\?subject=D/);
    assert.match(mail.text, /<img src="https:\/\/evil.test">/);
    assert.match(mail.text, new RegExp(ID));
});

test('queue jobs validate identity, shape, creation time and enforce a 24-hour delivery age', () => {
    const current = job();
    assert.equal(validateJob(current, NOW), current);
    for (const value of [job({ id: 'private-email@example.test' }), job({ createdAt: 'invalid' }),
        job({ createdAt: new Date(NOW + 120000).toISOString() }), job({ to: 'other@example.test' }),
        job({ type: 'other' }), job({ replyEmail: 'bad\nheader' }), job({ message: '' })]) {
        assert.throws(() => validateJob(value, NOW), error => error.code === 'invalid_job');
    }
    assert.throws(() => validateJob(job({ createdAt: new Date(NOW - JOB_MAX_AGE_MS).toISOString() }), NOW), error => error.code === 'expired');
    assert.equal(validateJob(job({ createdAt: new Date(NOW - JOB_MAX_AGE_MS + 1).toISOString() }), NOW).id, ID);
});

test('SMTP secure/STARTTLS paths always require verified TLS and disable debug/file/URL reads', () => {
    for (const secure of ['true', 'false']) {
        const options = smtpOptions(environment({ SMTP_SECURE: secure, SMTP_PORT: secure === 'true' ? '465' : '587' }));
        assert.equal(options.secure, secure === 'true');
        assert.equal(options.requireTLS, true);
        assert.equal(options.ignoreTLS, false);
        assert.equal(options.opportunisticTLS, false);
        assert.deepEqual(options.tls, { rejectUnauthorized: true, servername: 'smtp.example.test', minVersion: 'TLSv1.2' });
        for (const property of ['logger', 'debug', 'transactionLog']) assert.equal(options[property], false);
        assert.equal(options.disableFileAccess, true);
        assert.equal(options.disableUrlAccess, true);
        assert.equal(options.maxRecipients, 1);
    }
});

test('unsafe SMTP configuration fails before opening a connection', () => {
    for (const overrides of [{ SMTP_REQUIRE_TLS: 'false' }, { SMTP_REQUIRE_TLS: undefined },
        { SMTP_SECURE: 'maybe' }, { SMTP_PORT: '25' }, { SMTP_PORT: '0' }, { SMTP_PORT: '65536' },
        { SMTP_PORT: '587.5' }, { SMTP_HOST: 'smtp://user:password@evil.test' },
        { SMTP_HOST: 'smtp.example.test\r\nInjected' }, { SMTP_PASSWORD: '' },
        { MAIL_FROM: 'bad\nheader@example.test' }, { MAIL_TO: 'a@example.test,b@example.test' }]) {
        assert.throws(() => smtpOptions(environment(overrides)), error => error.code === 'configuration');
    }
});

test('hostname-preserving socket uses verified TLS or STARTTLS hostname and closes on error', async () => {
    for (const secure of ['true', 'false']) {
        const socket = new EventEmitter();
        let destroyed = 0;
        socket.destroy = () => { destroyed++; };
        let connectionOptions;
        const connect = options => { connectionOptions = options; return socket; };
        const options = smtpOptions(environment({ SMTP_SECURE: secure }), { connect, connectTLS: connect });
        const connection = new Promise((resolve, reject) => options.getSocket({}, (error, value) => error ? reject(error) : resolve(value)));
        assert.equal(connectionOptions.host, 'smtp.example.test');
        if (secure === 'true') {
            assert.equal(connectionOptions.servername, 'smtp.example.test');
            assert.equal(connectionOptions.rejectUnauthorized, true);
        }
        socket.emit(secure === 'true' ? 'secureConnect' : 'connect');
        assert.deepEqual(await connection, { connection: socket, secured: secure === 'true' });
        socket.emit('error', new Error('private socket diagnostic'));
        assert.equal(destroyed, 0);
    }
    const socket = new EventEmitter();
    socket.destroy = () => {};
    const options = smtpOptions(environment(), { connect: () => socket });
    const connection = new Promise(resolve => options.getSocket({}, error => resolve(error)));
    socket.emit('error', new Error('private SMTP password'));
    assert.equal((await connection).message.includes('private'), false);
});

test('SMTP transport closes on acceptance, rejection or failure; no real network is required', async () => {
    for (const result of [{ accepted: ['owner@example.test'], rejected: [] },
        { accepted: [], rejected: ['owner@example.test'] }, new Error('private SMTP response')]) {
        let closed = 0;
        let mailed;
        const send = sendFeedbackMail(job(), environment(), { now: () => NOW, createTransport: options => {
            assert.equal(options.tls.rejectUnauthorized, true);
            return { sendMail: async value => { mailed = value; if (result instanceof Error) throw result; return result; }, close() { closed++; } };
        } });
        if (result instanceof Error || !result.accepted.length) await assert.rejects(send);
        else assert.deepEqual(await send, { accepted: true });
        assert.equal(closed, 1);
        assert.equal(mailed.to, 'owner@example.test');
    }
});

test('delivery acknowledges only successful SMTP submission and retains original job ID for retries', async () => {
    let acknowledged = 0;
    let retry;
    const logs = logger();
    const value = job();
    const message = { body: value, attempts: 1, ack() { acknowledged++; }, retry(options) { retry = options; } };
    let passed;
    await deliverFeedback({ messages: [message] }, environment(), async input => { passed = input; }, { now: () => NOW, logger: logs });
    assert.equal(passed, value);
    assert.equal(acknowledged, 1);
    assert.equal(retry, undefined);
    assert.deepEqual(logs.logs, [{ event: 'feedback_smtp_accepted', id: ID }]);
});

test('SMTP failures retry independently with bounded delays and safe error classes', async () => {
    for (const [attempts, delay] of [[1, 60], [2, 120], [3, 240], [100, 480], [undefined, 60]]) {
        let ack = 0;
        let retry;
        const logs = logger();
        const message = { body: job(), attempts, ack() { ack++; }, retry(value) { retry = value; } };
        await deliverFeedback({ messages: [message] }, environment(), async () => {
            throw Object.assign(new Error('private body, recipient, SMTP password'), { code: 'EAUTH' });
        }, { now: () => NOW, logger: logs });
        assert.equal(ack, 0);
        assert.deepEqual(retry, { delaySeconds: delay });
        assert.deepEqual(logs.logs, [{ event: 'feedback_delivery_failed', id: ID, class: 'smtp_auth' }]);
    }
});

test('one failed queue message does not resend successful siblings; unknown error codes cannot leak', async () => {
    const logs = logger();
    const actions = [];
    const messages = [job(), job({ id: 'b1234567-1234-4234-8234-123456789abc' })].map(body => ({
        body, attempts: 1, ack() { actions.push(['ack', body.id]); }, retry() { actions.push(['retry', body.id]); },
    }));
    await deliverFeedback({ messages }, environment(), async value => {
        if (value.id === ID) throw Object.assign(new Error('private message'), { code: 'PRIVATE_EMAIL_AND_PASSWORD' });
    }, { now: () => NOW, logger: logs });
    assert.deepEqual(actions, [['retry', ID], ['ack', messages[1].body.id]]);
    assert.equal(logs.logs[0].class, 'smtp_failure');
    assert.doesNotMatch(JSON.stringify(logs.logs), /PRIVATE|private/);
});

test('invalid and expired queue payloads are removed without SMTP or unsafe identifiers in logs', async () => {
    let calls = 0;
    let ack = 0;
    let retries = 0;
    const logs = logger();
    const messages = [job({ id: 'private-email@example.test' }), job({ createdAt: new Date(NOW - JOB_MAX_AGE_MS).toISOString() })]
        .map(body => ({ body, ack() { ack++; }, retry() { retries++; } }));
    await deliverFeedback({ messages }, environment(), async () => { calls++; }, { now: () => NOW, logger: logs });
    assert.equal(calls, 0);
    assert.equal(ack, 2);
    assert.equal(retries, 0);
    assert.equal(Object.hasOwn(logs.logs[0], 'id'), false);
    assert.equal(logs.logs[1].class, 'expired');
    assert.doesNotMatch(JSON.stringify(logs.logs), /private-email/);
});
