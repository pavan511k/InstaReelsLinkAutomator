import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * GET /api/alerts
 * Returns the current user's alert preferences.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data } = await supabase
        .from('alert_preferences')
        .select('alert_email, webhook_url, threshold_pct, alerted_months')
        .eq('user_id', user.id)
        .maybeSingle();

    return NextResponse.json({
        alertEmail:    data?.alert_email    || '',
        webhookUrl:    data?.webhook_url    || '',
        thresholdPct:  data?.threshold_pct  ?? 80,
        alertedMonths: data?.alerted_months || [],
    });
}

/**
 * POST /api/alerts
 * Upsert alert preferences for the current user.
 * Body: { alertEmail, webhookUrl, thresholdPct }
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { alertEmail = '', webhookUrl = '', thresholdPct = 80 } = body;

    if (thresholdPct < 50 || thresholdPct > 99) {
        return NextResponse.json({ error: 'threshold_pct must be between 50 and 99' }, { status: 400 });
    }

    const { error } = await supabase
        .from('alert_preferences')
        .upsert({
            user_id:       user.id,
            alert_email:   alertEmail.trim() || null,
            webhook_url:   webhookUrl.trim() || null,
            threshold_pct: thresholdPct,
            updated_at:    new Date().toISOString(),
        }, { onConflict: 'user_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}

/**
 * POST /api/alerts?action=test
 * Sends a test alert to the user's configured channels.
 */
export async function PUT(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: prefs } = await supabase
        .from('alert_preferences')
        .select('alert_email, webhook_url, threshold_pct')
        .eq('user_id', user.id)
        .maybeSingle();

    if (!prefs?.alert_email && !prefs?.webhook_url) {
        return NextResponse.json({ error: 'No alert channels configured. Save your preferences first.' }, { status: 400 });
    }

    const results = await fireAlerts({
        userId:      user.id,
        userEmail:   user.email,
        alertEmail:  prefs.alert_email,
        webhookUrl:  prefs.webhook_url,
        sentCount:   850,       // simulated
        limit:       1000,
        thresholdPct: prefs.threshold_pct,
        isTest:      true,
    });

    return NextResponse.json({ success: true, results });
}

// ── Shared alert sender ────────────────────────────────────────────────────────

/**
 * Fire email + webhook alerts.
 * Called from this route (test) and from the webhook (production).
 *
 * @param {object} opts
 * @param {string}  opts.userId
 * @param {string}  opts.userEmail      — auth email (for fallback)
 * @param {string}  opts.alertEmail     — custom alert email
 * @param {string}  opts.webhookUrl
 * @param {number}  opts.sentCount      — DMs sent this month
 * @param {number}  opts.limit          — monthly DM limit
 * @param {number}  opts.thresholdPct   — e.g. 80
 * @param {boolean} opts.isTest         — whether this is a test fire
 */
export async function fireAlerts({ userId, userEmail, alertEmail, webhookUrl, sentCount, limit, thresholdPct, isTest = false }) {
    const pct     = Math.round((sentCount / limit) * 100);
    const results = {};

    const subject = isTest
        ? '[AutoDM] Test Alert — Limit Usage'
        : `[AutoDM] ⚠️ You've used ${pct}% of your monthly DM limit`;

    const bodyText = isTest
        ? `This is a test alert from AutoDM.\n\nYour real usage would be shown here when you reach ${thresholdPct}% of your ${limit} DM monthly limit.\n\nVisit your dashboard to manage automations.`
        : `Hi,\n\nYou've sent ${sentCount.toLocaleString()} out of ${limit.toLocaleString()} DMs this month (${pct}%).\n\nAt this rate you may hit your limit soon. Log in to your AutoDM dashboard to review your automations or upgrade your plan.\n\nhttps://autodm.app/dashboard\n\n— AutoDM`;

    // ── Email via Resend ──────────────────────────────────────────
    const emailTo = alertEmail || userEmail;
    if (emailTo && process.env.RESEND_API_KEY) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from:    process.env.ALERT_FROM_EMAIL || 'AutoDM <alerts@autodm.app>',
                    to:      [emailTo],
                    subject,
                    text:    bodyText,
                    html:    buildEmailHtml({ subject, sentCount, limit, pct, thresholdPct, isTest }),
                }),
            });
            results.email = res.ok ? 'sent' : `failed (${res.status})`;
        } catch (err) {
            results.email = `error: ${err.message}`;
        }
    } else if (emailTo && !process.env.RESEND_API_KEY) {
        results.email = 'skipped (RESEND_API_KEY not set)';
    }

    // ── Webhook POST ──────────────────────────────────────────────
    if (webhookUrl) {
        try {
            const res = await fetch(webhookUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event:        isTest ? 'test_alert' : 'limit_warning',
                    userId,
                    sentCount,
                    monthlyLimit: limit,
                    usagePct:     pct,
                    thresholdPct,
                    timestamp:    new Date().toISOString(),
                }),
            });
            results.webhook = res.ok ? 'sent' : `failed (${res.status})`;
        } catch (err) {
            results.webhook = `error: ${err.message}`;
        }
    }

    return results;
}

// ── Email HTML builder ─────────────────────────────────────────────────────────

function buildEmailHtml({ subject, sentCount, limit, pct, thresholdPct, isTest }) {
    const barWidth  = Math.min(100, pct);
    const barColor  = pct >= 90 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#7C3AED';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0D0A1E;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0A1E;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#13102A;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7C3AED,#5B21B6);padding:28px 32px;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em;">AutoDM</p>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">
            ${isTest ? 'Test Alert' : 'Monthly limit warning'}
          </p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.04em;">${pct}% used</p>
          <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;">
            You've sent <strong style="color:rgba(255,255,255,0.85);">${sentCount.toLocaleString()}</strong>
            out of your <strong style="color:rgba(255,255,255,0.85);">${limit.toLocaleString()}</strong> monthly DMs.
          </p>
          <!-- Progress bar -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:rgba(255,255,255,0.08);border-radius:100px;height:10px;overflow:hidden;">
              <div style="width:${barWidth}%;height:10px;background:${barColor};border-radius:100px;"></div>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;font-size:13.5px;color:rgba(255,255,255,0.45);line-height:1.65;">
            ${isTest
                ? `This is a test alert. Your account will be notified when real usage reaches ${thresholdPct}%.`
                : `At this pace you may hit your limit before the month ends. Consider pausing some automations or upgrading your plan.`}
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.app'}/dashboard"
             style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
            Open Dashboard →
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11.5px;color:rgba(255,255,255,0.2);">
            You're receiving this because you set up limit alerts in AutoDM Settings.
            To stop these alerts, remove your email from Settings → Configuration → Alerts.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
