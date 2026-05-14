import { createClient } from '@/lib/supabase-server';
import LogsContent from '@/components/dashboard/LogsContent';

export const metadata = { title: 'DM Logs — AutoDM' };

export default async function LogsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // ── Fetch all automations for this user ──────────────────────
    let automations = [];
    let totalSent   = 0;
    let totalFailed = 0;
    let todaySent   = 0;

    try {
        const { data: userAutomations } = await supabase
            .from('dm_automations')
            .select('id, post_id, dm_type, instagram_posts(id, caption, thumbnail_url, media_url)')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        automations = userAutomations || [];

        // Aggregate counts — filter by user_id, NOT automation_id. dm_automations
        // hard-delete sets dm_sent_log.automation_id to NULL via FK, so rows from
        // deleted automations would be excluded otherwise. Also covers cases where
        // automation_id is intentionally null (story mention, chip tap, opening
        // tap reward, follow-confirmation reward).
        const { count: sentCount } = await supabase
            .from('dm_sent_log')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'sent');

        const { count: failCount } = await supabase
            .from('dm_sent_log')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'failed');

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
            .from('dm_sent_log')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'sent')
            .gte('sent_at', todayStart.toISOString());

        totalSent   = sentCount  || 0;
        totalFailed = failCount  || 0;
        todaySent   = todayCount || 0;
    } catch {
        // dm_sent_log may not exist yet
    }

    // Build a map: automation_id → { caption, thumbnail }
    const automationPostMap = {};
    for (const a of automations) {
        automationPostMap[a.id] = {
            caption:      a.instagram_posts?.caption || 'No caption',
            thumbnailUrl: a.instagram_posts?.thumbnail_url || a.instagram_posts?.media_url || null,
            dmType:       a.dm_type || 'button_template',
        };
    }

    return (
        <LogsContent
            automationPostMap={automationPostMap}
            totalSent={totalSent}
            totalFailed={totalFailed}
            todaySent={todaySent}
        />
    );
}
