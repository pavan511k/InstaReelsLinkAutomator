export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/broadcast/[jobId]
 * Returns job status + progress for polling.
 */
export async function GET(request, { params }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: job } = await supabase
        .from('broadcast_jobs')
        .select('id, status, total_recipients, processed_count, sent_count, failed_count, skipped_count, rate_limit_per_min, started_at, completed_at, created_at, error_message, dm_type')
        .eq('id', params.jobId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const pct = job.total_recipients > 0
        ? Math.round((job.processed_count / job.total_recipients) * 100)
        : 0;

    return NextResponse.json({ ...job, progressPct: pct });
}

/**
 * PATCH /api/broadcast/[jobId]
 * Body: { action: 'pause' | 'resume' | 'cancel' }
 */
export async function PATCH(request, { params }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { action } = await request.json();
    if (!['pause', 'resume', 'cancel'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: job } = await supabase
        .from('broadcast_jobs')
        .select('id, status')
        .eq('id', params.jobId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const newStatus = action === 'pause' ? 'paused'
                    : action === 'resume' ? 'running'
                    : 'failed'; // cancel = mark failed so cron ignores it

    const updates = {
        status:     newStatus,
        updated_at: new Date().toISOString(),
    };
    if (action === 'cancel') {
        updates.completed_at  = new Date().toISOString();
        updates.error_message = 'Cancelled by user';
    }

    const { error } = await supabase
        .from('broadcast_jobs')
        .update(updates)
        .eq('id', params.jobId)
        .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, status: newStatus });
}
