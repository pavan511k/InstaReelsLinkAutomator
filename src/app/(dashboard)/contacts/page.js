import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ContactsView from './ContactsView';

/**
 * /contacts — every recipient who has received at least one DM from
 * one of the user's automations. Aggregated server-side via the
 * `contacts_for_user` RPC so we get one round-trip regardless of
 * how many recipients exist. RLS on the underlying tables already
 * scopes by user; the RPC additionally filters by `user_uuid` so
 * a misconfigured RLS policy can't leak across accounts.
 */
export const metadata = {
  title: 'Contacts — AutoDM',
};

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Try the aggregate RPC. If the migration hasn't been applied yet
  // (`add-contacts-rpc.sql`) we fall through with an empty list — the
  // page still renders, just shows the empty state.
  let contacts = [];
  try {
    const { data, error } = await supabase.rpc('contacts_for_user', { user_uuid: user.id });
    if (!error && Array.isArray(data)) {
      contacts = data.map((c) => ({
        recipientIgId:    c.recipient_ig_id,
        username:         c.username || null,
        firstName:        c.first_name || null,
        interactions:     Number(c.interactions || 0),
        lastActive:       c.last_active || null,
        automationCount:  Number(c.automation_count || 0),
        automationNames:  c.automation_names || '',
        email:            c.email || null,
      }));
    }
  } catch { /* RPC not deployed yet — render zeros */ }

  return <ContactsView contacts={contacts} />;
}
