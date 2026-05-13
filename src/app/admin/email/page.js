import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import EmailComposer from './EmailComposer';

export const metadata = {
    title: 'Admin · Send email',
    robots: { index: false, follow: false },
};

// Disable static caching so the recent-sends table always reflects
// the latest log. The page is admin-only and rarely hit; no point
// in caching it.
export const dynamic = 'force-dynamic';

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isAllowlisted = (email) =>
    !!email && ALLOWED_EMAILS.includes(email.toLowerCase());

export default async function AdminEmailPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Middleware already gates this, but check on the server as a
    // belt-and-braces guard against a misconfigured matcher.
    if (!user || !isAllowlisted(user.email)) {
        redirect('/dashboard');
    }

    const { data: recent } = await supabase
        .from('admin_email_log')
        .select(
            'id, subject, to_addresses, cc_addresses, bcc_addresses, status, sent_at, error_message',
        )
        .order('sent_at', { ascending: false })
        .limit(20);

    return (
        <div className="relative min-h-screen bg-neutral-50">
            {/* Top bar */}
            <header className="border-b border-neutral-200 bg-white">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-neutral-200">
                            <Image
                                src="/logo.png"
                                alt="AutoDM"
                                width={28}
                                height={28}
                                className="h-7 w-7 object-contain"
                            />
                        </span>
                        <span className="text-sm font-semibold tracking-tight">
                            <span className="text-neutral-900">Auto</span>
                            <span className="text-[#E63946]">DM</span>
                        </span>
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                        </span>
                    </Link>

                    <span className="text-xs text-neutral-500">
                        Signed in as <span className="font-medium text-neutral-700">{user.email}</span>
                    </span>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                        Send email
                    </h1>
                    <p className="mt-1.5 text-sm text-neutral-600">
                        Ad-hoc transactional / announcement emails sent from{' '}
                        <span className="font-medium text-neutral-800">support@autodm.pro</span> via Resend.
                    </p>
                </div>

                <EmailComposer />

                {/* Recent sends */}
                <section className="mt-12">
                    <h2 className="mb-3 text-sm font-semibold text-neutral-800">
                        Recent sends
                    </h2>

                    {!recent || recent.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                            Nothing sent yet.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                            <table className="w-full text-sm">
                                <thead className="border-b border-neutral-200 bg-neutral-50/80 text-xs uppercase tracking-wide text-neutral-500">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                                        <th className="px-4 py-2.5 text-left font-medium">Recipients</th>
                                        <th className="px-4 py-2.5 text-left font-medium">Sent</th>
                                        <th className="px-4 py-2.5 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent.map((row) => (
                                        <LogRow key={row.id} row={row} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

function LogRow({ row }) {
    const totalRecipients =
        (row.to_addresses?.length || 0) +
        (row.cc_addresses?.length || 0) +
        (row.bcc_addresses?.length || 0);
    const firstTo = row.to_addresses?.[0] || '—';
    const sentLabel = new Date(row.sent_at).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <tr className="border-t border-neutral-100 first:border-t-0">
            <td className="px-4 py-3 align-top">
                <div className="line-clamp-1 text-sm font-medium text-neutral-900">
                    {row.subject}
                </div>
            </td>
            <td className="px-4 py-3 align-top">
                <div className="text-sm text-neutral-700">{firstTo}</div>
                {totalRecipients > 1 && (
                    <div className="text-xs text-neutral-500">
                        +{totalRecipients - 1} more
                    </div>
                )}
            </td>
            <td className="px-4 py-3 align-top text-sm text-neutral-600">
                {sentLabel}
            </td>
            <td className="px-4 py-3 align-top">
                {row.status === 'sent' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Sent
                    </span>
                ) : (
                    <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                        title={row.error_message || ''}
                    >
                        <XCircle className="h-3 w-3" />
                        Failed
                    </span>
                )}
            </td>
        </tr>
    );
}
