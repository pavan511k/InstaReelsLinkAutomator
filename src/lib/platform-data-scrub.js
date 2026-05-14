/**
 * Meta Platform Terms 3(d)(i) compliance helper.
 *
 * Anonymizes Platform Data identifiers on historical rows when a user
 * has revoked our right to use their data (Meta-side: deauthorize webhook
 * or data-deletion webhook). NULLs out IGSIDs and IG profile fields
 * across dm_sent_log, email_leads, click_events, and any in-flight queue
 * rows that survived account cleanup.
 *
 * We anonymize rather than hard-delete so the user's aggregate analytics
 * (TOTAL SENT, dates, post linkage) survive a future reconnect. The
 * Platform Data itself (IGSIDs, usernames, first names) is removed.
 *
 * Best-effort: each table is wrapped so a missing table or absent column
 * doesn't abort the whole sweep.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase — admin or server client (must bypass RLS for cross-table writes)
 * @param {string[]} accountIds — connected_accounts.id list being deauthorized
 */
export async function scrubPlatformDataReferences(supabase, accountIds) {
    if (!Array.isArray(accountIds) || accountIds.length === 0) return;

    // user_id for the tables that don't carry account_id.
    let userId = null;
    try {
        const { data } = await supabase
            .from('connected_accounts')
            .select('user_id')
            .in('id', accountIds)
            .limit(1)
            .maybeSingle();
        userId = data?.user_id || null;
    } catch { /* fall through — per-table try/catch below still runs */ }

    if (userId) {
        try {
            await supabase.from('dm_sent_log')
                .update({
                    recipient_ig_id:      null,
                    recipient_username:   null,
                    recipient_first_name: null,
                })
                .eq('user_id', userId);
        } catch (err) {
            console.warn('[Scrub] dm_sent_log update failed:', err.message);
        }

        try {
            await supabase.from('email_leads')
                .update({ recipient_ig_id: null })
                .eq('user_id', userId);
        } catch (err) {
            console.warn('[Scrub] email_leads update failed:', err.message);
        }

        try {
            await supabase.from('click_events')
                .update({ recipient_ig_id: null })
                .eq('user_id', userId);
        } catch (err) {
            console.warn('[Scrub] click_events update failed:', err.message);
        }
    }

    // Queue tables scope by account_id directly. These are normally cleared
    // before scrub runs, but belt-and-suspenders any survivors.
    try {
        await supabase.from('dm_followup_queue')
            .update({ recipient_ig_id: null })
            .in('account_id', accountIds);
    } catch (err) {
        console.warn('[Scrub] dm_followup_queue update failed:', err.message);
    }

    try {
        await supabase.from('email_collect_queue')
            .update({ recipient_ig_id: null })
            .in('account_id', accountIds);
    } catch (err) {
        console.warn('[Scrub] email_collect_queue update failed:', err.message);
    }
}
