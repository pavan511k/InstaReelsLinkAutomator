'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Instagram, Facebook, LogOut, RefreshCw, Shield,
    Settings, UserCircle, Trash2, AlertTriangle, CheckCircle2,
    Gauge, Save, Bell, Webhook, Mail, Send, AtSign, Sparkles, Lock,
} from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';
import DisconnectModal from './DisconnectModal';
import Modal from '@/components/ui/Modal';

/* Avatar with fallback + self-healing refresh — Meta's signed IG CDN
   URLs expire. When the <img> fails to load, swap to the fallback icon
   and hit /api/accounts/refresh-profile-pic in the background to pull
   a fresh URL. Fresh URL replaces the stale one in local state so the
   real photo reappears without a page reload. */
function AccountAvatar({ account, fallback }) {
    const [url, setUrl] = useState(account.ig_profile_picture_url || null);
    const [errored, setErrored] = useState(false);
    useEffect(() => {
        setUrl(account.ig_profile_picture_url || null);
        setErrored(false);
    }, [account.ig_profile_picture_url]);

    const handleError = async () => {
        setErrored(true);
        try {
            const res = await fetch('/api/accounts/refresh-profile-pic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: account.id }),
            });
            const data = await res.json();
            if (data?.refreshed && data?.profilePictureUrl && data.profilePictureUrl !== url) {
                setUrl(data.profilePictureUrl);
                setErrored(false);
            }
        } catch { /* non-fatal */ }
    };

    if (url && !errored) {
        return <img src={url} alt="" onError={handleError} />;
    }
    return fallback;
}

const TABS = [
    { key: 'permissions',   label: 'Permissions',   icon: Shield     },
    { key: 'configuration', label: 'Configuration', icon: Settings   },
    { key: 'account',       label: 'Account',       icon: UserCircle },
];

const RATE_LIMIT_OPTIONS = [50, 100, 200, 300, 400];

