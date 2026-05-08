import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client (Service Role)
 *
 * Uses the SERVICE_ROLE key which bypasses Row Level Security (RLS).
 * ONLY use this in trusted server-side contexts (API routes, webhooks).
 * NEVER expose this client or the service role key to the browser.
 */
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}
