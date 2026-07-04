import { Resend } from 'resend';

// Lazy initialisation — never called at build time, only at runtime
// when an actual email send is triggered.
function getResend() {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY environment variable is not set');
    return new Resend(key);
}

const FROM = 'AutoDM <support@autodm.pro>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.pro';

// ── Brand palette ─────────────────────────────────────────────────────────────
// All email templates draw from this single source. Dark-mode "premium SaaS"
// look — true black surface, white text, orange accent. Matches the rest of
// the AutoDM brand (legal pages, cookie banner, dashboard CTAs).
const COLORS = {
    bg:           '#0F0F0F',   // page background
    card:         '#171717',   // surface card
    cardSubtle:   '#1F1F1F',   // inner panels / inset
    border:       'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',
    text:         '#FFFFFF',
    textSoft:     'rgba(255,255,255,0.62)',
    textMuted:    'rgba(255,255,255,0.38)',
    textFaint:    'rgba(255,255,255,0.22)',
    accent:       '#F97316',   // orange-500 — primary brand accent
    accentHover:  '#EA580C',   // orange-600
    accentSoft:   'rgba(249,115,22,0.14)',
    accentBorder: 'rgba(249,115,22,0.32)',
    warn:         '#F59E0B',
    warnSoft:     'rgba(245,158,11,0.13)',
    warnBorder:   'rgba(245,158,11,0.32)',
};

