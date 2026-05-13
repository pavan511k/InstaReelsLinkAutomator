import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendCustomEmail } from '@/lib/email';

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_SUBJECT = 200;
const MAX_BODY    = 100 * 1024; // 100 KB
const MAX_RECIPIENTS_TOTAL = 50;

function parseRecipients(input) {
    if (!input) return [];
    return input
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function validateEmails(list, label) {
    for (const e of list) {
        if (!EMAIL_RE.test(e)) {
            throw new Error(`Invalid ${label} address: ${e}`);
        }
    }
}

export async function POST(request) {
    // ── Auth: allowlist check (defense-in-depth beyond middleware) ─────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!user.email || !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Parse + validate input ─────────────────────────────────────────────
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const subject    = (body.subject || '').trim();
    const bodyFormat = body.bodyFormat === 'text' ? 'text' : 'html';
    const branded    = !!body.branded;
    const content    = (body.body || '').trim();

    if (!subject)                       return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    if (subject.length > MAX_SUBJECT)   return NextResponse.json({ error: `Subject exceeds ${MAX_SUBJECT} chars` }, { status: 400 });
    if (!content)                       return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    if (content.length > MAX_BODY)      return NextResponse.json({ error: 'Body too large' }, { status: 400 });

    const to  = parseRecipients(body.to);
    const cc  = parseRecipients(body.cc);
    const bcc = parseRecipients(body.bcc);

    if (to.length === 0) {
        return NextResponse.json({ error: 'At least one To recipient is required' }, { status: 400 });
    }
    if (to.length + cc.length + bcc.length > MAX_RECIPIENTS_TOTAL) {
        return NextResponse.json(
            { error: `Too many recipients (max ${MAX_RECIPIENTS_TOTAL} across To+CC+BCC)` },
            { status: 400 },
        );
    }

    try {
        validateEmails(to,  'To');
        validateEmails(cc,  'CC');
        validateEmails(bcc, 'BCC');
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }

    // ── Send via Resend, then audit-log the attempt either way ─────────────
    let status        = 'sent';
    let resendId      = null;
    let errorMessage  = null;

    try {
        const { data, error } = await sendCustomEmail({
            to,
            cc,
            bcc,
            subject,
            html:    bodyFormat === 'html' ? content : undefined,
            text:    bodyFormat === 'text' ? content : undefined,
            branded: branded && bodyFormat === 'html',
        });

        if (error) {
            status       = 'failed';
            errorMessage = error.message || JSON.stringify(error);
        } else {
            resendId = data?.id || null;
        }
    } catch (e) {
        status       = 'failed';
        errorMessage = e.message || 'Send failed';
    }

    // Service-role insert — the table is RLS-protected for reads
    // but writes always go through the API.
    const admin = createAdminClient();
    await admin.from('admin_email_log').insert({
        sent_by:        user.id,
        sender_email:   user.email,
        to_addresses:   to,
        cc_addresses:   cc,
        bcc_addresses:  bcc,
        subject,
        body_format:    bodyFormat,
        branded_layout: branded && bodyFormat === 'html',
        status,
        resend_id:      resendId,
        error_message:  errorMessage,
    });

    if (status === 'failed') {
        return NextResponse.json({ error: errorMessage || 'Send failed' }, { status: 502 });
    }

    return NextResponse.json({ id: resendId, status: 'sent' });
}
