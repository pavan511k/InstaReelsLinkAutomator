import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ContactsView from './ContactsView';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * /contacts — every recipient who has received at least one DM from
 * one of the active workspace's automations. Aggregated server-side
 * via `contacts_for_workspace` RPC so we get one round-trip regardless
 * of recipient count. The RPC scopes by workspace_id so contacts stay
 * properly isolated when the user owns multiple workspaces.
 *
 * Falls back to the legacy `contacts_for_user` RPC if the workspace-
 * scoped variant hasn't been deployed yet (migration pending).
 */
export const metadata = {
  title: 'Contacts — AutoDM',
};

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const workspaceId = await getActiveWorkspaceId(supabase);

  let contacts = [];
  if (workspaceId) {
    try {
      // Prefer the workspace-scoped RPC.
      const { data, error } = await supabase
        .rpc('contacts_for_workspace', { workspace_uuid: workspaceId });
      if (!error && Array.isArray(data)) {
        contacts = data.map(mapContactRow);
      } else if (error) {
        // Migration not yet applied? Fall back to the user-scoped RPC
        // so the page still works, with the known limitation that it
        // aggregates across all workspaces.
        const { data: fallback } = await supabase
          .rpc('contacts_for_user', { user_uuid: user.id });
        if (Array.isArray(fallback)) contacts = fallback.map(mapContactRow);
      }
    } catch { /* RPC not deployed yet — render zeros */ }
  }

  return <ContactsView contacts={contacts} />;
}

function mapContactRow(c) {
  return {
    recipientIgId:    c.recipient_ig_id,
    username:         c.username || null,
    firstName:        c.first_name || null,
    interactions:     Number(c.interactions || 0),
    lastActive:       c.last_active || null,
    automationCount:  Number(c.automation_count || 0),
    automationNames:  c.automation_names || '',
    email:            c.email || null,
  };
}