export default function SettingsContent({ user, connectedAccounts = [], userPlan = 'free' }) {
    const isPro = userPlan === 'pro' || userPlan === 'business' || userPlan === 'trial';
    const styles = useStyles(darkStyles, lightStyles);
    const router = useRouter();
    const [activeTab, setActiveTab]               = useState('permissions');
    const [disconnectingId, setDisconnectingId]   = useState(null);
    const [refreshingId, setRefreshingId]         = useState(null);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [disconnectTargetId, setDisconnectTargetId]   = useState(null);
    const [showDeleteModal, setShowDeleteModal]   = useState(false);
    const [deleteEmail, setDeleteEmail]           = useState('');
    const [isDeleting, setIsDeleting]             = useState(false);
    const [deleteError, setDeleteError]           = useState('');
    const [emailCopied, setEmailCopied]           = useState(false);
    const [savingConfig, setSavingConfig]         = useState(false);
    const [configMessage, setConfigMessage]       = useState('');
    const [savingRateLimitId, setSavingRateLimitId]   = useState(null);
    const [rateLimitMessages, setRateLimitMessages]   = useState({});

    const activeAccounts   = connectedAccounts.filter((a) => a.is_active);
    const inactiveAccounts = connectedAccounts.filter((a) => !a.is_active);
    const firstActiveAccount = activeAccounts[0];

    // Rate limit is per connected account — keyed by account id so users with
    // both IG and FB connected can configure each independently.
    const [rateLimits, setRateLimits] = useState(() =>
        Object.fromEntries(activeAccounts.map((a) => [a.id, a.rate_limit_per_hour || 200]))
    );

    // Alert preferences
    const [alertEmail,   setAlertEmail]   = useState('');
    const [webhookUrl,   setWebhookUrl]   = useState('');
    const [thresholdPct, setThresholdPct] = useState(80);
    const [savingAlerts, setSavingAlerts] = useState(false);
    const [alertsMsg,    setAlertsMsg]    = useState('');
    const [testingAlert, setTestingAlert] = useState(false);
    const [alertsLoaded, setAlertsLoaded] = useState(false);
    const [currentUsage, setCurrentUsage] = useState(null);

    // Default config
    const defaultCfg = firstActiveAccount?.default_config || {};
    const [defaultConfig, setDefaultConfig] = useState({
        triggerType:       defaultCfg.triggerType       || 'keywords',
        keywords:          defaultCfg.keywords          || [],
        excludeKeywords:   defaultCfg.excludeKeywords   || [],
        defaultMessage:    defaultCfg.defaultMessage    || '',
        defaultButtonName: defaultCfg.defaultButtonName || '',
        utmTag:            defaultCfg.utmTag            || '',
    });
    const [keywordInput,        setKeywordInput]        = useState('');
    const [excludeKeywordInput, setExcludeKeywordInput] = useState('');

    // Story Mention DM
    const mentionCfg = defaultCfg.mentionDm || {};
    const [mentionEnabled, setMentionEnabled] = useState(mentionCfg.enabled || false);
    const [mentionMessage, setMentionMessage] = useState(
        mentionCfg.message || 'Hey! Thanks for mentioning us 🙌 We saw your story and wanted to reach out!'
    );

    // ─── Handlers ────────────────────────────────────────────────────────────

    const copyEmailToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(user?.email || '');
            setEmailCopied(true);
            setTimeout(() => setEmailCopied(false), 2000);
        } catch { /* Clipboard API not available */ }
    };

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
            if (res.ok) window.location.reload();
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

    const handleSaveRateLimit = async (accountId) => {
        if (!accountId) return;
        const value = rateLimits[accountId];
        if (typeof value !== 'number') return;
        setSavingRateLimitId(accountId);
        setRateLimitMessages((prev) => ({ ...prev, [accountId]: '' }));
        try {
            const res = await fetch('/api/accounts/rate-limit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, rateLimitPerHour: value }),
            });
            const msg = res.ok ? '✅ Rate limit saved' : '❌ Failed to save';
            setRateLimitMessages((prev) => ({ ...prev, [accountId]: msg }));
            if (res.ok) {
                setTimeout(() => {
                    setRateLimitMessages((prev) => ({ ...prev, [accountId]: '' }));
                }, 3000);
            }
        } catch {
            setRateLimitMessages((prev) => ({ ...prev, [accountId]: '❌ Failed to save' }));
        } finally {
            setSavingRateLimitId(null);
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
            const merged = { ...defaultConfig, mentionDm: { enabled: mentionEnabled, message: mentionMessage } };
            const res = await fetch('/api/accounts/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: firstActiveAccount.id, config: merged }),
            });
            if (res.ok) {
                setConfigMessage('✅ Story mention settings saved');
                setTimeout(() => setConfigMessage(''), 3000);
            } else {
                setConfigMessage('❌ Failed to save');
            }
        } catch {
            setConfigMessage('❌ Failed to save');
        } finally {
            setSavingConfig(false);
        }
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
        if (platform === 'facebook')  return <Facebook size={18} />;
        return <Instagram size={18} />;
    };
    const getPlatformLabel = (platform) => {
        if (platform === 'instagram') return 'Instagram';
        if (platform === 'facebook')  return 'Facebook';
        if (platform === 'both')      return 'Meta (Instagram + Facebook)';
        return platform;
    };

    // ── Alert handlers ────────────────────────────────────────────────────────

    const loadAlerts = async () => {
        if (alertsLoaded) return;
        try {
            const res = await fetch('/api/alerts');
            const data = await res.json();
            if (res.ok) {
                setAlertEmail(data.alertEmail || '');
                setWebhookUrl(data.webhookUrl || '');
                setThresholdPct(data.thresholdPct ?? 80);
            }
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

    // ─── Tab renderers ────────────────────────────────────────────────────────

    const renderPermissions = () => (
        <div className={styles.tabContent}>
            <h2 className={styles.sectionTitle}>Connected Accounts</h2>
            <p className={styles.sectionDesc}>
                Manage your connected social media accounts, refresh permissions, or disconnect.
            </p>

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
                            <AccountAvatar
                                account={account}
                                fallback={getPlatformIcon(account.platform)}
                            />
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
                                    <span className={styles.accountName}>Disconnected Account</span>
                                    <span className={styles.accountPlatformInactive}>
                                        {getPlatformLabel(account.platform)} — Disconnected
                                    </span>
                                </div>
                            </div>
                            <button className={styles.reconnectBtn} onClick={() => handleRefreshConnection(account)}>
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

            {/* Rate Limit — per active connected account */}
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}><Gauge size={20} /> AutoDM Rate Limit</h2>
                <p className={styles.sectionDesc}>
                    Set the maximum number of DMs sent per hour, per connected account. Lower values are safer
                    and reduce the risk of being flagged by Instagram/Facebook.
                </p>
                {activeAccounts.length === 0 ? (
                    <p className={styles.sectionDesc}>Connect an account first to configure rate limits.</p>
                ) : activeAccounts.map((acc) => {
                    const platformLabel = acc.platform === 'facebook' ? 'Facebook' : 'Instagram';
                    const handle        = acc.platform === 'facebook'
                        ? (acc.fb_page_name || acc.fb_page_id || '')
                        : (acc.ig_username || '');
                    const value         = rateLimits[acc.id] ?? (acc.rate_limit_per_hour || 200);
                    const msg           = rateLimitMessages[acc.id];
                    const PlatformIcon  = acc.platform === 'facebook' ? Facebook : Instagram;
                    return (
                        <div key={acc.id} className={styles.rateLimitAccount}>
                            {activeAccounts.length > 1 && (
                                <div className={styles.rateLimitAccountLabel}>
                                    <PlatformIcon size={14} />
                                    <span>{platformLabel}{handle ? ` · ${handle}` : ''}</span>
                                </div>
                            )}
                            <div className={styles.rateLimitRow}>
                                <select className={styles.rateLimitSelect} value={value}
                                    onChange={(e) => setRateLimits((prev) => ({ ...prev, [acc.id]: Number(e.target.value) }))}>
                                    {RATE_LIMIT_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>{opt} DMs / hour</option>
                                    ))}
                                </select>
                                <button className={styles.saveBtn} onClick={() => handleSaveRateLimit(acc.id)}
                                    disabled={savingRateLimitId === acc.id}>
                                    <Save size={14} />
                                    {savingRateLimitId === acc.id ? 'Saving...' : 'Save'}
                                </button>
                                {msg && <span className={styles.saveMsg}>{msg}</span>}
                            </div>
                            {value >= 300 && (
                                <div className={styles.rateLimitWarning}>
                                    <AlertTriangle size={14} />
                                    <span>High rate limits may trigger platform restrictions. Instagram recommends staying under 200/hr.</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Default Configuration */}
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}>Default Configuration</h2>
                <p className={styles.sectionDesc}>
                    Set default values for new DM automations. These will be pre-filled when setting up a new post.
                </p>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Default Trigger Type</label>
                    <select className={styles.formInput} value={defaultConfig.triggerType}
                        onChange={(e) => setDefaultConfig({ ...defaultConfig, triggerType: e.target.value })}>
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
                        <input className={styles.tagInput} placeholder="Type keyword and press Enter"
                            value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())} />
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
                        <input className={styles.tagInput} placeholder="Type exclude keyword and press Enter"
                            value={excludeKeywordInput} onChange={(e) => setExcludeKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludeKeyword())} />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Default Message</label>
                    <textarea className={styles.formInput} placeholder="E.g., Here's the link you requested!"
                        rows={2} value={defaultConfig.defaultMessage}
                        onChange={(e) => setDefaultConfig({ ...defaultConfig, defaultMessage: e.target.value })} />
                </div>
                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Default Button Name</label>
                        <input className={styles.formInput} placeholder="E.g., Shop Now"
                            value={defaultConfig.defaultButtonName}
                            onChange={(e) => setDefaultConfig({ ...defaultConfig, defaultButtonName: e.target.value })} />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>UTM Tag</label>
                        <input className={styles.formInput} placeholder="E.g., ?utm_source=autodm"
                            value={defaultConfig.utmTag}
                            onChange={(e) => setDefaultConfig({ ...defaultConfig, utmTag: e.target.value })} />
                    </div>
                </div>
                <div className={styles.configSaveRow}>
                    <button className={styles.saveBtn} onClick={handleSaveDefaultConfig}
                        disabled={savingConfig || !firstActiveAccount}>
                        <Save size={14} />
                        {savingConfig ? 'Saving...' : 'Save configuration'}
                    </button>
                    {configMessage && <span className={styles.saveMsg}>{configMessage}</span>}
                </div>
            </div>

            {/* Limit Alerts */}
            <div className={styles.configSection} onClick={loadAlerts}>
                <h2 className={styles.sectionTitle}><Bell size={18} /> Limit Alerts</h2>
                <p className={styles.sectionDesc}>
                    {currentUsage?.unlimited
                        ? "You're on an unlimited plan — there's no monthly DM cap. Limit alerts don't apply to your plan."
                        : "Get notified by email or webhook when your monthly DM usage crosses a threshold. Prevents surprise cutoffs — you'll know before you hit the wall."}
                </p>

                {/* Unlimited plan — show a friendly "Pro" indicator instead of the gauge.
                   Free / cap-bearing plans show the gauge + the threshold marker. */}
                {currentUsage?.unlimited ? (
                    <div className={styles.usageGaugeUnlimited}>
                        <span className={styles.usageGaugeUnlimitedBadge}>✨ {currentUsage.plan === 'trial' ? 'Trial' : 'Pro'}</span>
                        <span className={styles.usageGaugeUnlimitedLabel}>
                            <strong>{currentUsage.count.toLocaleString()}</strong> DMs sent this month · unlimited cap
                        </span>
                    </div>
                ) : currentUsage ? (() => {
                    const pct = currentUsage.limit > 0
                        ? Math.round((currentUsage.count / currentUsage.limit) * 100)
                        : 0;
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
                                <div className={styles.usageGaugeFill}
                                    style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                                <div className={styles.usageGaugeMarker}
                                    style={{ left: `${thresholdPct}%` }} title={`Alert at ${thresholdPct}%`} />
                            </div>
                            {pct >= 80 && (
                                <a href="/pricing" className={styles.usageGaugeUpgrade}>
                                    Approaching limit — upgrade to Pro for unlimited DMs →
                                </a>
                            )}
                        </div>
                    );
                })() : null}

                {/* Threshold + email/webhook configuration only applies to capped plans.
                    Unlimited (Pro/Trial/Business) users see no controls — there's no
                    threshold to cross. */}
                {!currentUsage?.unlimited && (
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Alert threshold</label>
                    <div className={styles.thresholdRow}>
                        {[50, 60, 70, 80, 90, 95].map((pct) => (
                            <button key={pct}
                                className={`${styles.thresholdBtn} ${thresholdPct === pct ? styles.thresholdBtnActive : ''}`}
                                onClick={() => setThresholdPct(pct)}>
                                {pct}%
                            </button>
                        ))}
                    </div>
                    <p className={styles.fieldHint}>
                        You&apos;ll receive an alert once per month when usage crosses this threshold.
                    </p>
                </div>
                )}
                {!currentUsage?.unlimited && (<>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}><Mail size={13} /> Alert email</label>
                    <input className={styles.formInput} type="email"
                        placeholder="you@example.com (leave blank to use your account email)"
                        value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
                    <p className={styles.fieldHint}>Leave blank to send to your AutoDM account email.</p>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                        <Webhook size={13} /> Webhook URL
                        <span className={styles.optionalTag}>optional</span>
                    </label>
                    <input className={styles.formInput} type="url"
                        placeholder="https://hooks.slack.com/... or any POST endpoint"
                        value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
                    <p className={styles.fieldHint}>
                        AutoDM will POST a JSON payload to this URL. Works with Slack, Discord, Zapier, and any custom endpoint.
                    </p>
                </div>
                <div className={styles.alertsSaveRow}>
                    <button className={styles.saveBtn} onClick={handleSaveAlerts} disabled={savingAlerts}>
                        <Save size={14} />
                        {savingAlerts ? 'Saving...' : 'Save alerts'}
                    </button>
                    <button className={styles.testAlertBtn} onClick={handleTestAlert}
                        disabled={testingAlert || (!alertEmail && !webhookUrl)}
                        title={(!alertEmail && !webhookUrl) ? 'Configure at least one alert channel first' : 'Send a test alert now'}>
                        {testingAlert
                            ? <><RefreshCw size={13} className={styles.spinning} /> Testing…</>
                            : <><Send size={13} /> Test alert</>}
                    </button>
                    {alertsMsg && <span className={styles.saveMsg}>{alertsMsg}</span>}
                </div>
                </>)}
            </div>

            {/* Story Mention Auto-DM — Pro feature */}
            <div className={styles.configSection}>
                <h2 className={styles.sectionTitle}><AtSign size={18} /> Story Mention Auto-DM</h2>
                <p className={styles.sectionDesc}>
                    Automatically send a DM to anyone who tags your Instagram account in their Story.
                    Great for building relationships and rewarding fans who share your content.
                </p>

                {!isPro && (
                    <div className={styles.proUpsellBanner}>
                        <div className={styles.proUpsellIcon}>
                            <Sparkles size={16} />
                        </div>
                        <div className={styles.proUpsellBody}>
                            <p className={styles.proUpsellTitle}>Story Mention Auto-DM is a Pro feature</p>
                            <p className={styles.proUpsellDesc}>
                                Enable automatic DMs when fans tag your account in their stories. Available on Pro and Trial plans.
                            </p>
                        </div>
                        <Link href="/pricing" className={styles.proUpsellBtn}>
                            Upgrade to Pro
                        </Link>
                    </div>
                )}

                <label className={styles.checkboxLabel} style={{ marginBottom: 16, opacity: isPro ? 1 : 0.5, cursor: isPro ? 'pointer' : 'not-allowed' }}>
                    <input type="checkbox" className={styles.checkbox}
                        checked={isPro && mentionEnabled}
                        disabled={!isPro}
                        onChange={(e) => isPro && setMentionEnabled(e.target.checked)} />
                    <div>
                        <span className={styles.checkText}>Enable mention auto-DM</span>
                        <p className={styles.checkDesc}>
                            When enabled, anyone who @mentions your account in their Story will receive this DM automatically.
                        </p>
                    </div>
                </label>
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Message</label>
                    <textarea className={styles.formInput}
                        placeholder="Hey! Thanks for mentioning us 🙌 We saw your story and wanted to reach out!"
                        rows={3} value={mentionMessage}
                        onChange={(e) => setMentionMessage(e.target.value)}
                        disabled={!isPro || !mentionEnabled} />
                    <p className={styles.fieldHint}>
                        Supports {'{username}'} and {'{first_name}'} variables.
                    </p>
                </div>
                <div className={styles.configSaveRow}>
                    {isPro ? (
                        <button className={styles.saveBtn} onClick={handleSaveMentionConfig}
                            disabled={savingConfig || !firstActiveAccount}>
                            <Save size={14} />
                            {savingConfig ? 'Saving...' : 'Save mention settings'}
                        </button>
                    ) : (
                        <button className={styles.saveBtn} disabled
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                            title="Upgrade to Pro to enable Story Mention Auto-DM">
                            <Lock size={14} /> Save mention settings
                        </button>
                    )}
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
                <h2 className={styles.dangerTitle}><AlertTriangle size={20} /> Danger Zone</h2>
                <p className={styles.dangerDesc}>
                    Once you delete your account, there is no going back. This will permanently remove
                    all your data, connected accounts, posts, and automations.
                </p>
                <button className={styles.deleteAccountBtn} onClick={() => setShowDeleteModal(true)}>
                    <Trash2 size={14} /> Delete Account
                </button>
            </div>

            <Modal
                open={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeleteEmail('');
                    setDeleteError('');
                }}
                size="md"
                closable={!isDeleting}
                ariaLabel="Delete account"
            >
                <div className={styles.modalIcon}><AlertTriangle size={32} /></div>
                <h3 className={styles.modalTitle}>Delete your account?</h3>
                <p className={styles.modalDesc}>
                    This action <strong>cannot be undone</strong>. This will permanently delete your
                    account and remove all associated data including:
                </p>
                <ul className={styles.deleteList}>
                    <li>All connected Instagram/Facebook accounts</li>
                    <li>All synced posts and stories</li>
                    <li>All DM automations and analytics</li>
                    <li>Your account and login credentials</li>
                </ul>
                <div className={styles.formGroup}>
                    <label className={styles.modalFormLabel}>
                        <span>Type your email to confirm</span>
                        <span className={styles.emailPill}>
                            <strong>{user?.email}</strong>
                            <button
                                onClick={copyEmailToClipboard}
                                title={emailCopied ? 'Copied!' : 'Copy to clipboard'}
                                className={`${styles.emailPillCopyBtn} ${emailCopied ? styles.emailPillCopyBtnCopied : ''}`}
                            >
                                {emailCopied ? '✓ Copied' : '⧉ Copy'}
                            </button>
                        </span>
                    </label>
                    <input className={styles.formInput} placeholder="your-email@example.com"
                        value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} />
                </div>
                {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
                <div className={styles.modalActions}>
                    <button className={styles.cancelBtn} onClick={() => {
                        setShowDeleteModal(false);
                        setDeleteEmail('');
                        setDeleteError('');
                    }} disabled={isDeleting}>
                        Cancel
                    </button>
                    <button className={styles.confirmDeleteBtn} onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteEmail !== user?.email}>
                        <Trash2 size={14} />
                        {isDeleting ? 'Deleting...' : 'Delete my account'}
                    </button>
                </div>
            </Modal>
        </div>
    );

    const renderTab = () => {
        switch (activeTab) {
            case 'permissions':   return renderPermissions();
            case 'configuration': return renderConfiguration();
            case 'account':       return renderAccount();
            default:              return null;
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
