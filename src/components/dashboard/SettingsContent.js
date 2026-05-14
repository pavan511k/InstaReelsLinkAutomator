'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Instagram, Facebook, LogOut, RefreshCw, Shield, Settings as SettingsIcon, UserCircle, Trash2,
  AlertTriangle, CheckCircle2, Save, Bell, Webhook, Mail, Send, CreditCard, Crown, Sparkles,
  Loader2, Copy as CopyIcon,
} from 'lucide-react';
import DisconnectModal from './DisconnectModal';
import PricingModal from './PricingModal';
import Modal from '@/components/ui/Modal';

const THRESHOLD_OPTIONS = [50, 60, 70, 80, 90, 95];

/* Avatar with fallback + self-healing refresh — Meta's signed IG CDN URLs
   expire. When the <img> fails to load, swap to the fallback icon and hit
   /api/accounts/refresh-profile-pic to pull a fresh URL. */
function AccountAvatar({ account, fallback, className = '' }) {
  const [url, setUrl]         = useState(account.ig_profile_picture_url || null);
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
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={url} alt="" onError={handleError} className={className} />;
  }
  return fallback;
}

/* Card container — used by every settings section. Header sits inside so
   the icon + title + optional right-side accessory line up consistently. */
function SectionCard({ icon: Icon, iconClass = 'text-neutral-500', title, subtitle, accessory = null, children }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
            {Icon && <Icon className={['h-4 w-4', iconClass].join(' ')} strokeWidth={2.5} />}
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
        </div>
        {accessory && <div className="flex-shrink-0">{accessory}</div>}
      </header>
      {children}
    </section>
  );
}

/* Tag chip for keyword input */
function TagChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm opacity-60 hover:opacity-100"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}

