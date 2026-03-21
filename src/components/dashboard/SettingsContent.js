'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
    Instagram, Facebook, LogOut, RefreshCw, Shield,
    Settings, UserCircle, Trash2, AlertTriangle, CheckCircle2,
    Gauge, Save, Bell, Webhook, Mail, Send, AtSign, Download, Users,
    MessageSquarePlus, Globe, Plus, X, ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';
import DisconnectModal from './DisconnectModal';

const TABS = [
    { key: 'permissions',    label: 'Permissions',    icon: Shield            },
    { key: 'configuration',  label: 'Configuration',  icon: Settings          },
    { key: 'global',         label: 'Global Triggers',icon: Globe             },
    { key: 'icebreakers',    label: 'Welcome Openers',icon: MessageSquarePlus },
    { key: 'leads',          label: 'Email Leads',    icon: Users             },
    { key: 'account',        label: 'Account',        icon: UserCircle        },
];

const RATE_LIMIT_OPTIONS = [50, 100, 200, 300, 400];

export default function SettingsContent({ user, connectedAccounts = [] }) {
    const styles = useStyles(darkStyles, lightStyles);
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('permissions');
    const [disconnectingId, setDisconnectingId] = useState(null);
    const [refreshingId, setRefreshingId] = useState(null);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [disconnectTargetId, setDisconnectTargetId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteEmail, setDeleteEmail] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [emailCopied, setEmailCopied] = useState(false);

    const copyEmailToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(user?.email || '');
            setEmailCopied(true);
            setTimeout(() => setEmailCopied(false), 2000);
        } catch {
            // Clipboard API not available
        }
    };
    const [savingConfig, setSavingConfig] = useState(false);
    const [configMessage, setConfigMessage] = useState('');
    const [savingRateLimit, setSavingRateLimit] = useState(false);
    const [rateLimitMessage, setRateLimitMessage] = useState('');

    // Derive active/inactive accounts
    const activeAccounts = connectedAccounts.filter((a) => a.is_active);
    const inactiveAccounts = connectedAccounts.filter((a) => !a.is_active);

    // Rate limit state (from first active account)
    const firstActiveAccount = activeAccounts[0];
    const [rateLimit, setRateLimit] = useState(firstActiveAccount?.rate_limit_per_hour || 200);

    // Alert preferences state
    const [alertEmail,     setAlertEmail]     = useState('');
    const [webhookUrl,     setWebhookUrl]     = useState('');
    const [thresholdPct,   setThresholdPct]   = useState(80);
    const [savingAlerts,   setSavingAlerts]   = useState(false);
    const [alertsMsg,      setAlertsMsg]      = useState('');
    const [testingAlert,   setTestingAlert]   = useState(false);
    const [alertsLoaded,   setAlertsLoaded]   = useState(false);
    const [currentUsage,   setCurrentUsage]   = useState(null); // { count, limit }

    // Default config state
    const defaultCfg = firstActiveAccount?.default_config || {};
    const [defaultConfig, setDefaultConfig] = useState({
        triggerType: defaultCfg.triggerType || 'keywords',
        keywords: defaultCfg.keywords || [],
        excludeKeywords: defaultCfg.excludeKeywords || [],
        defaultMessage: defaultCfg.defaultMessage || '',
        defaultButtonName: defaultCfg.defaultButtonName || '',
        utmTag: defaultCfg.utmTag || '',
    });
    const [keywordInput, setKeywordInput] = useState('');
    const [excludeKeywordInput, setExcludeKeywordInput] = useState('');

    // Story Mention DM state
    const mentionCfg = defaultCfg.mentionDm || {};
    const [mentionEnabled, setMentionEnabled] = useState(mentionCfg.enabled || false);
    const [mentionMessage, setMentionMessage] = useState(
        mentionCfg.message || 'Hey! Thanks for mentioning us 🙌 We saw your story and wanted to reach out!'
    );

    // Email Leads state
    const [leads, setLeads]           = useState([]);
    const [leadsLoading, setLeadsLoading] = useState(false);
    const [leadsLoaded, setLeadsLoaded]   = useState(false);

    // Global Triggers state
    const [globalAutomations, setGlobalAutomations] = useState([]);
    const [globalLoaded, setGlobalLoaded]           = useState(false);
    const [globalLoading, setGlobalLoading]         = useState(false);
    const [showGlobalForm, setShowGlobalForm]       = useState(false);
    const [globalSaving, setGlobalSaving]           = useState(false);
    const [globalMsg, setGlobalMsg]                 = useState('');
    const [globalForm, setGlobalForm] = useState({
        name: '', triggerType: 'keywords', keywords: [], message: '',
        sendOncePerUser: true, skipIfPostHasAutomation: true,
    });
    const [globalKwInput, setGlobalKwInput] = useState('');

    // Ice Breakers state
    const iceBreakerCfg = defaultCfg.iceBreakers || [];
    const [iceBreakers, setIceBreakers] = useState(
        iceBreakerCfg.length > 0 ? iceBreakerCfg
        : [{ title: '', responseMessage: '' }]
    );
    const [ibSaving, setIbSaving]   = useState(false);
    const [ibMsg, setIbMsg]         = useState('');

    // ─── Handlers ────────────────────────────────────────

    const initiateDisconnect = (accountId) => {
        setDisconnectTargetId(accountId);
        setShowDisconnectModal(true);
    };

    const handleDisconnectConfirm = async () => {
        if (!disconnectTargetId) return;
        setShowDisconnectModal(false);
        setDisconnectingId(disconnectTargetId);
        try {
            const res = await fetch('/api/accounts/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: disconnectTargetId }),
            });
            if (res.ok) {
                window.location.reload();
            }
        } catch (err) {
            console.error('Disconnect failed:', err);
        } finally {
            setDisconnectingId(null);
            setDisconnectTargetId(null);
        }
    };

    const handleRefreshConnection = (account) => {
        setRefreshingId(account.id);
        const type = account.platform === 'both' ? 'both' : account.platform;
        window.location.href = `/api/auth/meta/connect?type=${type}`;
    };

    const handleDeleteAccount = async () => {
        if (deleteEmail !== user?.email) {
            setDeleteError('Email does not match. Please type your exact email to confirm.');
            return;
        }

        setIsDeleting(true);
        setDeleteError('');

        try {
            const res = await fetch('/api/accounts/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });

            if (res.ok) {
                // Sign out and redirect to landing page
                window.location.href = '/';
            } else {
                const data = await res.json();
                setDeleteError(data.error || 'Failed to delete account');
            }
        } catch (err) {
            setDeleteError(`Delete failed: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveRateLimit = async () => {
        if (!firstActiveAccount) return;
        setSavingRateLimit(true);
        setRateLimitMessage('');

        try {
            const res = await fetch('/api/accounts/rate-limit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: firstActiveAccount.id, rateLimitPerHour: rateLimit }),
            });

            if (res.ok) {
                setRateLimitMessage('✅ Rate limit saved');
                setTimeout(() => setRateLimitMessage(''), 3000);
            } else {
                setRateLimitMessage('❌ Failed to save');
            }
        } catch {
            setRateLimitMessage('❌ Failed to save');
        } finally {
            setSavingRateLimit(false);
        }
    };

    const handleSaveDefaultConfig = async () => {
        if (!firstActiveAccount) return;
        setSavingConfig(true);
        setConfigMessage('');

        try {
            const res = await fetch('/api/accounts/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: firstActiveAccount.id, config: defaultConfig }),
            });

            if (res.ok) {
                setConfigMessage('✅ Default configuration saved');
                setTimeout(() => setConfigMessage(''), 3000);
            } else {
                setConfigMessage('❌ Failed to save configuration');
            }
        } catch {
            setConfigMessage('❌ Failed to save configuration');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleSaveMentionConfig = async () => {
        if (!firstActiveAccount) return;
        setSavingConfig(true);
        setConfigMessage('');
        try {
            // Merge mentionDm into the existing default_config
            const merged = { ...defaultConfig, mentionDm: { enabled: mentionEnabled, message: mentionMessage } };
            const res = await fetch('/api/accounts/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: firstActiveAccount.id, config: merged }),
            });
            if (res.ok) { setConfigMessage('\u2705 Story mention settings saved'); setTimeout(() => setConfigMessage(''), 3000); }
            else         { setConfigMessage('\u274c Failed to save'); }
        } catch { setConfigMessage('\u274c Failed to save'); }
        finally { setSavingConfig(false); }
    };

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

    const exportLeadsCsv = () => {
        if (!leads.length) return;
        const header = 'email,ig_user_id,captured_at\n';
        const rows   = leads.map((l) => `${l.email},${l.recipient_ig_id},${l.confirmed_at}`).join('\n');
        const blob   = new Blob([header + rows], { type: 'text/csv' });
        const url    = URL.createObjectURL(blob);
        const a      = document.createElement('a'); a.href = url; a.download = 'autodm_email_leads.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    // ── Global Triggers handlers ─────────────────────────────────────────
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
                setGlobalForm({ name: '', triggerType: 'keywords', keywords: [], message: '', sendOncePerUser: true, skipIfPostHasAutomation: true });
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

    // ── Ice Breakers handlers ─────────────────────────────────────────
    const handleSaveIceBreakers = async () => {
        if (!firstActiveAccount) return;
        setIbSaving(true); setIbMsg('');
        try {
            const filled = iceBreakers.filter((ib) => ib.title?.trim() && ib.responseMessage?.trim());
            const res = await fetch('/api/ice-breakers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: firstActiveAccount.id, iceBreakers: filled }),
            });
            const data = await res.json();
            if (res.ok) {
                const msg = data.metaPushSuccess
                    ? `✅ ${data.savedCount} welcome opener${data.savedCount !== 1 ? 's' : ''} saved and pushed to Instagram`
                    : `✅ Saved locally. Meta push failed: ${data.metaError || 'unknown error'}. Will retry automatically.`;
                setIbMsg(msg);
                setTimeout(() => setIbMsg(''), 5000);
            } else {
                setIbMsg(`❌ ${data.error}`);
            }
        } catch (e) { setIbMsg(`❌ ${e.message}`); }
        finally { setIbSaving(false); }
    };

    const handleClearIceBreakers = async () => {
        if (!firstActiveAccount || !confirm('Remove all welcome openers?')) return;
        await fetch(`/api/ice-breakers?accountId=${firstActiveAccount.id}`, { method: 'DELETE' });
        setIceBreakers([{ title: '', responseMessage: '' }]);
        setIbMsg('✅ Welcome openers cleared');
        setTimeout(() => setIbMsg(''), 3000);
    };

    const addKeyword = () => {
        const word = keywordInput.trim();
        if (word && !defaultConfig.keywords.includes(word)) {
            setDefaultConfig({ ...defaultConfig, keywords: [...defaultConfig.keywords, word] });
        }
        setKeywordInput('');
    };

    const removeKeyword = (keyword) => {
        setDefaultConfig({ ...defaultConfig, keywords: defaultConfig.keywords.filter((k) => k !== keyword) });
    };

    const addExcludeKeyword = () => {
        const word = excludeKeywordInput.trim();
        if (word && !defaultConfig.excludeKeywords.includes(word)) {
            setDefaultConfig({ ...defaultConfig, excludeKeywords: [...defaultConfig.excludeKeywords, word] });
        }
        setExcludeKeywordInput('');
    };

    const removeExcludeKeyword = (keyword) => {
        setDefaultConfig({ ...defaultConfig, excludeKeywords: defaultConfig.excludeKeywords.filter((k) => k !== keyword) });
    };

    const getPlatformIcon = (platform) => {
        if (platform === 'instagram') return <Instagram size={18} />;
        if (platform === 'facebook') return <Facebook size={18} />;
        return <Instagram size={18} />;
    };

    const getPlatformLabel = (platform) => {
        if (platform === 'instagram') return 'Instagram';
        if (platform === 'facebook') return 'Facebook';
        if (platform === 'both') return 'Meta (Instagram + Facebook)';
        return platform;
    };

    // ── Alert handlers ─────────────────────────────────────
    const loadAlerts = async () => {
        if (alertsLoaded) return;
        try {
            // Load preferences
            const res = await fetch('/api/alerts');
            const data = await res.json();
            if (res.ok) {
                setAlertEmail(data.alertEmail || '');
                setWebhookUrl(data.webhookUrl || '');
                setThresholdPct(data.thresholdPct ?? 80);
            }
            // Load current month usage
            const usageRes = await fetch('/api/usage');
            const usageData = await usageRes.json();
            if (usageRes.ok) setCurrentUsage(usageData);
        } catch { /* non-fatal */ }
        setAlertsLoaded(true);
    };

    const handleSaveAlerts = async () => {
        setSavingAlerts(true); setAlertsMsg('');
        try {
            const res = await fetch('/api/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertEmail, webhookUrl, thresholdPct }),
            });
            if (res.ok) {
                setAlertsMsg('✅ Alert preferences saved');
            } else {
                const d = await res.json();
                setAlertsMsg(`❌ ${d.error || 'Failed to save'}`);
            }
        } catch (e) { setAlertsMsg(`❌ ${e.message}`); }
        finally { setSavingAlerts(false); setTimeout(() => setAlertsMsg(''), 3500); }
    };

    const handleTestAlert = async () => {
        setTestingAlert(true); setAlertsMsg('');
        try {
            const res = await fetch('/api/alerts', { method: 'PUT' });
            const d   = await res.json();
            if (res.ok) {
                const channels = Object.entries(d.results || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
                setAlertsMsg(`✅ Test sent${channels ? ` — ${channels}` : ''}`);
            } else {
                setAlertsMsg(`❌ ${d.error || 'Test failed'}`);
            }
        } catch (e) { setAlertsMsg(`❌ ${e.message}`); }
        finally { setTestingAlert(false); setTimeout(() => setAlertsMsg(''), 5000); }
    };

    // ─── Render Tabs ─────────────────────────────────────

    const renderPermissions = () => (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Connected Accounts</h2>
            <p className={styles.sectionDesc}>Manage your connected social media accounts, refresh permissions, or disconnect.</p>

            {activeAccounts.length === 0 && (
                <div className={styles.emptyState}>
                    <Shield size={32} />
                    <p>No accounts connected. Go to Dashboard to connect your Instagram or Facebook account.</p>
                </div>
            )}

            {activeAccounts.map((account) => (
                <div key={account.id} className={styles.accountCard}>
                    <div className={styles.accountInfo}>
                        <div className={`${styles.accountAvatar} ${styles[`avatar_${account.platform}`]}`}>
                            {account.ig_profile_picture_url ? (
                                <img src={account.ig_profile_picture_url} alt="" />
                            ) : (
                                getPlatformIcon(account.platform)
                            )}
                        </div>
                        <div className={styles.accountDetails}>
                            <span className={styles.accountName}>
                                {account.ig_username
                                    ? `@${account.ig_username}`
                                    : account.fb_page_name || 'Connected Account'}
                            </span>
                            <span className={styles.accountPlatform}>
                                {getPlatformIcon(account.platform)}
                                {getPlatformLabel(account.platform)}
                                <CheckCircle2 size={14} className={styles.connectedIcon} />
                            </span>
                            <span className={styles.accountDate}>
                                Connected {new Date(account.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div className={styles.accountActions}>
                        <button
                            className={styles.refreshBtn}
                            onClick={() => handleRefreshConnection(account)}
                            disabled={refreshingId === account.id}
                        >
                            <RefreshCw size={14} className={refreshingId === account.id ? styles.spinning : ''} />
                            {refreshingId === account.id ? 'Redirecting...' : 'Refresh Connection'}
                        </button>
                        <button
                            className={styles.disconnectBtn}
                            onClick={() => initiateDisconnect(account.id)}
                            disabled={disconnectingId === account.id}
                        >
                            <LogOut size={14} />
                            {disconnectingId === account.id ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    </div>
                </div>
            ))}

            {inactiveAccounts.length > 0 && (
                <>
                    <h3 className={styles.subSectionTitle}>Disconnected Accounts</h3>
                    {inactiveAccounts.map((account) => (
                        <div key={account.id} className={`${styles.accountCard} ${styles.accountCardInactive}`}>
                            <div className={styles.accountInfo}>
                                <div className={`${styles.accountAvatar} ${styles.avatarInactive}`}>
                                    {getPlatformIcon(account.platform)}
                                </div>
                                <div className={styles.accountDetails}>
                                    <span className={styles.accountName}>
                                        Disconnected Account
                                    </span>
                                    <span className={styles.accountPlatformInactive}>
                                        {getPlatformLabel(account.platform)} — Disconnected
                                    </span>
                                </div>
                            </div>
                            <button
                                className={styles.reconnectBtn}
                                onClick={() => handleRefreshConnection(account)}
                            >
                                Reconnect
                            </button>
                        </div>
                    ))}
                </>
            )}
        </div>
    );

    const renderConfiguration = () => (
        <div className={styles.tabContent}>
            {/* Rate Limit Section */}
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}>
                    <Gauge size={20} />
                    AutoDM Rate Limit
                </h2>
                <p className={styles.sectionDesc}>
                    Set the maximum number of DMs sent per hour. Lower values are safer and reduce the risk of being flagged by Instagram/Facebook.
                </p>
                <div className={styles.rateLimitRow}>
                    <select
                        className={styles.rateLimitSelect}
                        value={rateLimit}
                        onChange={(e) => setRateLimit(Number(e.target.value))}
                    >
                        {RATE_LIMIT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt} DMs / hour</option>
                        ))}
                    </select>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSaveRateLimit}
                        disabled={savingRateLimit || !firstActiveAccount}
                    >
                        <Save size={14} />
                        {savingRateLimit ? 'Saving...' : 'Save'}
                    </button>
                    {rateLimitMessage && <span className={styles.saveMsg}>{rateLimitMessage}</span>}
                </div>
                {rateLimit >= 300 && (
                    <div className={styles.rateLimitWarning}>
                        <AlertTriangle size={14} />
                        <span>High rate limits may trigger platform restrictions. Instagram recommends staying under 200/hr.</span>
                    </div>
                )}
            </div>

            {/* Default Configuration Section */}
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}>Default Configuration</h2>
                <p className={styles.sectionDesc}>
                    Set default values for new DM automations. These will be pre-filled when setting up a new post.
                </p>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Default Trigger Type</label>
                    <select
                        className={styles.formInput}
                        value={defaultConfig.triggerType}
                        onChange={(e) => setDefaultConfig({ ...defaultConfig, triggerType: e.target.value })}
                    >
                        <option value="keywords">Keywords</option>
                        <option value="all_comments">All Comments</option>
                        <option value="emojis_only">Emojis Only</option>
                        <option value="mentions_only">@Mentions Only</option>
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Default Keywords</label>
                    <div className={styles.tagsInputWrapper}>
                        <div className={styles.tags}>
                            {defaultConfig.keywords.map((kw) => (
                                <span key={kw} className={styles.tag}>
                                    {kw}
                                    <button className={styles.tagRemove} onClick={() => removeKeyword(kw)}>×</button>
                                </span>
                            ))}
                        </div>
                        <input
                            className={styles.tagInput}
                            placeholder="Type keyword and press Enter"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                        />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Default Exclude Keywords</label>
                    <div className={styles.tagsInputWrapper}>
                        <div className={styles.tags}>
                            {defaultConfig.excludeKeywords.map((kw) => (
                                <span key={kw} className={`${styles.tag} ${styles.tagExclude}`}>
                                    {kw}
                                    <button className={styles.tagRemove} onClick={() => removeExcludeKeyword(kw)}>×</button>
                                </span>
                            ))}
                        </div>
                        <input
                            className={styles.tagInput}
                            placeholder="Type exclude keyword and press Enter"
                            value={excludeKeywordInput}
                            onChange={(e) => setExcludeKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludeKeyword())}
                        />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Default Message</label>
                    <textarea
                        className={styles.formInput}
                        placeholder="E.g., Here's the link you requested!"
                        rows={2}
                        value={defaultConfig.defaultMessage}
                        onChange={(e) => setDefaultConfig({ ...defaultConfig, defaultMessage: e.target.value })}
                    />
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Default Button Name</label>
                        <input
                            className={styles.formInput}
                            placeholder="E.g., Shop Now"
                            value={defaultConfig.defaultButtonName}
                            onChange={(e) => setDefaultConfig({ ...defaultConfig, defaultButtonName: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>UTM Tag</label>
                        <input
                            className={styles.formInput}
                            placeholder="E.g., ?utm_source=autodm"
                            value={defaultConfig.utmTag}
                            onChange={(e) => setDefaultConfig({ ...defaultConfig, utmTag: e.target.value })}
                        />
                    </div>
                </div>

                <div className={styles.configSaveRow}>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSaveDefaultConfig}
                        disabled={savingConfig || !firstActiveAccount}
                    >
                        <Save size={14} />
                        {savingConfig ? 'Saving...' : 'Save configuration'}
                    </button>
                    {configMessage && <span className={styles.saveMsg}>{configMessage}</span>}
                </div>
            </div>

            {/* ── Alerts Section ── */}
            <div className={styles.configSection} onClick={loadAlerts}>
                <h2 className={styles.sectionTitle}>
                    <Bell size={18} />
                    Limit Alerts
                </h2>
                <p className={styles.sectionDesc}>
                    Get notified by email or webhook when your monthly DM usage crosses a threshold.
                    Prevents surprise cutoffs — you&apos;ll know before you hit the wall.
                </p>

                {/* Usage gauge */}
                {currentUsage && (() => {
                    const pct = Math.round((currentUsage.count / currentUsage.limit) * 100);
                    const barColor = pct >= 90 ? '#EF4444' : pct >= 75 ? '#F59E0B' : '#10B981';
                    return (
                        <div className={styles.usageGauge}>
                            <div className={styles.usageGaugeHeader}>
                                <span className={styles.usageGaugeLabel}>This month&apos;s usage</span>
                                <span className={styles.usageGaugePct} style={{ color: barColor }}>
                                    {currentUsage.count.toLocaleString()} / {currentUsage.limit.toLocaleString()} DMs &nbsp;({pct}%)
                                </span>
                            </div>
                            <div className={styles.usageGaugeTrack}>
                                <div
                                    className={styles.usageGaugeFill}
                                    style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
                                />
                                {/* Threshold marker */}
                                <div
                                    className={styles.usageGaugeMarker}
                                    style={{ left: `${thresholdPct}%` }}
                                    title={`Alert at ${thresholdPct}%`}
                                />
                            </div>
                        </div>
                    );
                })()}

                {/* Threshold picker */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Alert threshold</label>
                    <div className={styles.thresholdRow}>
                        {[50, 60, 70, 80, 90, 95].map((pct) => (
                            <button
                                key={pct}
                                className={`${styles.thresholdBtn} ${thresholdPct === pct ? styles.thresholdBtnActive : ''}`}
                                onClick={() => setThresholdPct(pct)}
                            >
                                {pct}%
                            </button>
                        ))}
                    </div>
                    <p className={styles.fieldHint}>
                        You&apos;ll receive an alert once per month when usage crosses this threshold.
                    </p>
                </div>

                {/* Alert email */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}><Mail size={13} /> Alert email</label>
                    <input
                        className={styles.formInput}
                        type="email"
                        placeholder="you@example.com (leave blank to use your account email)"
                        value={alertEmail}
                        onChange={(e) => setAlertEmail(e.target.value)}
                    />
                    <p className={styles.fieldHint}>Leave blank to send to your AutoDM account email.</p>
                </div>

                {/* Webhook URL */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}><Webhook size={13} /> Webhook URL <span className={styles.optionalTag}>optional</span></label>
                    <input
                        className={styles.formInput}
                        type="url"
                        placeholder="https://hooks.slack.com/... or any POST endpoint"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                    <p className={styles.fieldHint}>AutoDM will POST a JSON payload to this URL. Works with Slack, Discord, Zapier, and any custom endpoint.</p>
                </div>

                <div className={styles.alertsSaveRow}>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSaveAlerts}
                        disabled={savingAlerts}
                    >
                        <Save size={14} />
                        {savingAlerts ? 'Saving...' : 'Save alerts'}
                    </button>
                    <button
                        className={styles.testAlertBtn}
                        onClick={handleTestAlert}
                        disabled={testingAlert || (!alertEmail && !webhookUrl)}
                        title={(!alertEmail && !webhookUrl) ? 'Configure at least one alert channel first' : 'Send a test alert now'}
                    >
                        {testingAlert ? (
                            <><RefreshCw size={13} className={styles.spinning} /> Testing…</>
                        ) : (
                            <><Send size={13} /> Test alert</>
                        )}
                    </button>
                    {alertsMsg && <span className={styles.saveMsg}>{alertsMsg}</span>}
                </div>
            </div>

            {/* ── Story Mention Auto-DM ── */}
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}>
                    <AtSign size={18} />
                    Story Mention Auto-DM
                </h2>
                <p className={styles.sectionDesc}>
                    Automatically send a DM to anyone who tags your Instagram account in their Story.
                    Great for building relationships and rewarding fans who share your content.
                </p>

                <label className={styles.checkboxLabel} style={{ marginBottom: 16 }}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={mentionEnabled}
                        onChange={(e) => setMentionEnabled(e.target.checked)}
                    />
                    <div>
                        <span className={styles.checkText}>Enable mention auto-DM</span>
                        <p className={styles.checkDesc}>
                            When enabled, anyone who @mentions your account in their Story will receive this DM automatically.
                        </p>
                    </div>
                </label>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Message</label>
                    <textarea
                        className={styles.formInput}
                        placeholder="Hey! Thanks for mentioning us 🙌 We saw your story and wanted to reach out!"
                        rows={3}
                        value={mentionMessage}
                        onChange={(e) => setMentionMessage(e.target.value)}
                        disabled={!mentionEnabled}
                    />
                    <p className={styles.fieldHint}>
                        Supports {'{username}'} and {'{first_name}'} variables.
                    </p>
                </div>

                <div className={styles.configSaveRow}>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSaveMentionConfig}
                        disabled={savingConfig || !firstActiveAccount}
                    >
                        <Save size={14} />
                        {savingConfig ? 'Saving...' : 'Save mention settings'}
                    </button>
                    {configMessage && <span className={styles.saveMsg}>{configMessage}</span>}
                </div>
            </div>
        </div>
    );

    const renderAccount = () => (
        <div className={styles.tabContent}>
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}>Account Details</h2>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Email</span>
                    <span className={styles.detailValue}>{user?.email || 'N/A'}</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>User ID</span>
                    <span className={styles.detailValueMono}>{user?.id?.substring(0, 8)}...</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Connected Platforms</span>
                    <span className={styles.detailValue}>
                        {activeAccounts.length > 0
                            ? activeAccounts.map((a) => getPlatformLabel(a.platform)).join(', ')
                            : 'None'}
                    </span>
                </div>
            </div>

            <div className={`${styles.configSection} ${styles.dangerSection}`}>
                <h2 className={styles.dangerTitle}>
                    <AlertTriangle size={20} />
                    Danger Zone
                </h2>
                <p className={styles.dangerDesc}>
                    Once you delete your account, there is no going back. This will permanently remove all your data, connected accounts, posts, and automations.
                </p>
                <button
                    className={styles.deleteAccountBtn}
                    onClick={() => setShowDeleteModal(true)}
                >
                    <Trash2 size={14} />
                    Delete Account
                </button>
            </div>

            {/* Delete Account Confirmation Modal — portalled to body so backdrop-filter covers full viewport */}
            {showDeleteModal && createPortal(
                <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalIcon}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className={styles.modalTitle}>Delete your account?</h3>
                        <p className={styles.modalDesc}>
                            This action <strong>cannot be undone</strong>. This will permanently delete your account and remove all associated data including:
                        </p>
                        <ul className={styles.deleteList}>
                            <li>All connected Instagram/Facebook accounts</li>
                            <li>All synced posts and stories</li>
                            <li>All DM automations and analytics</li>
                            <li>Your account and login credentials</li>
                        </ul>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span>Type your email to confirm</span>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontFamily: 'monospace', fontSize: 12,
                                    color: 'rgba(255,255,255,0.72)',
                                    background: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 5, padding: '2px 8px',
                                }}>
                                    <strong style={{ fontFamily: 'monospace', fontWeight: 600 }}>{user?.email}</strong>
                                    <button
                                        onClick={copyEmailToClipboard}
                                        title={emailCopied ? 'Copied!' : 'Copy to clipboard'}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            padding: '1px 3px', borderRadius: 3,
                                            color: emailCopied ? '#10B981' : 'rgba(255,255,255,0.45)',
                                            fontSize: 11, display: 'flex', alignItems: 'center', gap: 3,
                                            transition: 'color 150ms',
                                        }}
                                    >
                                        {emailCopied ? '✓ Copied' : '⧉ Copy'}
                                    </button>
                                </span>
                            </label>
                            <input
                                className={styles.formInput}
                                placeholder="your-email@example.com"
                                value={deleteEmail}
                                onChange={(e) => setDeleteEmail(e.target.value)}
                            />
                        </div>
                        {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteEmail('');
                                    setDeleteError('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.confirmDeleteBtn}
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || deleteEmail !== user?.email}
                            >
                                <Trash2 size={14} />
                                {isDeleting ? 'Deleting...' : 'Delete my account'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );

    const renderLeads = () => {
        if (!firstActiveAccount) return renderNoAccountBanner();
        // Lazy-load leads when tab is first opened
        if (!leadsLoaded && !leadsLoading) loadLeads();

        return (
            <div className={styles.tabContent}>
                <div className={styles.configSection}>
                    <h2 className={styles.sectionTitle}>
                        <Users size={18} />
                        Email Leads
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

                    {!leadsLoading && leads.length === 0 && (
                        <div className={styles.emptyState}>
                            <Mail size={32} />
                            <p>No email leads yet. Set up an <strong>Email Collector</strong> automation on any post to start capturing leads.</p>
                        </div>
                    )}

                    {!leadsLoading && leads.length > 0 && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <span style={{ fontSize: 13, opacity: 0.55 }}>{leads.length} lead{leads.length !== 1 ? 's' : ''} captured</span>
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
        );
    };

    const renderGlobal = () => {
        if (!firstActiveAccount) return renderNoAccountBanner();
        if (!globalLoaded && !globalLoading) loadGlobal();
        const EMPTY_FORM = { name: '', triggerType: 'keywords', keywords: [], message: '', sendOncePerUser: true, skipIfPostHasAutomation: true };
        return (
            <div className={styles.tabContent}>
                <div className={styles.configSection}>
                    <h2 className={styles.sectionTitle}><Globe size={18} /> Global Triggers</h2>
                    <p className={styles.sectionDesc}>
                        Fire a DM when specific keywords appear in comments on <strong>any</strong> of your posts, reels, or stories
                        — without setting up per-post automations. Perfect for account-wide keyword campaigns.
                    </p>

                    {/* Info box */}
                    <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(99,179,237,0.2)', borderRadius: 10, fontSize: 13, marginBottom: 20, lineHeight: 1.6, color: 'rgba(147,210,255,0.9)' }}>
                        💡 <strong>How it works:</strong> Set a keyword like &quot;info&quot; and AutoDM will reply to every comment containing that word
                        across all your content. Enable &quot;Skip if post has own automation&quot; to avoid double DMs.
                    </div>

                    {/* Existing triggers */}
                    {globalLoading && <div className={styles.emptyState}><Loader2 size={24} className={styles.spinning} /><p>Loading…</p></div>}

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
                                        {ga.trigger_config?.type === 'all_comments' ? 'All comments' :
                                            (ga.trigger_config?.keywords || []).join(', ') || 'No keywords'}
                                    </span>
                                    <span className={styles.accountDate}>
                                        {ga.dm_config?.message?.slice(0, 60)}{ga.dm_config?.message?.length > 60 ? '…' : ''}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.accountActions}>
                                <button
                                    className={styles.refreshBtn}
                                    onClick={() => handleToggleGlobal(ga.id, ga.is_active)}
                                >
                                    {ga.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                    {ga.is_active ? 'Active' : 'Paused'}
                                </button>
                                <button className={styles.disconnectBtn} onClick={() => handleDeleteGlobal(ga.id)}>
                                    <Trash2 size={13} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Create form */}
                    {showGlobalForm && (
                        <div className={styles.configSection} style={{ marginTop: 16 }}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Trigger name</label>
                                <input className={styles.formInput} placeholder='E.g. "Info keyword campaign"'
                                    value={globalForm.name} onChange={(e) => setGlobalForm((f) => ({ ...f, name: e.target.value }))} />
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
                                <button className={styles.disconnectBtn} onClick={() => { setShowGlobalForm(false); setGlobalForm(EMPTY_FORM); }}>
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
        );
    };

    const renderIceBreakers = () => {
        if (!firstActiveAccount) return renderNoAccountBanner();
        return (
        <div className={styles.tabContent}>
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}><MessageSquarePlus size={18} /> Welcome Openers</h2>
                <p className={styles.sectionDesc}>
                    Display up to <strong>4 quick-reply buttons</strong> when a user first opens your Instagram inbox.
                    Each button sends an auto-reply DM with your configured message. Perfect for showcasing offers, links, or FAQs.
                </p>

                <div style={{ padding: '12px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, fontSize: 13, marginBottom: 20, lineHeight: 1.6, color: 'rgba(196,181,253,0.9)' }}>
                    💡 These buttons appear inside your DM inbox on Instagram. When a visitor taps one, AutoDM instantly
                    replies with the message you configure here. Requires a Facebook Page connection.
                </div>

                {iceBreakers.map((ib, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                                className={styles.formInput}
                                placeholder={`Button ${i + 1} text (e.g. "What offers are available?")`}
                                maxLength={80}
                                value={ib.title}
                                onChange={(e) => {
                                    const updated = [...iceBreakers];
                                    updated[i] = { ...updated[i], title: e.target.value };
                                    setIceBreakers(updated);
                                }}
                            />
                            <textarea
                                className={styles.formInput}
                                placeholder={`Auto-reply message when tapped (e.g. "Here are our current offers!")`}
                                rows={2}
                                value={ib.responseMessage}
                                onChange={(e) => {
                                    const updated = [...iceBreakers];
                                    updated[i] = { ...updated[i], responseMessage: e.target.value };
                                    setIceBreakers(updated);
                                }}
                            />
                        </div>
                        {iceBreakers.length > 1 && (
                            <button className={styles.disconnectBtn}
                                style={{ padding: '8px 10px', marginTop: 2 }}
                                onClick={() => setIceBreakers(iceBreakers.filter((_, j) => j !== i))}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                ))}

                {iceBreakers.length < 4 && (
                    <button className={styles.refreshBtn} style={{ marginBottom: 20 }}
                        onClick={() => setIceBreakers([...iceBreakers, { title: '', responseMessage: '' }])}>
                        <Plus size={13} /> Add button
                    </button>
                )}

                <div className={styles.configSaveRow}>
                    <button className={styles.saveBtn} onClick={handleSaveIceBreakers} disabled={ibSaving || !firstActiveAccount}>
                        <Save size={14} /> {ibSaving ? 'Saving…' : 'Save & push to Instagram'}
                    </button>
                    <button className={styles.disconnectBtn} onClick={handleClearIceBreakers} disabled={!firstActiveAccount}>
                        <Trash2 size={13} /> Clear all
                    </button>
                </div>
                {ibMsg && <p className={styles.saveMsg} style={{ marginTop: 10 }}>{ibMsg}</p>}
            </div>
        </div>
        );
    };

    // ── No-account banner (shown on tabs that require a connected account) ──
    const renderNoAccountBanner = () => (
        <div className={styles.tabContent}>
            <div className={styles.noAccountBanner}>
                <div className={styles.noAccountIcon}>
                    <Instagram size={28} />
                </div>
                <h3 className={styles.noAccountTitle}>Connect your Instagram account first</h3>
                <p className={styles.noAccountDesc}>
                    This feature requires a connected Instagram or Facebook account.
                    Head to the <strong>Permissions</strong> tab to connect your account, then come back here.
                </p>
                <button
                    className={styles.saveBtn}
                    onClick={() => setActiveTab('permissions')}
                >
                    Go to Permissions
                </button>
            </div>
        </div>
    );

    const renderTab = () => {
        switch (activeTab) {
            case 'permissions':   return renderPermissions();
            case 'configuration': return renderConfiguration();
            case 'global':        return renderGlobal();
            case 'icebreakers':   return renderIceBreakers();
            case 'leads':         return renderLeads();
            case 'account':       return renderAccount();
            default: return null;
        }
    };

    return (
        <>
            <div className={styles.settingsPage}>
                <div className={styles.header}>
                    <h1 className={styles.pageTitle}>Settings</h1>
                </div>

                <div className={styles.container}>
                    <div className={styles.tabs}>
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className={styles.body}>
                        {renderTab()}
                    </div>
                </div>
            </div>

            <DisconnectModal
                isOpen={showDisconnectModal}
                onClose={() => { setShowDisconnectModal(false); setDisconnectTargetId(null); }}
                onConfirm={handleDisconnectConfirm}
                isDisconnecting={disconnectingId !== null}
            />
        </>
    );
}