// ── Shared layout wrapper ─────────────────────────────────────────────────────
function layout(content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AutoDM</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:'Inter','Helvetica Neue',Arial,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <a href="${APP_URL}" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
                <span style="font-size:22px;font-weight:800;color:${COLORS.text};letter-spacing:-0.04em;">
                  auto<span style="color:${COLORS.accent};">dm</span>
                </span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:20px;padding:40px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:${COLORS.textFaint};">
                AutoDM · <a href="${APP_URL}" style="color:${COLORS.textFaint};text-decoration:none;">autodm.pro</a>
              </p>
              <p style="margin:0;font-size:12px;color:${COLORS.textFaint};">
                You're receiving this because you signed up for AutoDM.<br/>
                <a href="${APP_URL}/settings" style="color:${COLORS.textFaint};text-decoration:underline;">Manage email preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Button helper ─────────────────────────────────────────────────────────────
// Solid orange CTA — high contrast on the dark card, on-brand.
function button(text, href) {
    return `<a href="${href}" style="display:inline-block;padding:13px 28px;background:${COLORS.accent};color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;box-shadow:0 6px 18px -6px rgba(249,115,22,0.45);">${text}</a>`;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const divider = `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:28px 0;" />`;

// ── Ad-hoc admin send ─────────────────────────────────────────────────────────
// Backs the /admin/email tool. Caller provides recipients + content;
// optionally wraps the HTML body in the branded layout() so admin emails
// match the rest of AutoDM's transactional style. Returns the Resend
// response so callers can log the resend_id.
export async function sendCustomEmail({
    to,
    cc = [],
    bcc = [],
    subject,
    html,
    text,
    branded = false,
}) {
    const wrappedHtml = branded && html ? layout(html) : html;

    return getResend().emails.send({
        from: FROM,
        to,
        // Resend rejects empty arrays for cc/bcc — pass undefined when none.
        cc:  cc.length  > 0 ? cc  : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        html: wrappedHtml,
        text,
    });
}

// ── 1. Trial started email (sent on email verification) ─────────────────────
// This is the ONLY onboarding email we send from our side — Supabase already
// sends the email-verification confirmation at signup. Triggered from
// `/auth/callback` the first time the user clicks the verification link.
// We deliberately don't send any "welcome" email at signup or any extra
// email at IG/FB connect — one email, one moment.
//
// `igUsername` is unused (kept in the signature for backwards-compat in
// case any other caller still passes it); the email no longer assumes the
// user has connected an account when it fires.
// eslint-disable-next-line no-unused-vars
export async function sendTrialStartedEmail({ to, name, igUsername, trialEndsAt }) {
    const firstName = (name || to.split('@')[0]).split(' ')[0];
    const expiryDate = new Date(trialEndsAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    const html = layout(`
        <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;padding:7px 18px;background:${COLORS.accentSoft};border:1px solid ${COLORS.accentBorder};border-radius:100px;font-size:12px;font-weight:700;color:${COLORS.accent};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
                30-Day Pro Trial Started
            </div>
            <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;color:${COLORS.text};letter-spacing:-0.03em;line-height:1.2;">
                Welcome to AutoDM, ${firstName}.
            </h1>
            <p style="margin:0;font-size:15px;color:${COLORS.textSoft};line-height:1.65;">
                Your 30-day Pro trial is live — every Pro feature is unlocked,
                no credit card required.<br/>
                Connect your Instagram or Facebook account in the dashboard to
                fire your first automated DM.
            </p>
        </div>

        <!-- Pro features list -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${COLORS.cardSubtle};border:1px solid ${COLORS.border};border-radius:14px;">
            ${[
                ['Unlimited automation flows',          'No 5-automation cap — build as many as you need.'],
                ['Email Collector',                     'Capture leads when fans reply with their email.'],
                ['Story Mention Auto-DM',               'Auto-reply when fans tag you in a story.'],
                ['Ask-to-Follow gate',                  'Send links only to users who follow you first.'],
                ['Multi-step flow automation',          'Send sequential follow-ups at configurable delays.'],
                ['Analytics & priority support',        'DM logs, click counts, and faster help.'],
            ].map(([title, desc], i, arr) => `
                <tr>
                  <td style="padding:14px 20px;${i < arr.length - 1 ? `border-bottom:1px solid ${COLORS.border};` : ''}">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:14px;vertical-align:top;">
                          <div style="width:20px;height:20px;border-radius:50%;background:${COLORS.accent};text-align:center;line-height:20px;color:#fff;font-size:12px;font-weight:800;">✓</div>
                        </td>
                        <td>
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:${COLORS.text};">${title}</p>
                          <p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.5;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
        </table>

        <div style="text-align:center;margin-bottom:28px;">
            ${button('Connect your account', `${APP_URL}/dashboard`)}
        </div>

        ${divider}

        <p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.65;text-align:center;">
            Your trial runs until <strong style="color:${COLORS.textSoft};">${expiryDate}</strong>.<br/>
            After that, continue with Pro for just <strong style="color:${COLORS.text};">₹299/month</strong> — or stay on the free plan with up to 5 automations.
        </p>
    `);

    return getResend().emails.send({
        from: FROM,
        to,
        subject: 'Your 30-day AutoDM Pro trial is live',
        html,
    });
}

// ── 2. Trial expiry reminder (sent by /api/cron/expiring-soon) ────────────────
export async function sendTrialExpiringEmail({ to, name, daysLeft, trialEndsAt }) {
    const firstName = (name || to.split('@')[0]).split(' ')[0];
    const expiryDate = new Date(trialEndsAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const dayWord = daysLeft === 1 ? 'day' : 'days';

    const html = layout(`
        <div style="text-align:center;margin-bottom:30px;">
            <div style="display:inline-block;padding:7px 18px;background:${COLORS.warnSoft};border:1px solid ${COLORS.warnBorder};border-radius:100px;font-size:12px;font-weight:700;color:${COLORS.warn};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
                Trial ends in ${daysLeft} ${dayWord}
            </div>
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:${COLORS.text};letter-spacing:-0.03em;line-height:1.25;">
                Don't lose your Pro features, ${firstName}.
            </h1>
            <p style="margin:0;font-size:15px;color:${COLORS.textSoft};line-height:1.65;">
                Your AutoDM Pro trial ends on <strong style="color:${COLORS.text};">${expiryDate}</strong>.<br/>
                Upgrade now to keep your Pro automations firing without interruption.
            </p>
        </div>

        <div style="background:${COLORS.cardSubtle};border:1px solid ${COLORS.border};border-radius:14px;padding:22px 24px;margin-bottom:28px;">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${COLORS.text};">AutoDM Pro</p>
            <p style="margin:0 0 16px;font-size:13px;color:${COLORS.textMuted};line-height:1.5;">
                Unlimited automations · Email Collector · Story Mention Auto-DM · Ask-to-Follow · Priority support
            </p>
            <p style="margin:0;font-size:30px;font-weight:800;color:${COLORS.accent};letter-spacing:-0.04em;">
                ₹299<span style="font-size:15px;font-weight:500;color:${COLORS.textMuted};">/month</span>
            </p>
        </div>

        <div style="text-align:center;margin-bottom:28px;">
            ${button('Upgrade to Pro', `${APP_URL}/pricing`)}
        </div>

        ${divider}

        <p style="margin:0;font-size:13px;color:${COLORS.textMuted};text-align:center;line-height:1.65;">
            If you don't upgrade, your account moves to the free plan (up to 5 automations).<br/>
            <strong style="color:${COLORS.textSoft};">Email Collector, Story Mention Auto-DM and Ask-to-Follow stop firing</strong> on free.<br/>
            All your saved data stays intact.
        </p>
    `);

    return getResend().emails.send({
        from: FROM,
        to,
        subject: `Your AutoDM Pro trial expires in ${daysLeft} ${dayWord}`,
        html,
    });
}

// ── 3. Pro subscription expiring soon (cron — 7 days before plan_expires_at) ──
// Sent to users on PAID Pro whose subscription is within 7 days of expiry,
// once per expiry value. Without this email, paid users hit free silently
// when their period ends — main cause of involuntary churn for products
// without auto-renewal.
export async function sendProExpiringEmail({ to, name, daysLeft, expiresAt }) {
    const firstName  = (name || to.split('@')[0]).split(' ')[0];
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
    const dayWord = daysLeft === 1 ? 'day' : 'days';

    const html = layout(`
        <div style="text-align:center;margin-bottom:30px;">
            <div style="display:inline-block;padding:7px 18px;background:${COLORS.warnSoft};border:1px solid ${COLORS.warnBorder};border-radius:100px;font-size:12px;font-weight:700;color:${COLORS.warn};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
                Pro expires in ${daysLeft} ${dayWord}
            </div>
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:${COLORS.text};letter-spacing:-0.03em;line-height:1.25;">
                Renew your Pro plan, ${firstName}.
            </h1>
            <p style="margin:0;font-size:15px;color:${COLORS.textSoft};line-height:1.65;">
                Your AutoDM Pro subscription ends on <strong style="color:${COLORS.text};">${expiryDate}</strong>.<br/>
                Renew to keep Email Collector, Story Mention Auto-DM, Ask-to-Follow and all Pro features active.
            </p>
        </div>

        <div style="background:${COLORS.cardSubtle};border:1px solid ${COLORS.border};border-radius:14px;padding:22px 24px;margin-bottom:28px;">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${COLORS.text};">AutoDM Pro</p>
            <p style="margin:0 0 16px;font-size:13px;color:${COLORS.textMuted};line-height:1.5;">
                Unlimited automations · Email Collector · Story Mention Auto-DM · Ask-to-Follow · Priority support
            </p>
            <p style="margin:0;font-size:14px;color:${COLORS.textSoft};">
                <strong style="color:${COLORS.accent};font-size:18px;">₹299/month</strong>
                &nbsp;·&nbsp;
                <strong style="color:${COLORS.accent};font-size:18px;">₹2,999/year</strong>
                <span style="color:${COLORS.textMuted};">(save ₹589)</span>
            </p>
        </div>

        <div style="text-align:center;margin-bottom:28px;">
            ${button('Renew Pro', `${APP_URL}/pricing`)}
        </div>

        ${divider}

        <p style="margin:0;font-size:13px;color:${COLORS.textMuted};text-align:center;line-height:1.65;">
            We don't auto-renew, so if you do nothing your account moves to the free plan
            (up to 5 automations) on ${expiryDate}.<br/>
            <strong style="color:${COLORS.textSoft};">Email Collector, Story Mention Auto-DM and Ask-to-Follow stop firing</strong> on free —
            but all your saved data stays intact.
        </p>
    `);

    return getResend().emails.send({
        from: FROM,
        to,
        subject: `Your AutoDM Pro expires in ${daysLeft} ${dayWord}`,
        html,
    });
}

// ── 4. Reconnect required (IG token expired / couldn't be auto-refreshed) ─────
// Sent by /api/cron/refresh-tokens when an Instagram long-lived token can't be
// renewed automatically. Automations stop until the user reconnects, so this
// is a direct "action needed" nudge rather than a soft reminder.
export async function sendReconnectRequiredEmail({ to, name, platform = 'Instagram', handle = '' }) {
    const firstName = (name || to.split('@')[0]).split(' ')[0];
    const account   = handle ? `@${handle}` : `your ${platform} account`;

    const html = layout(`
        <div style="text-align:center;margin-bottom:30px;">
            <div style="display:inline-block;padding:7px 18px;background:${COLORS.warnSoft};border:1px solid ${COLORS.warnBorder};border-radius:100px;font-size:12px;font-weight:700;color:${COLORS.warn};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
                Action needed
            </div>
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:${COLORS.text};letter-spacing:-0.03em;line-height:1.25;">
                Reconnect ${platform} to keep your DMs running, ${firstName}.
            </h1>
            <p style="margin:0;font-size:15px;color:${COLORS.textSoft};line-height:1.65;">
                ${platform}'s access for <strong style="color:${COLORS.text};">${account}</strong> has expired and we couldn't renew it automatically.
                Until you reconnect, <strong style="color:${COLORS.textSoft};">your automations have stopped sending DMs.</strong>
            </p>
        </div>

        <div style="background:${COLORS.cardSubtle};border:1px solid ${COLORS.border};border-radius:14px;padding:20px 22px;margin-bottom:28px;">
            <p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">
                Reconnecting takes about 20 seconds and keeps all your existing automations, posts, and settings intact — it just refreshes ${platform}'s permission.
            </p>
        </div>

        <div style="text-align:center;margin-bottom:28px;">
            ${button(`Reconnect ${platform}`, `${APP_URL}/settings`)}
        </div>

        ${divider}

        <p style="margin:0;font-size:13px;color:${COLORS.textMuted};text-align:center;line-height:1.65;">
            ${platform} access tokens expire every 60 days for security. We try to refresh them automatically — a reconnect is only needed when that isn't possible (for example, if the permission was revoked).
        </p>
    `);

    return getResend().emails.send({
        from: FROM,
        to,
        subject: `Action needed: reconnect ${platform} to keep AutoDM running`,
        html,
    });
}
