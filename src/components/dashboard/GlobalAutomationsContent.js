'use client';

import { useState } from 'react';
import {
    Globe, Save, Plus, Trash2, ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';

const EMPTY_FORM = {
    name: '', triggerType: 'keywords', keywords: [], message: '',
    sendOncePerUser: true, skipIfPostHasAutomation: true,
};

export default function GlobalAutomationsContent({ connectedAccounts = [] }) {
    const styles = useStyles(darkStyles, lightStyles);
    const firstActiveAccount = connectedAccounts.find((a) => a.is_active) || null;

    const [globalAutomations, setGlobalAutomations] = useState([]);
    const [globalLoaded, setGlobalLoaded]           = useState(false);
    const [globalLoading, setGlobalLoading]         = useState(false);
    const [showGlobalForm, setShowGlobalForm]       = useState(false);
    const [globalSaving, setGlobalSaving]           = useState(false);
    const [globalMsg, setGlobalMsg]                 = useState('');
    const [globalForm, setGlobalForm]               = useState({ ...EMPTY_FORM });
    const [globalKwInput, setGlobalKwInput]         = useState('');

    const loadGlobal = async () => {
        if (globalLoaded) return;
        setGlobalLoading(true);
        try {
            const res  = await fetch('/api/global-automations');
            const data = await res.json();
            if (res.ok) setGlobalAutomations(data.automations || []);
        } catch { /* non-fatal */ }
        finally { setGlobalLoading(false); setGlobalLoaded(true); }
    };

    if (!globalLoaded && !globalLoading) loadGlobal();

    const handleCreateGlobal = async () => {
        if (!firstActiveAccount) return;
        if (!globalForm.name.trim()) { setGlobalMsg('❌ Name is required'); return; }
        if (globalForm.triggerType === 'keywords' && globalForm.keywords.length === 0) {
            setGlobalMsg('❌ Add at least one keyword'); return;
        }
        if (!globalForm.message.trim()) { setGlobalMsg('❌ DM message is required'); return; }
        setGlobalSaving(true); setGlobalMsg('');
        try {
            const res = await fetch('/api/global-automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: firstActiveAccount.id,
                    name: globalForm.name,
                    dmType: 'message_template',
                    dmConfig: { message: globalForm.message },
                    triggerConfig: { type: globalForm.triggerType, keywords: globalForm.keywords },
                    sendOncePerUser: globalForm.sendOncePerUser,
                    skipIfPostHasAutomation: globalForm.skipIfPostHasAutomation,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setGlobalAutomations((prev) => [...prev, data.automation]);
                setGlobalForm({ ...EMPTY_FORM });
                setShowGlobalForm(false);
                setGlobalMsg('✅ Global trigger created');
                setTimeout(() => setGlobalMsg(''), 3000);
            } else {
                setGlobalMsg(`❌ ${data.error}`);
            }
        } catch (e) { setGlobalMsg(`❌ ${e.message}`); }
        finally { setGlobalSaving(false); }
    };

    const handleToggleGlobal = async (id, isActive) => {
        await fetch('/api/global-automations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, isActive: !isActive }),
        });
        setGlobalAutomations((prev) => prev.map((g) => g.id === id ? { ...g, is_active: !isActive } : g));
    };

    const handleDeleteGlobal = async (id) => {
        if (!confirm('Delete this global trigger?')) return;
        await fetch(`/api/global-automations?id=${id}`, { method: 'DELETE' });
        setGlobalAutomations((prev) => prev.filter((g) => g.id !== id));
    };

    if (!firstActiveAccount) {
        return (
            <div className={styles.settingsPage}>
                <div className={styles.header}>
                    <h1 className={styles.pageTitle}>Global Triggers</h1>
                </div>
                <div className={styles.tabContent}>
                    <div className={styles.noAccountBanner}>
                        <div className={styles.noAccountIcon}><Globe size={28} /></div>
                        <h3 className={styles.noAccountTitle}>Connect your Instagram account first</h3>
                        <p className={styles.noAccountDesc}>
                            Global Triggers requires a connected account.
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
                <h1 className={styles.pageTitle}>Global Triggers</h1>
            </div>
            <div className={styles.container} style={{ display: 'block' }}>
                <div className={styles.tabContent}>
                    <div className={styles.configSection}>
                        <h2 className={styles.sectionTitle}><Globe size={18} /> Global Triggers</h2>
                        <p className={styles.sectionDesc}>
                            Fire a DM when specific keywords appear in comments on <strong>any</strong> of your
                            posts, reels, or stories — without setting up per-post automations. Perfect for
                            account-wide keyword campaigns.
                        </p>

                        <div className={styles.infoBox}>
                            💡 <strong>How it works:</strong> Set a keyword like &quot;info&quot; and AutoDM will reply to every
                            comment containing that word across all your content. Enable &quot;Skip if post has own
                            automation&quot; to avoid double DMs.
                        </div>

                        {globalLoading && (
                            <div className={styles.emptyState}>
                                <Loader2 size={24} className={styles.spinning} />
                                <p>Loading…</p>
                            </div>
                        )}

                        {!globalLoading && globalAutomations.length === 0 && !showGlobalForm && (
                            <div className={styles.emptyState}>
                                <Globe size={32} />
                                <p>No global triggers yet. Create your first one below.</p>
                            </div>
                        )}

                        {!globalLoading && globalAutomations.map((ga) => (
                            <div key={ga.id} className={styles.accountCard} style={{ marginBottom: 10 }}>
                                <div className={styles.accountInfo}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <span className={styles.accountName}>{ga.name}</span>
                                        <span className={styles.accountPlatform} style={{ gap: 6 }}>
                                            {ga.trigger_config?.type === 'all_comments'
                                                ? 'All comments'
                                                : (ga.trigger_config?.keywords || []).join(', ') || 'No keywords'}
                                        </span>
                                        <span className={styles.accountDate}>
                                            {ga.dm_config?.message?.slice(0, 60)}{ga.dm_config?.message?.length > 60 ? '…' : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.accountActions}>
                                    <button className={styles.refreshBtn} onClick={() => handleToggleGlobal(ga.id, ga.is_active)}>
                                        {ga.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                        {ga.is_active ? 'Active' : 'Paused'}
                                    </button>
                                    <button className={styles.disconnectBtn} onClick={() => handleDeleteGlobal(ga.id)}>
                                        <Trash2 size={13} /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}

                        {showGlobalForm && (
                            <div className={styles.configSection} style={{ marginTop: 16 }}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Trigger name</label>
                                    <input className={styles.formInput} placeholder='E.g. "Info keyword campaign"'
                                        value={globalForm.name}
                                        onChange={(e) => setGlobalForm((f) => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Trigger type</label>
                                    <select className={styles.formInput} value={globalForm.triggerType}
                                        onChange={(e) => setGlobalForm((f) => ({ ...f, triggerType: e.target.value }))}>
                                        <option value='keywords'>Keywords</option>
                                        <option value='all_comments'>All Comments</option>
                                    </select>
                                </div>
                                {globalForm.triggerType === 'keywords' && (
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Keywords</label>
                                        <div className={styles.tagsInputWrapper}>
                                            <div className={styles.tags}>
                                                {globalForm.keywords.map((kw) => (
                                                    <span key={kw} className={styles.tag}>
                                                        {kw}
                                                        <button className={styles.tagRemove}
                                                            onClick={() => setGlobalForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }))}>×</button>
                                                    </span>
                                                ))}
                                            </div>
                                            <input className={styles.tagInput} placeholder='Type keyword and press Enter'
                                                value={globalKwInput}
                                                onChange={(e) => setGlobalKwInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const w = globalKwInput.trim();
                                                        if (w && !globalForm.keywords.includes(w)) {
                                                            setGlobalForm((f) => ({ ...f, keywords: [...f.keywords, w] }));
                                                        }
                                                        setGlobalKwInput('');
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>DM message</label>
                                    <textarea className={styles.formInput} rows={3}
                                        placeholder="Hey {first_name}! Here's the info you asked for 👇"
                                        value={globalForm.message}
                                        onChange={(e) => setGlobalForm((f) => ({ ...f, message: e.target.value }))} />
                                    <p className={styles.fieldHint}>Supports {'{first_name}'} and {'{username}'}.</p>
                                </div>
                                <label className={styles.checkboxLabel}>
                                    <input type='checkbox' className={styles.checkbox}
                                        checked={globalForm.sendOncePerUser}
                                        onChange={(e) => setGlobalForm((f) => ({ ...f, sendOncePerUser: e.target.checked }))} />
                                    <div>
                                        <span className={styles.checkText}>Send once per user</span>
                                        <p className={styles.checkDesc}>Don&apos;t DM the same person twice across all their comments.</p>
                                    </div>
                                </label>
                                <label className={styles.checkboxLabel} style={{ marginTop: 8 }}>
                                    <input type='checkbox' className={styles.checkbox}
                                        checked={globalForm.skipIfPostHasAutomation}
                                        onChange={(e) => setGlobalForm((f) => ({ ...f, skipIfPostHasAutomation: e.target.checked }))} />
                                    <div>
                                        <span className={styles.checkText}>Skip if post has its own automation</span>
                                        <p className={styles.checkDesc}>Avoids double DMs when a post already has a specific automation configured.</p>
                                    </div>
                                </label>
                                <div className={styles.configSaveRow} style={{ marginTop: 14 }}>
                                    <button className={styles.saveBtn} onClick={handleCreateGlobal} disabled={globalSaving}>
                                        <Save size={14} /> {globalSaving ? 'Saving…' : 'Create trigger'}
                                    </button>
                                    <button className={styles.disconnectBtn}
                                        onClick={() => { setShowGlobalForm(false); setGlobalForm({ ...EMPTY_FORM }); }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {!showGlobalForm && (
                            <button className={styles.saveBtn} style={{ marginTop: 16 }} onClick={() => setShowGlobalForm(true)}>
                                <Plus size={14} /> Add global trigger
                            </button>
                        )}
                        {globalMsg && <p className={styles.saveMsg} style={{ marginTop: 10 }}>{globalMsg}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