/* Plan label + dot color for the Billing & Plan accessory pill */
function planBadgeMeta(plan) {
  if (plan === 'pro' || plan === 'business') return { label: 'Pro Plan',   tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
  if (plan === 'trial')                       return { label: 'Trial',      tone: 'border-amber-200 bg-amber-50 text-amber-700',         dot: 'bg-amber-500' };
  return                                            { label: 'Free Plan',  tone: 'border-neutral-200 bg-neutral-100 text-neutral-700',  dot: 'bg-neutral-400' };
}

export default function SettingsContent({ user, connectedAccounts = [] }) {
  const [disconnectingId, setDisconnectingId]           = useState(null);
  const [refreshingId, setRefreshingId]                 = useState(null);
  const [showDisconnectModal, setShowDisconnectModal]   = useState(false);
  const [disconnectTargetId, setDisconnectTargetId]     = useState(null);
  const [showDeleteModal, setShowDeleteModal]           = useState(false);
  const [showPricingModal, setShowPricingModal]         = useState(false);
  const [deleteEmail, setDeleteEmail]                   = useState('');
  const [isDeleting, setIsDeleting]                     = useState(false);
  const [deleteError, setDeleteError]                   = useState('');
  const [emailCopied, setEmailCopied]                   = useState(false);
  const [savingConfig, setSavingConfig]                 = useState(false);

  const activeAccounts     = connectedAccounts.filter((a) => a.is_active);
  const inactiveAccounts   = connectedAccounts.filter((a) => !a.is_active);
  const firstActiveAccount = activeAccounts[0];

  // Alert preferences + plan/usage (loaded on mount since there are no tabs)
  const [alertEmail,    setAlertEmail]    = useState('');
  const [webhookUrl,    setWebhookUrl]    = useState('');
  const [thresholdPct,  setThresholdPct]  = useState(80);
  const [savingAlerts,  setSavingAlerts]  = useState(false);
  const [alertsMsg,     setAlertsMsg]     = useState('');
  const [testingAlert,  setTestingAlert]  = useState(false);
  const [alertsLoaded,  setAlertsLoaded]  = useState(false);
  const [currentUsage,  setCurrentUsage]  = useState(null);

  // Default config — applied to new automations as starting values.
  // We keep `triggerType`, `excludeKeywords`, and `utmTag` in the saved
  // payload (preserving existing values) but no longer expose them in
  // the UI. `default_config` is also read elsewhere so dropping the
  // keys here would silently wipe them on next save.
  const defaultCfg = firstActiveAccount?.default_config || {};
  const [defaultConfig, setDefaultConfig] = useState({
    triggerType:       defaultCfg.triggerType       || 'keywords',
    keywords:          defaultCfg.keywords          || [],
    excludeKeywords:   defaultCfg.excludeKeywords   || [],
    defaultMessage:    defaultCfg.defaultMessage    || '',
    defaultButtonName: defaultCfg.defaultButtonName || '',
    utmTag:            defaultCfg.utmTag            || '',
  });
  const [keywordInput, setKeywordInput] = useState('');

  // ─── Handlers ──────────────────────────────────────────────────────────

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
    // 'both' is a retired platform value (combined IG + FB connection is no
    // longer offered for new connections). For legacy rows that still have
    // platform='both', map the reconnect to Instagram — the primary platform.
    // The user can disconnect afterwards and connect Facebook instead if
    // that's what they actually want.
    const type = account.platform === 'both' ? 'instagram' : account.platform;
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

  const handleSaveDefaultConfig = async () => {
    if (!firstActiveAccount) return;
    setSavingConfig(true);
    const tId = toast.loading('Saving configuration…');
    try {
      const res = await fetch('/api/accounts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: firstActiveAccount.id, config: defaultConfig }),
      });
      if (res.ok) {
        toast.success('Default configuration saved', { id: tId });
      } else {
        toast.error('Failed to save configuration', { id: tId });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save configuration', { id: tId });
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

  const getPlatformIcon = (platform, size = 18) => {
    if (platform === 'facebook') return <Facebook size={size} />;
    return <Instagram size={size} />;
  };
  const getPlatformLabel = (platform) => {
    if (platform === 'instagram') return 'Instagram';
    if (platform === 'facebook')  return 'Facebook';
    if (platform === 'both')      return 'Meta (Instagram + Facebook)';
    return platform;
  };

  // Load alerts + usage on mount (the page used to gate this on tab
  // switching, but with the single-page layout we just want it available
  // for the Limit Alerts section + the Billing & Plan summary).
  const loadAlerts = useCallback(async () => {
    if (alertsLoaded) return;
    try {
      const res  = await fetch('/api/alerts');
      const data = await res.json();
      if (res.ok) {
        setAlertEmail(data.alertEmail || '');
        setWebhookUrl(data.webhookUrl || '');
        setThresholdPct(data.thresholdPct ?? 80);
      }
      const usageRes  = await fetch('/api/usage');
      const usageData = await usageRes.json();
      if (usageRes.ok) setCurrentUsage(usageData);
    } catch { /* non-fatal */ }
    setAlertsLoaded(true);
  }, [alertsLoaded]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

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

  // ── Derived UI helpers ────────────────────────────────────────────────
  const planMeta = planBadgeMeta(currentUsage?.plan || 'free');
  const planExpiresStr = currentUsage?.planExpiresAt
    ? new Date(currentUsage.planExpiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const usagePct = currentUsage && currentUsage.limit > 0
    ? Math.round((currentUsage.count / currentUsage.limit) * 100)
    : 0;
  const usageColor = usagePct >= 90 ? 'bg-red-500' : usagePct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
  const usageText  = usagePct >= 90 ? 'text-red-600' : usagePct >= 75 ? 'text-amber-600' : 'text-emerald-600';

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Manage permissions, defaults, billing, and your account.
          </p>
        </div>
        {firstActiveAccount?.ig_username && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
            Workspace: <span className="font-mono text-[#E63946]">@{firstActiveAccount.ig_username}</span>
          </span>
        )}
      </div>

      {/* ── Connected Accounts ────────────────────────────────────────── */}
      <SectionCard
        icon={Instagram}
        iconClass="text-[#E63946]"
        title="Connected Accounts"
        subtitle="Manage your connected Instagram or Facebook account, refresh permissions, or disconnect."
      >
        {activeAccounts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-10 text-center">
            <Shield className="h-7 w-7 text-neutral-400" strokeWidth={2} />
            <p className="mt-3 text-sm text-neutral-600">
              No accounts connected. Go to the Dashboard to connect your Instagram or Facebook account.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {activeAccounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={[
                  'inline-flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-white shadow-sm',
                  account.platform === 'facebook'
                    ? 'bg-blue-600'
                    : 'bg-gradient-to-br from-pink-500 via-orange-400 to-amber-300',
                ].join(' ')}>
                  <AccountAvatar
                    account={account}
                    fallback={getPlatformIcon(account.platform, 18)}
                    className="h-full w-full object-cover"
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">
                    {account.ig_username
                      ? `@${account.ig_username}`
                      : account.fb_page_name || 'Connected Account'}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-600">
                    {getPlatformIcon(account.platform, 12)}
                    {getPlatformLabel(account.platform)}
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" strokeWidth={2.5} />
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    Connected {new Date(account.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleRefreshConnection(account)}
                  disabled={refreshingId === account.id}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors sm:flex-none"
                >
                  <RefreshCw className={['h-3.5 w-3.5', refreshingId === account.id ? 'animate-spin' : ''].join(' ')} strokeWidth={2.5} />
                  {refreshingId === account.id ? 'Redirecting…' : 'Reconnect'}
                </button>
                <button
                  type="button"
                  onClick={() => initiateDisconnect(account.id)}
                  disabled={disconnectingId === account.id}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 transition-colors sm:flex-none"
                >
                  <LogOut className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {disconnectingId === account.id ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {inactiveAccounts.length > 0 && (
          <>
            <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Disconnected</h3>
            <div className="space-y-3">
              {inactiveAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col items-start gap-4 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
                      {getPlatformIcon(account.platform, 18)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-neutral-700">Disconnected Account</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {getPlatformLabel(account.platform)} — Disconnected
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRefreshConnection(account)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black transition-colors"
                  >
                    Reconnect
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Default Configuration ─────────────────────────────────────── */}
      <SectionCard
        icon={SettingsIcon}
        title="Default Configuration"
        subtitle="Pre-fill these values when setting up new DM automations."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">Default keywords</label>
            <div className="mt-1.5 rounded-lg border border-neutral-200 bg-white p-2">
              <div className="mb-1 flex flex-wrap gap-1.5">
                {defaultConfig.keywords.map((kw) => (
                  <TagChip key={kw} label={kw} onRemove={() => removeKeyword(kw)} />
                ))}
              </div>
              <input
                type="text"
                placeholder="Type keyword and press Enter"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                className="block w-full bg-transparent px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Default message</label>
            <textarea
              rows={2}
              placeholder="E.g., Here's the link you requested!"
              value={defaultConfig.defaultMessage}
              onChange={(e) => setDefaultConfig({ ...defaultConfig, defaultMessage: e.target.value })}
              className="mt-1.5 block w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Default button name</label>
            <input
              type="text"
              placeholder="E.g., Shop Now"
              value={defaultConfig.defaultButtonName}
              onChange={(e) => setDefaultConfig({ ...defaultConfig, defaultButtonName: e.target.value })}
              className="mt-1.5 block h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors sm:max-w-xs"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={handleSaveDefaultConfig}
            disabled={savingConfig || !firstActiveAccount}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {savingConfig
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {savingConfig ? 'Saving…' : 'Save configuration'}
          </button>
        </div>
      </SectionCard>

      {/* ── Billing & Plan ────────────────────────────────────────────── */}
      <SectionCard
        icon={CreditCard}
        iconClass="text-emerald-600"
        title="Billing & Plan"
        subtitle="Manage your subscription and billing details."
        accessory={
          <span className={['inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', planMeta.tone].join(' ')}>
            <span className={['inline-block h-1.5 w-1.5 rounded-full', planMeta.dot].join(' ')} />
            {planMeta.label}
          </span>
        }
      >
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                Subscription
                <span className="rounded bg-neutral-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                  {currentUsage?.plan === 'pro' || currentUsage?.plan === 'business'
                    ? 'Active'
                    : currentUsage?.plan === 'trial' ? 'Trial' : 'No subscription'}
                </span>
              </span>
              <p className="text-xs text-neutral-600">
                Billing cycle: {currentUsage?.plan === 'pro' || currentUsage?.plan === 'business' ? 'One-time per period' : '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPricingModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black transition-colors"
            >
              <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
              {currentUsage?.unlimited ? 'Manage Plan' : 'Upgrade Plan'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Auto-pay</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">—</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">Cashfree one-payment per period.</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Expires</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{planExpiresStr}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {currentUsage?.planExpiresAt ? 'Period end date.' : 'No paid period active.'}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Plan access</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{planMeta.label}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {currentUsage?.unlimited
                ? 'Email Collector, Story Mention, Ask-to-Follow + more.'
                : 'Upgrade for Email Collector, Story Mention & more.'}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── Limit Alerts ──────────────────────────────────────────────── */}
      <SectionCard
        icon={Bell}
        title="Limit Alerts"
        subtitle={
          currentUsage?.unlimited
            ? "You're on an unlimited plan — there's no monthly DM cap. Limit alerts don't apply to your plan."
            : "Get notified by email or webhook when monthly DM usage crosses a threshold. Prevents surprise cutoffs — you'll know before you hit the wall."
        }
      >
        {/* Unlimited */}
        {currentUsage?.unlimited && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-900">
                {currentUsage.plan === 'trial' ? 'Trial' : 'Pro'} — Unlimited DMs
              </p>
              <p className="mt-0.5 text-xs text-emerald-800/80">
                <strong>{currentUsage.count.toLocaleString()}</strong> DMs sent this month · no cap
              </p>
            </div>
          </div>
        )}

        {/* Capped — usage gauge */}
        {currentUsage && !currentUsage.unlimited && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                This month&apos;s usage
              </span>
              <span className={['text-xs font-semibold', usageText].join(' ')}>
                {currentUsage.count.toLocaleString()} / {currentUsage.limit.toLocaleString()} ({usagePct}%)
              </span>
            </div>
            <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={['absolute inset-y-0 left-0 rounded-full transition-all', usageColor].join(' ')}
                style={{ width: `${Math.min(100, usagePct)}%` }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-neutral-900"
                style={{ left: `${thresholdPct}%` }}
                title={`Alert at ${thresholdPct}%`}
              />
            </div>
            {usagePct >= 80 && (
              <button
                type="button"
                onClick={() => setShowPricingModal(true)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#E63946] hover:underline"
              >
                Approaching limit — upgrade to Pro for unlimited DMs →
              </button>
            )}
          </div>
        )}

        {/* Threshold + email/webhook (capped only) */}
        {!currentUsage?.unlimited && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Alert threshold</label>
              <div className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-1 text-xs font-semibold">
                {THRESHOLD_OPTIONS.map((pct) => {
                  const active = thresholdPct === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setThresholdPct(pct)}
                      className={[
                        'rounded-md px-3 py-1.5 transition-colors',
                        active ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900',
                      ].join(' ')}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-500">
                You&apos;ll receive an alert once per month when usage crosses this threshold.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                <Mail className="h-3.5 w-3.5 text-neutral-500" strokeWidth={2.5} />
                Alert email
              </label>
              <input
                type="email"
                placeholder="you@example.com (leave blank to use your account email)"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                className="mt-1.5 block h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
              />
              <p className="mt-1 text-[11px] text-neutral-500">Leave blank to send to your AutoDM account email.</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                <Webhook className="h-3.5 w-3.5 text-neutral-500" strokeWidth={2.5} />
                Webhook URL
                <span className="ml-1 inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                  optional
                </span>
              </label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/... or any POST endpoint"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="mt-1.5 block h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                AutoDM POSTs a JSON payload to this URL. Works with Slack, Discord, Zapier, and any custom endpoint.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={handleSaveAlerts}
                disabled={savingAlerts}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {savingAlerts
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Save className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {savingAlerts ? 'Saving…' : 'Save alerts'}
              </button>
              <button
                type="button"
                onClick={handleTestAlert}
                disabled={testingAlert || (!alertEmail && !webhookUrl)}
                title={(!alertEmail && !webhookUrl) ? 'Configure at least one alert channel first' : 'Send a test alert now'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {testingAlert
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} /> Testing…</>
                  : <><Send className="h-3.5 w-3.5" strokeWidth={2.5} /> Test alert</>}
              </button>
              {alertsMsg && <span className="text-xs font-medium text-neutral-600">{alertsMsg}</span>}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Account Details ───────────────────────────────────────────── */}
      <SectionCard icon={UserCircle} title="Account Details">
        <dl className="divide-y divide-neutral-100">
          <div className="flex items-center justify-between py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Email</dt>
            <dd className="text-sm text-neutral-900">{user?.email || 'N/A'}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">User ID</dt>
            <dd className="font-mono text-xs text-neutral-700">{user?.id?.substring(0, 8)}…</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Connected platforms</dt>
            <dd className="text-sm text-neutral-700">
              {activeAccounts.length > 0
                ? activeAccounts.map((a) => getPlatformLabel(a.platform)).join(', ')
                : 'None'}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {/* ── Danger Zone ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-red-200 bg-red-50/30 p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-red-900">
          <AlertTriangle className="h-5 w-5" strokeWidth={2.5} />
          Danger Zone
        </h2>
        <p className="mt-1 text-sm text-red-900/80">
          Once you delete your account, there is no going back. This permanently removes all your data,
          connected accounts, posts, and automations.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          Delete Account
        </button>
      </section>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <DisconnectModal
        isOpen={showDisconnectModal}
        onClose={() => { setShowDisconnectModal(false); setDisconnectTargetId(null); }}
        onConfirm={handleDisconnectConfirm}
        isDisconnecting={disconnectingId !== null}
      />

      <PricingModal
        open={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />

      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteEmail('');
          setDeleteError('');
        }}
        size="md"
        closable={!isDeleting}
        closeOnBackdrop={false}
        showCloseButton={false}
        ariaLabel="Delete account"
      >
        <div className="px-2 pt-4 pb-2">
          <div className="flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-7 w-7" strokeWidth={2} />
            </span>
          </div>
          <h3 className="mt-5 text-left text-xl font-bold text-neutral-900">Delete your account?</h3>
          <p className="mt-2 text-left text-sm leading-relaxed text-neutral-600">
            This action <strong className="text-neutral-900">cannot be undone</strong>. It permanently deletes your account and removes all associated data:
          </p>
          <ul className="mt-4 list-disc space-y-1.5 pl-6 text-sm text-neutral-700">
            <li>All connected Instagram/Facebook accounts</li>
            <li>All synced posts and stories</li>
            <li>All DM automations and analytics</li>
            <li>Your account and login credentials</li>
          </ul>

          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-neutral-700">Type your email to confirm</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 font-mono text-[11px] text-neutral-700">
                <strong className="truncate max-w-[160px]">{user?.email}</strong>
                <button
                  type="button"
                  onClick={copyEmailToClipboard}
                  title={emailCopied ? 'Copied!' : 'Copy to clipboard'}
                  className={[
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                    emailCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                  ].join(' ')}
                >
                  <CopyIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                  {emailCopied ? 'Copied' : 'Copy'}
                </button>
              </span>
            </div>
            <input
              type="email"
              placeholder="your-email@example.com"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              className="mt-3 block h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
            />
          </div>

          {deleteError && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {deleteError}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteEmail('');
                setDeleteError('');
              }}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-200 hover:border-neutral-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 disabled:opacity-60 transition-all duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteEmail !== user?.email}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150"
            >
              {isDeleting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />}
              {isDeleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
