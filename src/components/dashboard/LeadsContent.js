'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, Mail, RefreshCw, Download, AlertCircle, Lock } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';

const PAGE_SIZE = 100;

// Defang CSV-formula-injection: prefix any cell starting with =, +, -, @, tab,
// or carriage return with a single quote so spreadsheet apps don't execute it.
// Also wrap in quotes and escape any internal quotes per RFC 4180.
function csvCell(value) {
    if (value == null) return '';
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
}

export default function LeadsContent({ connectedAccounts = [], isPro = false }) {
    const styles = useStyles(darkStyles, lightStyles);
    const firstActiveAccount = connectedAccounts.find((a) => a.is_active) || null;

    const [leads, setLeads]               = useState([]);
    const [total, setTotal]               = useState(0);
    const [offset, setOffset]             = useState(0);
    const [leadsLoading, setLeadsLoading] = useState(false);
    const [error, setError]               = useState(null);

    const loadLeads = useCallback(async (nextOffset = 0) => {
        setLeadsLoading(true);
        setError(null);
        try {
            const res  = await fetch(`/api/leads?limit=${PAGE_SIZE}&offset=${nextOffset}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data?.error || 'Failed to load leads');
                return;
            }
            setLeads(data.leads || []);
            setTotal(data.total || 0);
            setOffset(nextOffset);
        } catch (err) {
            setError(err.message || 'Network error');
        } finally {
            setLeadsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isPro && firstActiveAccount) loadLeads(0);
    }, [isPro, firstActiveAccount, loadLeads]);

    const exportLeadsCsv = () => {
        if (!leads.length) return;
        const header = 'email,ig_user_id,captured_at\n';
        const rows = leads.map((l) =>
            [csvCell(l.email), csvCell(l.recipient_ig_id), csvCell(l.confirmed_at)].join(',')
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'autodm_email_leads.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    if (!firstActiveAccount) {
        return (
            <div className={styles.settingsPage}>
                <div className={styles.header}>
                    <h1 className={styles.pageTitle}>Email Leads</h1>
                </div>
                <div className={styles.tabContent}>
                    <div className={styles.noAccountBanner}>
                        <div className={styles.noAccountIcon}><Users size={28} /></div>
                        <h3 className={styles.noAccountTitle}>Connect your Instagram account first</h3>
                        <p className={styles.noAccountDesc}>
                            Email Leads requires a connected Instagram account.
                            Head to <strong>Settings → Permissions</strong> to connect.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isPro) {
        return (
            <div className={styles.settingsPage}>
                <div className={styles.header}>
                    <h1 className={styles.pageTitle}>Email Leads</h1>
                </div>
                <div className={styles.tabContent}>
                    <div className={styles.noAccountBanner}>
                        <div className={styles.noAccountIcon}><Lock size={28} /></div>
                        <h3 className={styles.noAccountTitle}>Email Leads is a Pro feature</h3>
                        <p className={styles.noAccountDesc}>
                            Capture email addresses from your DM automations and export them as CSV.
                            Available on the Pro plan.
                        </p>
                        <Link href="/pricing" className={styles.saveBtn} style={{ marginTop: 14, display: 'inline-flex', gap: 6 }}>
                            Upgrade to Pro
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const hasNext = offset + leads.length < total;
    const hasPrev = offset > 0;

    return (
        <div className={styles.settingsPage}>
            <div className={styles.header}>
                <h1 className={styles.pageTitle}>Email Leads</h1>
            </div>
            <div className={styles.container} style={{ display: 'block' }}>
                <div className={styles.tabContent}>
                    <div className={styles.configSection}>
                        <h2 className={styles.sectionTitle}>
                            <Users size={18} />
                            Captured Leads
                        </h2>
                        <p className={styles.sectionDesc}>
                            Email addresses captured from your Instagram DM automations using the Email Collector type.
                            Leads are saved automatically when a user replies with their email.
                        </p>

                        {leadsLoading && (
                            <div className={styles.emptyState}>
                                <RefreshCw size={24} className={styles.spinning} />
                                <p>Loading leads…</p>
                            </div>
                        )}

                        {!leadsLoading && error && (
                            <div className={styles.emptyState}>
                                <AlertCircle size={28} />
                                <p style={{ marginBottom: 10 }}>{error}</p>
                                <button className={styles.saveBtn} onClick={() => loadLeads(offset)}>
                                    Try again
                                </button>
                            </div>
                        )}

                        {!leadsLoading && !error && total === 0 && (
                            <div className={styles.emptyState}>
                                <Mail size={32} />
                                <p>
                                    No email leads yet. Set up an <strong>Email Collector</strong> automation
                                    on any post to start capturing leads.
                                </p>
                            </div>
                        )}

                        {!leadsLoading && !error && total > 0 && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                                    <span style={{ fontSize: 13, opacity: 0.55 }}>
                                        {total} lead{total !== 1 ? 's' : ''} captured
                                        {total > leads.length && ` · showing ${offset + 1}–${offset + leads.length}`}
                                    </span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className={styles.saveBtn}
                                            onClick={() => loadLeads(offset)}
                                            title="Refresh"
                                            style={{ gap: 6 }}
                                        >
                                            <RefreshCw size={13} /> Refresh
                                        </button>
                                        <button className={styles.saveBtn} onClick={exportLeadsCsv} style={{ gap: 6 }}>
                                            <Download size={13} /> Export CSV
                                        </button>
                                    </div>
                                </div>

                                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                    <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(120,120,140,0.15)' }}>
                                                <th style={{ textAlign: 'left', padding: '8px 0', opacity: 0.55, fontWeight: 600 }}>Email</th>
                                                <th style={{ textAlign: 'left', padding: '8px 0', opacity: 0.55, fontWeight: 600 }}>IG User</th>
                                                <th style={{ textAlign: 'left', padding: '8px 0', opacity: 0.55, fontWeight: 600 }}>Captured</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leads.map((lead) => (
                                                <tr key={lead.id} style={{ borderBottom: '1px solid rgba(120,120,140,0.08)' }}>
                                                    <td style={{ padding: '10px 0', fontFamily: 'monospace' }}>{lead.email}</td>
                                                    <td style={{ padding: '10px 0', opacity: 0.6 }}>{lead.recipient_ig_id}</td>
                                                    <td style={{ padding: '10px 0', opacity: 0.5, whiteSpace: 'nowrap' }}>
                                                        {new Date(lead.confirmed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {(hasPrev || hasNext) && (
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                                        <button
                                            className={styles.saveBtn}
                                            disabled={!hasPrev}
                                            onClick={() => loadLeads(Math.max(0, offset - PAGE_SIZE))}
                                            style={{ opacity: hasPrev ? 1 : 0.4 }}
                                        >
                                            ← Prev
                                        </button>
                                        <button
                                            className={styles.saveBtn}
                                            disabled={!hasNext}
                                            onClick={() => loadLeads(offset + PAGE_SIZE)}
                                            style={{ opacity: hasNext ? 1 : 0.4 }}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
