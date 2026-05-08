/**
 * Next.js boot hook — runs once when the server starts (Node + Edge runtimes
 * each get their own register() call). We use it to surface missing env-var
 * config early instead of letting it fail later inside a webhook or cron.
 *
 * Behavior:
 *   - dev / preview: log a single warning listing missing vars, never throw.
 *   - prod: throw if any critical secret is missing, so a misconfigured
 *           deploy is rejected before it serves traffic.
 *
 * "Critical" = anything where missing-at-runtime breaks core flows or
 * silently weakens a security control (webhook signing, cron auth, etc.).
 */

// Required everywhere. Missing → fail fast in prod.
const CRITICAL_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
    'WEBHOOK_VERIFY_TOKEN',
    'META_APP_SECRET',
    'NEXT_PUBLIC_META_APP_ID',
    'CRON_SECRET',
];

// Required for specific surfaces. Warn only — local dev may legitimately
// run without payments / email configured.
const OPTIONAL_VARS = [
    'NEXT_PUBLIC_INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'CASHFREE_APP_ID',
    'CASHFREE_SECRET_KEY',
    'CASHFREE_WEBHOOK_SECRET',
    'CASHFREE_ENV',
    'NEXT_PUBLIC_CASHFREE_ENV',
    'RESEND_API_KEY',
    'ALERT_FROM_EMAIL',
];

export async function register() {
    // Edge runtime registers separately; only do the env audit on Node so we
    // don't double-log. Node sets NEXT_RUNTIME='nodejs', edge sets 'edge'.
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    const missingCritical = CRITICAL_VARS.filter((v) => !process.env[v]);
    const missingOptional = OPTIONAL_VARS.filter((v) => !process.env[v]);

    if (missingCritical.length === 0 && missingOptional.length === 0) {
        return;
    }

    const isProd = process.env.NODE_ENV === 'production';

    if (missingCritical.length > 0) {
        const msg = `[env] Missing critical env vars: ${missingCritical.join(', ')}`;
        if (isProd) {
            // Hard fail — a prod boot without these means webhooks, cron
            // auth, or Supabase access will silently misbehave.
            throw new Error(msg);
        }
        console.warn(msg);
    }

    if (missingOptional.length > 0) {
        console.warn(`[env] Missing optional env vars (some features disabled): ${missingOptional.join(', ')}`);
    }
}
