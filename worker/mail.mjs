import net from 'node:net';
import tls from 'node:tls';
import { FeedbackError, emailMessage, validEmail, validateJob } from './feedback.mjs';

export function smtpOptions(env, dependencies = {}) {
    const secure = env.SMTP_SECURE === 'true';
    const port = Number(env.SMTP_PORT);
    if (!['true', 'false'].includes(env.SMTP_SECURE) || env.SMTP_REQUIRE_TLS !== 'true' ||
        typeof env.SMTP_HOST !== 'string' || !/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(env.SMTP_HOST) ||
        !Number.isInteger(port) || port < 1 || port > 65535 || port === 25 ||
        !env.SMTP_USER || !env.SMTP_PASSWORD || !validEmail(env.MAIL_FROM) || !validEmail(env.MAIL_TO)) {
        throw new FeedbackError(503, 'configuration');
    }
    const connect = dependencies.connect || net.connect;
    const connectTLS = dependencies.connectTLS || tls.connect;
    return {
        host: env.SMTP_HOST, port, secure, requireTLS: true, ignoreTLS: false, opportunisticTLS: false,
        tls: { rejectUnauthorized: true, servername: env.SMTP_HOST, minVersion: 'TLSv1.2' },
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        // Keep the DNS hostname in workerd's socket for the STARTTLS upgrade;
        // Nodemailer's DNS resolution would otherwise replace it with an IP.
        getSocket(_options, callback) {
            let socket;
            try {
                socket = secure
                    ? connectTLS({ host: env.SMTP_HOST, port, servername: env.SMTP_HOST, rejectUnauthorized: true, minVersion: 'TLSv1.2' })
                    : connect({ host: env.SMTP_HOST, port });
            } catch {
                callback(Object.assign(new Error('SMTP connection failed'), { code: 'ESOCKET' }));
                return;
            }
            let done = false;
            const finish = error => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                if (error) {
                    socket.destroy();
                    callback(Object.assign(new Error('SMTP connection failed'), { code: 'ESOCKET' }));
                } else callback(null, { connection: socket, secured: secure });
            };
            const timer = setTimeout(() => finish(Object.assign(new Error('SMTP timeout'), { code: 'ETIMEDOUT' })), 10_000);
            socket.once('error', finish);
            socket.once(secure ? 'secureConnect' : 'connect', () => finish());
        },
        name: 'duzelt.yerli.dev',
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
        logger: false, debug: false, transactionLog: false,
        disableFileAccess: true, disableUrlAccess: true, maxRecipients: 1,
    };
}

export async function sendFeedbackMail(job, env, dependencies = {}) {
    validateJob(job, dependencies.now ? dependencies.now() : Date.now());
    const options = smtpOptions(env, dependencies);
    const createTransport = dependencies.createTransport || (await import('nodemailer')).default.createTransport;
    const transporter = createTransport(options);
    try {
        const result = await transporter.sendMail(emailMessage(job, env));
        if (!result.accepted?.length || result.rejected?.length) throw new FeedbackError(503, 'smtp_rejected');
        // SMTP acceptance is the available delivery boundary, not inbox proof.
        return { accepted: true };
    } finally {
        transporter.close();
    }
}
