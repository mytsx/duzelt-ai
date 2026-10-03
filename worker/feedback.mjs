import { feedbackContent } from './email-template.mjs';

export const SITE_ORIGIN = 'https://duzelt.yerli.dev';
export const FEEDBACK_ACTION = 'feedback';
export const MAX_BODY_BYTES = 16_384;
export const JOB_MAX_AGE_MS = 86_400_000;
export const TYPES = Object.freeze({ bug: 'Hata bildirimi', suggestion: 'Öneri', feature: 'Özellik isteği' });
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const BAD_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export class FeedbackError extends Error {
    constructor(status, code, diagnosticClass) {
        super(code);
        this.name = 'FeedbackError';
        this.status = status;
        this.code = code;
        if (diagnosticClass) this.diagnosticClass = diagnosticClass;
    }
}

export function validEmail(value) {
    return typeof value === 'string' && value.length <= 254 && EMAIL.test(value);
}

function field(input, key, max, required = false, multiline = false) {
    const value = input[key] === undefined ? '' : input[key];
    if (typeof value !== 'string' || value.length > max || BAD_CONTROL.test(value) ||
        (!multiline && /[\r\n\t]/.test(value))) throw new FeedbackError(400, 'validation');
    const trimmed = value.trim();
    if (required && !trimmed) throw new FeedbackError(400, 'validation');
    return trimmed;
}

export function validateFeedback(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FeedbackError(400, 'validation');
    const allowed = ['type', 'message', 'replyEmail', 'appVersion', 'browser', 'website', 'turnstileToken'];
    if (Object.keys(input).some(key => !allowed.includes(key))) throw new FeedbackError(400, 'validation');
    const type = field(input, 'type', 20, true);
    const message = field(input, 'message', 4000, true, true);
    const replyEmail = field(input, 'replyEmail', 254);
    const appVersion = field(input, 'appVersion', 64);
    const browser = field(input, 'browser', 120);
    const website = field(input, 'website', 300);
    const turnstileToken = field(input, 'turnstileToken', 2048, true);
    if (website) throw new FeedbackError(400, 'honeypot');
    if (!Object.hasOwn(TYPES, type) || (replyEmail && !validEmail(replyEmail))) {
        throw new FeedbackError(400, 'validation');
    }
    return { type, message, replyEmail, appVersion, browser, turnstileToken };
}

export async function readFeedback(request) {
    if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) {
        throw new FeedbackError(415, 'content_type');
    }
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new FeedbackError(413, 'too_large');
    const reader = request.body?.getReader();
    if (!reader) throw new FeedbackError(400, 'invalid_json');
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_BODY_BYTES) {
                await reader.cancel().catch(() => {});
                throw new FeedbackError(413, 'too_large');
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    let input;
    try {
        input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
        throw new FeedbackError(400, 'invalid_json');
    }
    return validateFeedback(input);
}

export async function verifyTurnstile(feedback, env, fetcher = fetch) {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: feedback.turnstileToken });
    let signal;
    try {
        signal = AbortSignal.timeout(8000);
    } catch {
        throw new FeedbackError(503, 'unavailable', 'turnstile_runtime');
    }
    let response;
    try {
        response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST', body: body.toString(), signal,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            cache: 'no-store',
            // workerd implements manual/follow, not redirect:error. Manual
            // never forwards the verification secret to a redirect target;
            // the non-2xx check below rejects every redirect response.
            redirect: 'manual',
        });
    } catch (error) {
        const diagnosticClass = ['AbortError', 'TimeoutError'].includes(error?.name) ? 'turnstile_timeout' : 'turnstile_transport';
        throw new FeedbackError(503, 'unavailable', diagnosticClass);
    }
    if (!response.ok) throw new FeedbackError(503, 'unavailable', 'turnstile_http_status');
    let result;
    try {
        result = await response.json();
    } catch (error) {
        const diagnosticClass = ['AbortError', 'TimeoutError'].includes(error?.name) ? 'turnstile_timeout' : 'turnstile_json';
        throw new FeedbackError(503, 'unavailable', diagnosticClass);
    }
    if (!result || result.success !== true || result.hostname !== new URL(SITE_ORIGIN).hostname ||
        result.action !== FEEDBACK_ACTION) throw new FeedbackError(400, 'turnstile');
}

async function privateHash(value, secret, domain) {
    if (typeof secret !== 'string' || secret.length < 32) throw new FeedbackError(503, 'unavailable');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(domain + '\n' + value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function ipRateKey(ip, secret) {
    return privateHash(ip, secret, 'duzelt-feedback-ip');
}

export function tokenClaimKey(token, secret) {
    return privateHash(token, secret, 'duzelt-feedback-token');
}

export function feedbackJob(feedback, { now = () => new Date(), uuid = () => crypto.randomUUID() } = {}) {
    const { turnstileToken, ...fields } = feedback;
    return { ...fields, id: uuid(), createdAt: now().toISOString() };
}

export function validateJob(job, now = Date.now()) {
    if (!job || typeof job !== 'object' || Array.isArray(job) || !UUID.test(job.id || '') ||
        typeof job.createdAt !== 'string' || !Number.isFinite(Date.parse(job.createdAt))) {
        throw new FeedbackError(400, 'invalid_job');
    }
    if (Object.keys(job).some(key => !['type', 'message', 'replyEmail', 'appVersion', 'browser', 'id', 'createdAt'].includes(key))) {
        throw new FeedbackError(400, 'invalid_job');
    }
    const { id, createdAt, ...fields } = job;
    try {
        validateFeedback({ ...fields, turnstileToken: 'queue-validated' });
    } catch {
        throw new FeedbackError(400, 'invalid_job');
    }
    const age = now - Date.parse(createdAt);
    if (age < -60_000) throw new FeedbackError(400, 'invalid_job');
    if (age >= JOB_MAX_AGE_MS) throw new FeedbackError(410, 'expired');
    return job;
}

export function emailMessage(job, env) {
    if (!validEmail(env.MAIL_FROM) || !validEmail(env.MAIL_TO)) throw new FeedbackError(503, 'configuration');
    return {
        from: { name: 'Düzelt', address: env.MAIL_FROM },
        to: env.MAIL_TO,
        envelope: { from: env.MAIL_FROM, to: [env.MAIL_TO] },
        ...(job.replyEmail ? { replyTo: job.replyEmail } : {}),
        subject: `[Düzelt] ${TYPES[job.type]} · ${job.id.slice(0, 8)}`,
        messageId: `<duzelt-feedback-${job.id}@duzelt.yerli.dev>`,
        ...feedbackContent(job, TYPES[job.type]),
    };
}
