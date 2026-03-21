import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'AutoDM <support@autodm.pro>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.pro';

// ── Shared layout wrapper ─────────────────────────────────────────────────────
function layout(content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AutoDM</title>
</head>
<body style="margin:0;padding:0;background:#0A0915;font-family:'Inter',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0915;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <a href="${APP_URL}" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
                <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.04em;">
                  auto<span style="color:#A78BFA;">dm</span>
                </span>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#13102A;border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:40px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.25);">
                AutoDM · <a href="${APP_URL}" style="color:rgba(255,255,255,0.25);text-decoration:none;">autodm.pro</a>
              </p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.18);">
                You're receiving this because you signed up for AutoDM.<br/>
                <a href="${APP_URL}/settings" style="color:rgba(255,255,255,0.25);text-decoration:underline;">Manage email preferences</a>
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
function button(text, href) {
    return `<a href="${href}" style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">${text}</a>`;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const divider = `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:28px 0;" />`;

// ── 1. Welcome email (sent after signup) ─────────────────────────────────────
export async function sendWelcomeEmail({ to, name }) {
    const firstName = (name || to.split('@')[0]).split(' ')[0];

    const html = layout(`
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.04em;">
            Welcome to AutoDM 👋
        </h1>
        <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.65;">
            Hey ${firstName}, you're in! Let's get your Instagram on autopilot.
        </p>

        <!-- Steps -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            ${[
                ['1', 'Verify your email', 'Click the confirmation link in the email from Supabase to activate your account.'],
                ['2', 'Connect Instagram', 'Link your Instagram Business or Creator account — takes under 60 seconds.'],
                ['3', 'Set your first automation', 'Pick a post, set a keyword trigger, and watch DMs fly automatically.'],
            ].map(([num, title, desc]) => `
            <tr>
              <td style="padding:12px 0;vertical-align:top;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:top;padding-right:14px;">
                    <div style="width:28px;height:28px;border-radius:8px;background:rgba(124,58,237,0.2);border:1px solid rgba(167,139,250,0.3);text-align:center;line-height:28px;font-size:12px;font-weight:700;color:#A78BFA;">${num}</div>
                    </td>
                    <td>
                      <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:rgba(255,255,255,0.88);">${title}</p>
                      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.42);line-height:1.55;">${desc}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`).join('')}
        </table>

        <div style="text-align:center;margin-bottom:28px;">
            ${button('Get started →', `${APP_URL}/dashboard`)}
        </div>

        ${divider}

        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.32);line-height:1.6;text-align:center;">
            🎁 <strong style="color:rgba(255,255,255,0.55);">30-day free Pro trial</strong> starts automatically when you connect Instagram.<br/>
            No credit card required — ever.
        </p>
    `);

    return resend.emails.send({
        from: FROM,
        to,
        subject: 'Welcome to AutoDM 🎉 — Here\'s how to get started',
        html,
    });
}

// ── 2. Trial started email (sent when Instagram is connected) ─────────────────
export async function sendTrialStartedEmail({ to, name, igUsername, trialEndsAt }) {
    const firstName = (name || to.split('@')[0]).split(' ')[0];
    const expiryDate = new Date(trialEndsAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    const html = layout(`
        <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;padding:8px 20px;background:linear-gradient(135deg,rgba(124,58,237,0.25),rgba(167,139,250,0.15));border:1px solid rgba(167,139,250,0.3);border-radius:100px;font-size:13px;font-weight:700;color:#C4B5FD;margin-bottom:20px;">
                🎁 30-Day Pro Trial Started
            </div>
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.04em;">
                Your Pro trial is live, ${firstName}!
            </h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.65;">
                @${igUsername || 'your account'} is connected and all Pro features are unlocked.
            </p>
        </div>

        <!-- Pro features grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
                <td style="padding:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${[
                            ['✅', 'Unlimited DMs', 'No monthly cap — send as many as you need'],
                            ['✅', 'Follow Gate', 'Only send links to users who follow you first'],
                            ['✅', 'Save & load templates', 'Build a library of reusable DM setups'],
                            ['✅', 'A/B message testing', 'Test two DM variants and pick the winner'],
                            ['✅', 'Unlimited carousel slides', 'Showcase multiple products per DM'],
                            ['✅', 'Advanced analytics', 'CTR, click tracking, conversion stats'],
                        ].map(([icon, title, desc]) => `
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding-right:12px;font-size:16px;">${icon}</td>
                                <td>
                                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:rgba(255,255,255,0.85);">${title}</p>
                                  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.38);">${desc}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>`).join('')}
                    </table>
                </td>
            </tr>
        </table>

        <div style="text-align:center;margin-bottom:28px;">
            ${button('Set up your first automation →', `${APP_URL}/posts`)}
        </div>

        ${divider}

        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.35);line-height:1.6;text-align:center;">
            Your trial runs until <strong style="color:rgba(255,255,255,0.55);">${expiryDate}</strong>.<br/>
            After that, continue with Pro for just <strong style="color:rgba(255,255,255,0.55);">₹299/month</strong> — or stay on the generous free plan.
        </p>
    `);

    return resend.emails.send({
        from: FROM,
        to,
        subject: `🎁 Your 30-day AutoDM Pro trial has started!`,
        html,
    });
}

// ── 3. Trial expiry reminder (call this from a cron job at day 25) ────────────
export async function sendTrialExpiringEmail({ to, name, daysLeft, trialEndsAt }) {
    const firstName = (name || to.split('@')[0]).split(' ')[0];
    const expiryDate = new Date(trialEndsAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    const html = layout(`
        <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;padding:8px 20px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:100px;font-size:13px;font-weight:700;color:#FCD34D;margin-bottom:20px;">
                ⚠️ Trial ending in ${daysLeft} days
            </div>
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.04em;">
                Don't lose your Pro access, ${firstName}
            </h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.65;">
                Your free trial ends on <strong style="color:rgba(255,255,255,0.7);">${expiryDate}</strong>.<br/>
                Upgrade now to keep all your automations running without interruption.
            </p>
        </div>

        <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(167,139,250,0.2);border-radius:14px;padding:20px 24px;margin-bottom:28px;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#fff;">AutoDM Pro</p>
            <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.45);">Unlimited DMs · All Pro features · Priority support</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#A78BFA;letter-spacing:-0.04em;">
                ₹299<span style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.4)">/month</span>
            </p>
        </div>

        <div style="text-align:center;margin-bottom:28px;">
            ${button('Upgrade to Pro →', `${APP_URL}/pricing`)}
        </div>

        ${divider}

        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.32);text-align:center;line-height:1.6;">
            If you don't upgrade, your automations will continue on the free plan (3,000 DMs/month).<br/>
            You won't lose any data.
        </p>
    `);

    return resend.emails.send({
        from: FROM,
        to,
        subject: `⚠️ Your AutoDM Pro trial expires in ${daysLeft} days`,
        html,
    });
}
