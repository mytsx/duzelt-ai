const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export function feedbackContent(job, typeLabel) {
    const date = new Intl.DateTimeFormat('tr-TR', {
        dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul',
    }).format(new Date(job.createdAt));
    const reference = job.id.slice(0, 8);
    const details = [
        ...(job.replyEmail ? [['Yanıt adresi', job.replyEmail]] : []),
        ...(job.appVersion ? [['Uygulama sürümü', job.appVersion]] : []),
        ...(job.browser ? [['Tarayıcı', job.browser]] : []),
    ];
    const replyUrl = job.replyEmail
        ? `mailto:${encodeURIComponent(job.replyEmail)}?subject=${encodeURIComponent(`Düzelt — ${typeLabel} (${reference})`)}`
        : '';
    const rows = details.map(([label, value]) => `<tr><td style="padding:8px 12px 8px 0;width:130px;color:#515665;vertical-align:top;font-size:14px;">${escape(label)}</td><td style="padding:8px 0;color:#191d2c;font-size:14px;overflow-wrap:anywhere;word-break:break-word;">${escape(value)}</td></tr>`).join('');
    const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f8;color:#191d2c;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f8;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border:1px solid #d2d4db;background:#fcfcfe;">
<tr><td style="padding:24px;background:#485cd0;color:#fff;"><div style="font-size:28px;font-weight:800;">Düzelt</div><div style="margin-top:7px;font-size:14px;line-height:1.5;">AI Türkçe Metin Düzeltici · Geri bildirim</div></td></tr>
<tr><td style="padding:28px 24px 12px;"><h1 style="margin:0 0 8px;font-size:25px;line-height:1.3;">${escape(typeLabel)}</h1><p style="margin:0;color:#515665;font-size:14px;line-height:1.6;">${escape(date)} · Türkiye saati<br>Kayıt #${escape(reference)}</p></td></tr>
<tr><td style="padding:16px 24px 24px;"><h2 style="margin:0 0 12px;color:#3646ad;font-size:15px;">Kullanıcının mesajı</h2><div style="padding:20px;background:#f2f5ff;border-left:4px solid #485cd0;font-size:16px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;">${escape(job.message).replace(/\r\n|\r|\n/g, '<br>')}</div></td></tr>
${rows ? `<tr><td style="padding:0 24px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #d2d4db;">${rows}</table></td></tr>` : ''}
<tr><td style="padding:0 24px 28px;">${replyUrl
        ? `<a href="${escape(replyUrl)}" style="display:inline-block;background:#485cd0;color:#fff;padding:12px 22px;font-size:15px;font-weight:bold;text-decoration:none;">Kullanıcıya yanıtla</a><p style="margin:12px 0 0;color:#515665;font-size:13px;line-height:1.6;">E-posta uygulamasındaki Yanıtla düğmesi de aynı adrese gider.</p>`
        : '<p style="margin:0;color:#515665;font-size:14px;line-height:1.6;">Kullanıcı yanıt adresi paylaşmadı. Bu bildirim için e-postayla dönüş yapılamaz.</p>'}</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #d2d4db;background:#f3f4f8;font-size:12px;color:#515665;line-height:1.7;">Bu bildirim <a href="https://duzelt.yerli.dev/support/" style="color:#3646ad;">Düzelt destek formundan</a> gönderildi.<br>Tam kayıt kimliği: <span style="overflow-wrap:anywhere;word-break:break-all;">${escape(job.id)}</span><br>Aynı kimliğe sahip tekrarlar aynı bildirime aittir.</td></tr>
</table></td></tr></table></body></html>`;
    const text = [
        `DÜZELT — ${typeLabel}`, `${date} (Türkiye saati)`, `Kayıt #${reference}`,
        '', 'KULLANICININ MESAJI', '', job.message, '',
        ...details.map(([label, value]) => `${label}: ${value}`),
        ...(job.replyEmail ? ['Yanıtla seçeneği kullanıcının adresine gider.'] : ['Kullanıcı yanıt adresi paylaşmadı; e-postayla dönüş yapılamaz.']),
        '', 'Düzelt destek formu: https://duzelt.yerli.dev/support/', `Tam kayıt: ${job.id}`,
        'Aynı kimliğe sahip tekrarlar aynı bildirime aittir.',
    ].join('\n');
    return { html, text };
}
