import { FeedbackError, FEEDBACK_ACTION, SITE_ORIGIN, UUID, readFeedback, verifyTurnstile, feedbackJob, ipRateKey, validateJob } from './feedback.mjs';
import { smtpOptions, sendFeedbackMail } from './mail.mjs';

function ready(env) {
    const required = ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'FEEDBACK_IP_HASH_KEY'];
    if (env.FEEDBACK_ENABLED !== 'true' || !required.every(key => typeof env[key] === 'string' && env[key].trim()) ||
        env.FEEDBACK_IP_HASH_KEY.length < 32 || typeof env.FEEDBACK_QUEUE?.send !== 'function' ||
        typeof env.FEEDBACK_RATE_LIMITER?.limit !== 'function' || typeof env.FEEDBACK_GLOBAL_LIMITER?.limit !== 'function') return false;
    try {
        smtpOptions(env);
        return true;
    } catch {
        return false;
    }
}

function json(data, status = 200, headers = {}) {
    return Response.json(data, { status, headers: {
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', ...headers,
    } });
}

function safeLog(logger, event, id, errorClass) {
    const record = { event };
    if (typeof id === 'string' && UUID.test(id)) record.id = id;
    if (errorClass) record.class = errorClass;
    try { logger.log(JSON.stringify(record)); } catch { /* Logging must not change queue acceptance. */ }
}

function smtpErrorClass(error) {
    if (error instanceof FeedbackError && ['configuration', 'smtp_rejected', 'expired', 'invalid_job'].includes(error.code)) return error.code;
    const known = {
        EAUTH: 'smtp_auth', ETIMEDOUT: 'smtp_timeout', ECONNECTION: 'smtp_connection',
        ECONNREFUSED: 'smtp_connection', ECONNRESET: 'smtp_connection', ESOCKET: 'smtp_connection',
        EENVELOPE: 'smtp_rejected', EMESSAGE: 'smtp_rejected', ETLS: 'smtp_tls',
        ERR_TLS_CERT_ALTNAME_INVALID: 'smtp_tls', CERT_HAS_EXPIRED: 'smtp_tls',
        DEPTH_ZERO_SELF_SIGNED_CERT: 'smtp_tls', UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'smtp_tls',
    };
    return Object.hasOwn(known, error?.code || '') ? known[error.code] : 'smtp_failure';
}

export async function handleFeedback(request, env, dependencies = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/api/feedback/config') {
        if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
        const enabled = ready(env);
        return json({ enabled, siteKey: enabled ? env.TURNSTILE_SITE_KEY : '', action: FEEDBACK_ACTION });
    }
    if (url.pathname !== '/api/feedback') return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
    if (request.headers.get('origin') !== SITE_ORIGIN ||
        ['cross-site', 'none'].includes(request.headers.get('sec-fetch-site'))) return json({ error: 'origin' }, 403);
    if (!ready(env)) return json({ error: 'unavailable' }, 503);
    const logger = dependencies.logger || console;
    try {
        const ip = request.headers.get('cf-connecting-ip') || 'missing-ip';
        const key = await ipRateKey(ip, env.FEEDBACK_IP_HASH_KEY);
        const rate = await env.FEEDBACK_RATE_LIMITER.limit({ key });
        if (rate?.success !== true) return json({ error: 'rate_limit' }, 429, { 'Retry-After': '60' });
        const feedback = await readFeedback(request);
        await verifyTurnstile(feedback, env, dependencies.fetcher);
        // Native binding counters are approximate and local to each Cloudflare
        // location; this is an app-wide key per location, not a global quota.
        const appRate = await env.FEEDBACK_GLOBAL_LIMITER.limit({ key: 'duzelt-feedback' });
        if (appRate?.success !== true) return json({ error: 'rate_limit' }, 429, { 'Retry-After': '60' });
        const job = feedbackJob(feedback, dependencies);
        await env.FEEDBACK_QUEUE.send(job, { contentType: 'json' });
        safeLog(logger, 'feedback_accepted', job.id);
        return json({ accepted: true, id: job.id.slice(0, 8), message: 'Geri bildiriminiz alındı.' }, 202);
    } catch (error) {
        if (error instanceof FeedbackError) {
            if (['turnstile_runtime', 'turnstile_transport', 'turnstile_timeout', 'turnstile_http_status', 'turnstile_json'].includes(error.diagnosticClass)) {
                safeLog(logger, 'feedback_validation_failed', undefined, error.diagnosticClass);
            }
            return json({ error: error.code }, error.status);
        }
        safeLog(logger, 'feedback_accept_failed', undefined, 'unavailable');
        return json({ error: 'unavailable' }, 503);
    }
}

export async function deliverFeedback(batch, env, sender = sendFeedbackMail, dependencies = {}) {
    const logger = dependencies.logger || console;
    for (const message of batch.messages) {
        try {
            validateJob(message.body, dependencies.now ? dependencies.now() : Date.now());
            await sender(message.body, env);
            message.ack();
            safeLog(logger, 'feedback_smtp_accepted', message.body.id);
        } catch (error) {
            const errorClass = smtpErrorClass(error);
            safeLog(logger, 'feedback_delivery_failed', message.body?.id, errorClass);
            if (errorClass === 'invalid_job' || errorClass === 'expired') {
                message.ack();
            } else {
                // max_retries=3 and DLQ are enforced by the queue configuration.
                const attempt = Number.isInteger(message.attempts) ? Math.max(1, Math.min(message.attempts, 4)) : 1;
                message.retry({ delaySeconds: Math.min(60 * 2 ** (attempt - 1), 900) });
            }
        }
    }
}

export default {
    async fetch(request, env) {
        if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
        return handleFeedback(request, env);
    },
    async queue(batch, env) {
        return deliverFeedback(batch, env);
    },
};
