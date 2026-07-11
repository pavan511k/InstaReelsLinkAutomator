import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendBulkIndividualEmails } from '@/lib/email';

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_SUBJECT = 200;
const MAX_BODY    = 100 * 1024; // 100 KB
// Each recipient is sent an individual message, so there's no BCC-style
// deliverability ceiling here. This cap is a fat-finger guard, not a target —
// mind the Resend plan's daily quota and domain warmup before large blasts.
const MAX_RECIPIENTS = 500;

// Split on commas, semicolons, or whitespace, then dedupe case-insensitively
// so the same address pasted twice isn't emailed twice.
function parseRecipients(input) {
    if (!input) return [];
    const seen = new Set();
    const out = [];
    for (const raw of input.split(/[,;\s]+/)) {
        const email = raw.trim();
        if (!email) continue;
        const key = email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(email);
    }
    return out;
}

function validateEmails(list) {
    for (const e of list) {
        if (!EMAIL_RE.test(e)) {
            throw new Error(`Invalid recipient address: ${e}`);
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

    const recipients = parseRecipients(body.recipients);

    if (recipients.length === 0) {
        return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 });
    }
    if (recipients.length > MAX_RECIPIENTS) {
        return NextResponse.json(
            { error: `Too many recipients (max ${MAX_RECIPIENTS})` },
            { status: 400 },
        );
    }

    try {
        validateEmails(recipients);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }

    // ── Send one individual message per recipient, then audit-log the outcome.
    let summary;
    try {
        summary = await sendBulkIndividualEmails({
            recipients,
            subject,
            html:    bodyFormat === 'html' ? content : undefined,
            text:    bodyFormat === 'text' ? content : undefined,
            branded: branded && bodyFormat === 'html',
        });
    } catch (e) {
        summary = {
            total: recipients.length,
            sent: 0,
            failed: recipients.length,
            ids: [],
            errors: [e.message || 'Send failed'],
        };
    }

    // 'failed' only when NOTHING went out; a partial send still counts as sent
    // but records how many slipped and why.
    const allFailed = summary.sent === 0;
    const status    = allFailed ? 'failed' : 'sent';
    const errorMessage = summary.failed > 0
        ? `${summary.sent} sent, ${summary.failed} failed${summary.errors[0] ? `: ${summary.errors[0]}` : ''}`
        : null;

    // Service-role insert — the table is RLS-protected for reads
    // but writes always go through the API. All recipients live in
    // to_addresses; cc/bcc are unused now that every send is individual.
    const admin = createAdminClient();
    await admin.from('admin_email_log').insert({
        sent_by:        user.id,
        sender_email:   user.email,
        to_addresses:   recipients,
        cc_addresses:   [],
        bcc_addresses:  [],
        subject,
        body_format:    bodyFormat,
        branded_layout: branded && bodyFormat === 'html',
        status,
        resend_id:      summary.ids[0] || null,
        error_message:  errorMessage,
    });

    if (allFailed) {
        return NextResponse.json({ error: errorMessage || 'Send failed' }, { status: 502 });
    }

    return NextResponse.json({
        status: 'sent',
        sent:   summary.sent,
        failed: summary.failed,
        total:  summary.total,
    });
}
