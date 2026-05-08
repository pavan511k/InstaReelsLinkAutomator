'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    Globe, Save, Plus, Trash2, ToggleLeft, ToggleRight, Loader2,
    Lock, Sparkles, Instagram, Facebook,
} from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import Select from '@/components/ui/Select';
import { isProOrTrial } from '@/lib/plans';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';

const EMPTY_FORM = {
    name: '', triggerType: 'keywords', keywords: [], message: '',
    sendOncePerUser: true, skipIfPostHasAutomation: true,
    accountId: '',
};

const TRIGGER_TYPE_OPTIONS = [
    { value: 'keywords',     label: 'Keywords',     desc: 'Match specific words or phrases' },
    { value: 'all_comments', label: 'All Comments', desc: 'Fire on every new comment' },
];

export default function GlobalAutomationsContent({ connectedAccounts = [], userPlan = 'free' }) {
    const styles = useStyles(darkStyles, lightStyles);
    const { confirm } = useConfirm();
    const activeAccounts = connectedAccounts.filter((a) => a.is_active);
    const firstActiveAccount = activeAccounts[0] || null;
    const isPro = isProOrTrial(userPlan);

    const [globalAutomations, setGlobalAutomations] = useState([]);
    const [globalLoaded, setGlobalLoaded]           = useState(false);
    const [globalLoading, setGlobalLoading]         = useState(false);
    const [showGlobalForm, setShowGlobalForm]       = useState(false);
    const [globalSaving, setGlobalSaving]           = useState(false);
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
        const targetAccountId = globalForm.accountId || firstActiveAccount?.id;
        if (!targetAccountId) { toast.warning('Pick an account'); return; }
        if (!globalForm.name.trim()) { toast.warning('Name is required'); return; }
        if (globalForm.triggerType === 'keywords' && globalForm.keywords.length === 0) {
            toast.warning('Add at least one keyword'); return;
        }
        if (!globalForm.message.trim()) { toast.warning('DM message is required'); return; }
        setGlobalSaving(true);
        try {
            const res = await fetch('/api/global-automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: targetAccountId,
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
                toast.success('Global trigger created');
            } else {
                toast.error(data.error || 'Could not create global trigger');
            }
        } catch (e) {
            toast.error(e.message || 'Could not create global trigger');
        } finally {
            setGlobalSaving(false);
        }
    };

    const handleToggleGlobal = async (id, isActive) => {
        // Optimistic UI: flip immediately so the toggle feels instant.
        // If the server rejects, revert + surface an error toast.
        setGlobalAutomations((prev) => prev.map((g) => g.id === id ? { ...g, is_active: !isActive } : g));
        try {
            const res = await fetch('/api/global-automations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !isActive }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Toggle failed (${res.status})`);
            }
        } catch (err) {
            // Roll back the optimistic flip — server didn't accept it.
            setGlobalAutomations((prev) => prev.map((g) => g.id === id ? { ...g, is_active: isActive } : g));
            toast.error(err.message || 'Could not update trigger');
        }
    };

    const handleDeleteGlobal = async (id) => {
        const ok = await confirm({
            title: 'Delete global trigger?',
            message: 'This trigger will stop firing on new comments. This action cannot be undone.',
            confirmText: 'Delete',
        });
        if (!ok) return;
        // Optimistic delete — UI removes the row immediately. Restore the
        // row on failure so the user isn't left thinking deletion succeeded.
        const removed = globalAutomations.find((g) => g.id === id);
        setGlobalAutomations((prev) => prev.filter((g) => g.id !== id));
        try {
            const res = await fetch(`/api/global-automations?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Delete failed (${res.status})`);
            }
        } catch (err) {
            if (removed) setGlobalAutomations((prev) => [...prev, removed]);
            toast.error(err.message || 'Could not delete trigger');
        }
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

                        {!isPro && (
                            <div className={styles.proUpsellBanner}>
                                <div className={styles.proUpsellIcon}>
                                    <Sparkles size={16} />
                                </div>
                                <div className={styles.proUpsellBody}>
                                    <p className={styles.proUpsellTitle}>Global Triggers is a Pro feature</p>
                                    <p className={styles.proUpsellDesc}>
                                        You can pause or delete existing triggers, but creating new ones requires a Pro plan.
                                    </p>
                                </div>
                                <Link href="/pricing" className={styles.proUpsellBtn}>
                                    Upgrade to Pro
                                </Link>
                            </div>
                        )}

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

                        {!globalLoading && globalAutomations.map((ga) => {
                            const acc = activeAccounts.find((a) => a.id === ga.account_id);
                            const accLabel = acc
                                ? (acc.platform === 'facebook'
                                    ? `Facebook · ${acc.fb_page_name || acc.fb_page_id || ''}`
                                    : `Instagram · @${acc.ig_username || ''}`)
                                : null;
                            return (
                            <div key={ga.id} className={styles.accountCard} style={{ marginBottom: 10 }}>
                                <div className={styles.accountInfo}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <span className={styles.accountName}>{ga.name}</span>
                                        {activeAccounts.length > 1 && accLabel && (
                                            <span className={styles.accountPlatform} style={{ gap: 4, opacity: 0.7 }}>
                                                {acc.platform === 'facebook' ? <Facebook size={11} /> : <Instagram size={11} />}
                                                {accLabel}
                                            </span>
                                        )}
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
                            );
                        })}

                        {showGlobalForm && (
                            <div className={styles.configSection} style={{ marginTop: 16 }}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Trigger name</label>
                                    <input className={styles.formInput} placeholder='E.g. "Info keyword campaign"'
                                        value={globalForm.name}
                                        onChange={(e) => setGlobalForm((f) => ({ ...f, name: e.target.value }))} />
                                </div>
                                {activeAccounts.length > 1 && (
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>Account</label>
                                        <Select
                                            value={globalForm.accountId || firstActiveAccount?.id || ''}
                                            onChange={(value) => setGlobalForm((f) => ({ ...f, accountId: value }))}
                                            options={activeAccounts.map((a) => ({
                                                value: a.id,
                                                label: a.platform === 'facebook'
                                                    ? `Facebook · ${a.fb_page_name || a.fb_page_id || ''}`
                                                    : `Instagram · @${a.ig_username || ''}`,
                                            }))}
                                            aria-label="Account"
                                        />
                                    </div>
                                )}
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Trigger type</label>
                                    <Select
                                        value={globalForm.triggerType}
                                        onChange={(value) => setGlobalForm((f) => ({ ...f, triggerType: value }))}
                                        options={TRIGGER_TYPE_OPTIONS}
                                        aria-label="Trigger type"
                                    />
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
                            isPro ? (
                                <button className={styles.saveBtn} style={{ marginTop: 16 }} onClick={() => setShowGlobalForm(true)}>
                                    <Plus size={14} /> Add global trigger
                                </button>
                            ) : (
                                <button
                                    className={styles.saveBtn}
                                    style={{ marginTop: 16, opacity: 0.5, cursor: 'not-allowed' }}
                                    disabled
                                    title="Upgrade to Pro to create global triggers"
                                >
                                    <Lock size={14} /> Add global trigger
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
