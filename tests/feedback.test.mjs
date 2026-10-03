import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import worker, { handleFeedback, deliverFeedback } from '../worker/index.mjs';
import { FeedbackError, SITE_ORIGIN, FEEDBACK_ACTION, MAX_BODY_BYTES, JOB_MAX_AGE_MS,
    validateFeedback, readFeedback, verifyTurnstile, feedbackJob, validateJob, ipRateKey, emailMessage } from '../worker/feedback.mjs';
import { smtpOptions, sendFeedbackMail } from '../worker/mail.mjs';

const NOW = Date.parse('2026-10-03T10:11:00Z');
const ID = 'a1234567-1234-4234-8234-123456789abc';
const VALID = { type: 'bug', message: 'Deneme: düzeltme düğmesi görünmüyor.', turnstileToken: 'fixture-single-use-token' };
const verify = async () => Response.json({ success: true, hostname: 'duzelt.yerli.dev', action: 'feedback' });
const logger = () => ({ logs: [], log(value) { this.logs.push(JSON.parse(value)); } });

function environment(overrides = {}) {
    const jobs = [];
    return {
        jobs, FEEDBACK_ENABLED: 'true', TURNSTILE_SITE_KEY: 'fixture-public-site-key',
        TURNSTILE_SECRET_KEY: 'fixture-private-turnstile-key', FEEDBACK_IP_HASH_KEY: 'fixture-hmac-key-at-least-thirty-two-characters',
        SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'true',
        SMTP_USER: 'fixture-smtp-user', SMTP_PASSWORD: 'fixture-smtp-password',
        MAIL_FROM: 'duzelt@example.test', MAIL_TO: 'owner@example.test',
        FEEDBACK_RATE_LIMITER: { limit: async () => ({ success: true }) },
        FEEDBACK_GLOBAL_LIMITER: { limit: async () => ({ success: true }) },
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
        { FEEDBACK_GLOBAL_LIMITER: null }, { SMTP_PASSWORD: '' }, { SMTP_SECURE: 'invalid' },
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
        assert.equal(options.redirect, 'error');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.referrerPolicy, 'no-referrer');
        assert.deepEqual([...options.body.keys()].sort(), ['response', 'secret']);
        assert.equal(options.body.get('secret'), env.TURNSTILE_SECRET_KEY);
        assert.equal(options.body.get('response'), VALID.turnstileToken);
        return verify();
    });
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
