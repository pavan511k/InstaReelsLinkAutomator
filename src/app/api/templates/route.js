import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';

const MAX_TEMPLATES_PER_USER = 20;

/**
 * GET /api/templates
 * List user's saved DM automation templates
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const { data: templates, error } = await supabase
            .from('dm_templates')
            .select('id, name, dm_config, trigger_config, settings_config, created_at, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) {
            // Table may not exist yet
            return NextResponse.json({ templates: [] });
        }

        return NextResponse.json({ templates: templates || [] });
    } catch {
        return NextResponse.json({ templates: [] });
    }
}

/**
 * POST /api/templates
 * Save a new DM automation template — Pro/Trial only
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const plan = await getUserEffectivePlan(supabase, user.id);
    const gate = requirePro(plan, 'Saving templates requires a Pro plan.');
    if (gate) return gate;

    const body = await request.json();
    const { name, dmConfig, triggerConfig, settingsConfig } = body;

    if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!dmConfig) {
        return NextResponse.json({ error: 'DM config is required' }, { status: 400 });
    }

    try {
        // Check template count limit
        const { count } = await supabase
            .from('dm_templates')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);

        if (count >= MAX_TEMPLATES_PER_USER) {
            return NextResponse.json({
                error: `Maximum ${MAX_TEMPLATES_PER_USER} templates reached. Delete an existing template first.`,
            }, { status: 400 });
        }

        const { data: template, error } = await supabase
            .from('dm_templates')
            .insert({
                user_id: user.id,
                name: name.trim(),
                dm_config: dmConfig,
                trigger_config: triggerConfig || {},
                settings_config: settingsConfig || {},
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to save template:', error);
            return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
        }

        return NextResponse.json({ success: true, template });
    } catch (err) {
        console.error('Template save error:', err);
        return NextResponse.json({ error: `Save failed: ${err.message}` }, { status: 500 });
    }
}

/**
 * DELETE /api/templates
 * Delete a DM automation template
 */
export async function DELETE(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
        return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('dm_templates')
            .delete()
            .eq('id', templateId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Failed to delete template:', error);
            return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Template delete error:', err);
        return NextResponse.json({ error: `Delete failed: ${err.message}` }, { status: 500 });
    }
}
