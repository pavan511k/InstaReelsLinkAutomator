'use client';

import { useState } from 'react';
import { Users, Mail, RefreshCw, Download } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';

export default function LeadsContent({ connectedAccounts = [] }) {
    const styles = useStyles(darkStyles, lightStyles);
    const firstActiveAccount = connectedAccounts.find((a) => a.is_active) || null;

    const [leads, setLeads]               = useState([]);
    const [leadsLoading, setLeadsLoading] = useState(false);
    const [leadsLoaded, setLeadsLoaded]   = useState(false);

    const loadLeads = async () => {
        if (leadsLoaded) return;
        setLeadsLoading(true);
        try {
            const res  = await fetch('/api/leads');
            const data = await res.json();
            if (res.ok) setLeads(data.leads || []);
        } catch { /* non-fatal */ }
        finally { setLeadsLoading(false); setLeadsLoaded(true); }
    };

    // Kick off load on first render
    if (!leadsLoaded && !leadsLoading) loadLeads();

    const exportLeadsCsv = () => {
        if (!leads.length) return;
        const header = 'email,ig_user_id,captured_at\n';
        const rows   = leads.map((l) => `${l.email},${l.recipient_ig_id},${l.confirmed_at}`).join('\n');
        const blob   = new Blob([header + rows], { type: 'text/csv' });
        const url    = URL.createObjectURL(blob);
        const a      = document.createElement('a');
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

                        {!leadsLoading && leads.length === 0 && leadsLoaded && (
                            <div className={styles.emptyState}>
                                <Mail size={32} />
                                <p>
                                    No email leads yet. Set up an <strong>Email Collector</strong> automation
                                    on any post to start capturing leads.
                                </p>
                            </div>
                        )}

                        {!leadsLoading && leads.length > 0 && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <span style={{ fontSize: 13, opacity: 0.55 }}>
                                        {leads.length} lead{leads.length !== 1 ? 's' : ''} captured
                                    </span>
                                    <button className={styles.saveBtn} onClick={exportLeadsCsv} style={{ gap: 6 }}>
                                        <Download size={13} /> Export CSV
                                    </button>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            <th style={{ textAlign: 'left', padding: '8px 0', opacity: 0.45, fontWeight: 600 }}>Email</th>
                                            <th style={{ textAlign: 'left', padding: '8px 0', opacity: 0.45, fontWeight: 600 }}>IG User</th>
                                            <th style={{ textAlign: 'left', padding: '8px 0', opacity: 0.45, fontWeight: 600 }}>Captured</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leads.map((lead) => (
                                            <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '10px 0', fontFamily: 'monospace', opacity: 0.85 }}>{lead.email}</td>
                                                <td style={{ padding: '10px 0', opacity: 0.55 }}>{lead.recipient_ig_id}</td>
                                                <td style={{ padding: '10px 0', opacity: 0.45 }}>
                                                    {new Date(lead.confirmed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
