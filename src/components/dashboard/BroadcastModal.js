'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, Send, Users, Zap, AlertTriangle, CheckCircle,
    Pause, Play, XCircle, RefreshCw, MessageSquare,
    MousePointerClick, ChevronRight, Radio, Filter,
} from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import darkStyles from './BroadcastModal.module.css';
import lightStyles from './BroadcastModal.light.module.css';
import Modal from '@/components/ui/Modal';

const RATE_OPTIONS = [
    { value: 5,  label: '5 / min',  hint: 'Safest — low risk of rate limiting' },
    { value: 10, label: '10 / min', hint: 'Recommended for most accounts' },
    { value: 20, label: '20 / min', hint: 'Fast — good for large audiences' },
    { value: 30, label: '30 / min', hint: 'Max — use only on established accounts' },
];

const DM_TYPES = [
    { value: 'message_template', label: 'Text Message',  icon: <MessageSquare size={14} /> },
    { value: 'multi_cta',        label: 'Multi-CTA',     icon: <MousePointerClick size={14} /> },
];

function ProgressBar({ pct, status, styles }) {
    const isRunning   = status === 'running';
    const isCompleted = status === 'completed';
    const isFailed    = status === 'failed';
    return (
        <div className={styles.progressWrap}>
            <div className={styles.progressTrack}>
                <div
                    className={`${styles.progressFill} ${isCompleted ? styles.progressComplete : isFailed ? styles.progressFailed : ''}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                />
                {isRunning && <div className={styles.progressShimmer} />}
            </div>
            <span className={styles.progressPct}>{pct}%</span>
        </div>
    );
}

export default function BroadcastModal({ post, onClose }) {
    const styles = useStyles(darkStyles, lightStyles);
    const { confirm } = useConfirm();
    // Phase: 'configure' | 'confirm' | 'running'
    const [phase, setPhase] = useState('configure');

    // Configure
    const [dmType,         setDmType]         = useState('message_template');
    const [message,        setMessage]         = useState('');
    const [ctaButtons,     setCtaButtons]      = useState([{ label: '', url: '' }]);
    const [rateLimit,      setRateLimit]       = useState(10);
    const [keywords,       setKeywords]        = useState('');
    const [existingConfig, setExistingConfig]  = useState(null);
    const [loadingConfig,  setLoadingConfig]   = useState(true);

    // Confirm
    const [startLoading,   setStartLoading]    = useState(false);
    const [startError,     setStartError]      = useState('');
    const [recipientCount, setRecipientCount]  = useState(null);
    const [preview,        setPreview]         = useState(null);  // { total, newCount, skippedCount }
    const [previewLoading, setPreviewLoading]  = useState(false);

    // Running
    const [jobId,   setJobId]   = useState(null);
    const [jobData, setJobData] = useState(null);
    const pollRef = useRef(null);

    // Confirm — countdown grace period before firing the API
    const [countdown, setCountdown] = useState(null);
    /* Race guard for the countdown→0→handleStart sequence.
       The countdown effect calls handleStart synchronously when it
       hits 0 — if the modal is unmounting in the same tick, the
       broadcast would still fire on the backend even though the UI is
       gone. Tracking mounted state lets us swallow the start in that
       narrow window. */
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Throttle retry countdown (seconds until Meta rate-limit lifts)
    const [retryIn, setRetryIn] = useState(null);

    // Derived: is an active job in flight (user must not be able to silently dismiss).
    // The Modal primitive uses these flags to disable backdrop click, escape key,
    // and the close button — replaces the old handleOverlayClick + portalReady wiring.
    const isJobActive    = phase === 'running' && ['running', 'paused', 'throttled'].includes(jobData?.status);
    const isCountingDown = countdown !== null;

    // ── On mount: check for an already-running job for this post ──
    // If found, jump straight to the running phase so the user can
    // pause/cancel without having to start a new broadcast.
    useEffect(() => {
        if (!post?.id) { setLoadingConfig(false); return; }

        let cancelled = false;

        const init = async () => {
            // 1. Check for an active broadcast job
            try {
                const res  = await fetch(`/api/broadcast/start?postId=${post.id}`);
                const data = await res.json();
                if (!cancelled && data.job?.id) {
                    setJobId(data.job.id);
                    setPhase('running');
                    setLoadingConfig(false);
                    return; // skip config pre-fill — user is in the running view
                }
            } catch { /* non-fatal — fall through to config load */ }

            // 2. Pre-fill form from existing automation config
            try {
                const res  = await fetch(`/api/automations?postId=${post.id}`);
                const data = await res.json();
                if (!cancelled) {
                    const auto = data.automations?.[0];
                    if (auto?.dm_config) {
                        setExistingConfig(auto.dm_config);
                        const cfg     = auto.dm_config;
                        const cfgType = cfg.abEnabled ? (cfg.variantA?.type || 'message_template') : (cfg.type || 'message_template');
                        const cfgMsg  = cfg.abEnabled ? (cfg.variantA?.message || '') : (cfg.message || '');
                        const cfgBtns = cfg.abEnabled ? (cfg.variantA?.buttons || []) : (cfg.buttons || []);
                        if (cfgType === 'multi_cta' || cfgType === 'message_template') {
                            setDmType(cfgType);
                            setMessage(cfgMsg);
                            if (cfgBtns.length > 0) setCtaButtons(cfgBtns.map((b) => ({ label: b.label || '', url: b.url || '' })));
                        }
                    }
                }
            } catch { /* non-fatal */ }

            if (!cancelled) setLoadingConfig(false);
        };

        init();
        return () => { cancelled = true; };
    }, [post?.id]);

    // ── Fetch audience preview whenever the confirm phase is entered ─
    useEffect(() => {
        if (phase !== 'confirm' || !post?.id) return;
        let cancelled = false;
        setPreview(null);
        setPreviewLoading(true);
        setStartError(''); // clear any error left over from a previous attempt
        fetch(`/api/broadcast/preview?postId=${post.id}&keywords=${encodeURIComponent(keywords)}`)
            .then((r) => r.json())
            .then((data) => { if (!cancelled) setPreview(data); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setPreviewLoading(false); });
        return () => { cancelled = true; };
    }, [phase, post?.id]);

    // ── Cancel an in-progress countdown if preview loads showing 0 recipients ─
    useEffect(() => {
        if (preview?.newCount === 0 && countdown !== null) {
            setCountdown(null);
        }
    }, [preview?.newCount, countdown]);

    // ── Countdown grace period — fires handleStart when it hits 0 ──
    useEffect(() => {
        if (countdown === null) return;
        if (countdown === 0) {
            setCountdown(null);
            // Guard against the unmount race: if the user closed the
            // modal in the same render cycle that countdown ticked to
            // 0, swallow the start so we don't fire a broadcast for a
            // window the user already dismissed.
            if (!isMountedRef.current) return;
            handleStart();
            return;
        }
        const t = setTimeout(() => setCountdown((n) => n - 1), 1_000);
        return () => clearTimeout(t);
    }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Throttle retry countdown ──────────────────────────────────
    useEffect(() => {
        if (jobData?.status !== 'throttled' || !jobData?.throttleUntil) {
            setRetryIn(null);
            return;
        }
        const tick = () => {
            const secs = Math.max(0, Math.ceil((jobData.throttleUntil - Date.now()) / 1_000));
            setRetryIn(secs > 0 ? secs : null);
        };
        tick();
        const t = setInterval(tick, 1_000);
        return () => clearInterval(t);
    }, [jobData?.status, jobData?.throttleUntil]);

    // ── Poll running job ──────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'running' || !jobId) return;
        const poll = async () => {
            try {
                const res  = await fetch(`/api/broadcast/${jobId}`);
                const data = await res.json();
                setJobData(data);
                if (['completed', 'failed', 'paused'].includes(data.status)) {
                    clearInterval(pollRef.current);
                }
            } catch { /* ignore */ }
        };
        poll();
        pollRef.current = setInterval(poll, 4_000);
        return () => clearInterval(pollRef.current);
    }, [phase, jobId]);

    // ── Helpers ───────────────────────────────────────────────────
    const buildDmConfig = () => {
        if (dmType === 'multi_cta') {
            return {
                type:    'multi_cta',
                message,
                buttons: ctaButtons.filter((b) => b.label.trim() && b.url.trim()),
            };
        }
        return { type: 'message_template', message };
    };

    const validate = () => {
        if (!message.trim()) return 'Enter a message to send.';
        if (dmType === 'multi_cta') {
            const hasBtn = ctaButtons.some((b) => b.label.trim() && b.url.trim());
            if (!hasBtn) return 'Add at least one button with a label and URL.';
        }
        return null;
    };

    const handleStart = async () => {
        const err = validate();
        if (err) { setStartError(err); return; }

        setStartLoading(true);
        setStartError('');

        try {
            const res  = await fetch('/api/broadcast/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId:          post.id,
                    dmType,
                    dmConfig:        buildDmConfig(),
                    rateLimitPerMin: rateLimit,
                    keywords,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status == 409 && data.jobId) {
                    setJobId(data.jobId);
                    setPhase('running');
                    return;
                }
                setStartError(data.error || 'Failed to start broadcast');
                return;
            }

            setJobId(data.jobId);
            setRecipientCount(data.totalRecipients);
            setPhase('running');
        } catch (e) {
            setStartError(e.message || 'Network error');
        } finally {
            setStartLoading(false);
        }
    };

    const handleAction = async (action) => {
        if (!jobId) return;
        const res = await fetch(`/api/broadcast/${jobId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        });
        const data = await res.json();
        setJobData((prev) => ({ ...prev, status: data.status }));
        if (action === 'resume') {
            // restart polling
            clearInterval(pollRef.current);
            pollRef.current = setInterval(async () => {
                const r  = await fetch(`/api/broadcast/${jobId}`);
                const d  = await r.json();
                setJobData(d);
                if (['completed', 'failed', 'paused'].includes(d.status)) clearInterval(pollRef.current);
            }, 4_000);
        }
    };

    // ── Render helpers ────────────────────────────────────────────
    const statusIcon = (status) => {
        if (status === 'completed') return <CheckCircle size={18} style={{ color: '#10B981' }} />;
        if (status === 'failed')    return <XCircle     size={18} style={{ color: '#FCA5A5' }} />;
        if (status === 'paused')    return <Pause       size={18} style={{ color: '#FCD34D' }} />;
        if (status === 'throttled') return <RefreshCw   size={18} style={{ color: '#FCD34D' }} />;
        return <RefreshCw size={18} className={styles.spin} style={{ color: '#A78BFA' }} />;
    };

    const statusLabel = (s) => ({
        running: 'Sending…', paused: 'Paused', completed: 'Completed', failed: 'Failed',
        throttled: 'Rate limited…',
    })[s] || s;

    const formatRetryIn = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    return (
        <Modal
            open={true}
            onClose={onClose}
            size={null}
            closable={!isJobActive && !isCountingDown}
            ariaLabel="Broadcast DM"
            showCloseButton={false}
            noPadding
            className={styles.modal}
        >
                {/* Header — kept inline so the icon-pill, breadcrumb, and
                    BroadcastModal.module.css typography are preserved exactly.
                    Modal primitive handles portal, escape, focus trap, and
                    backdrop guard around this content. */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIcon}>
                            <Radio size={15} />
                        </div>
                        <div>
                            <h2 className={styles.title}>Broadcast DM</h2>
                            <p className={styles.subtitle}>
                                {post?.caption
                                    ? post.caption.slice(0, 52) + (post.caption.length > 52 ? '…' : '')
                                    : 'Send a DM to all commenters on this post'}
                            </p>
                        </div>
                    </div>
                    <button
                    className={styles.closeBtn}
                    onClick={isJobActive || isCountingDown ? undefined : onClose}
                    disabled={isJobActive || isCountingDown}
                    title={isJobActive ? 'Pause or cancel the broadcast before closing' : isCountingDown ? 'Cancel the countdown first' : 'Close'}
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Phase breadcrumb */}
                <div className={styles.breadcrumb}>
                    {['configure', 'confirm', 'running'].map((p, i) => (
                        <span key={p} className={`${styles.breadcrumbStep} ${phase === p ? styles.breadcrumbActive : ''} ${['configure','confirm','running'].indexOf(phase) > i ? styles.breadcrumbDone : ''}`}>
                            {p === 'configure' ? '1. Compose' : p === 'confirm' ? '2. Review' : '3. Sending'}
                            {i < 2 && <ChevronRight size={11} className={styles.breadcrumbArrow} />}
                        </span>
                    ))}
                </div>

                <div className={styles.body}>

                    {/* ══════ CONFIGURE phase ══════ */}
                    {phase === 'configure' && (
                        <div className={styles.section}>
                            <div className={styles.infoBox}>
                                <Radio size={13} />
                                <span>
                                    Sends a DM to <strong>everyone who commented</strong> on this post.
                                    People who already received a DM from this automation will be skipped automatically.
                                </span>
                            </div>

                            {/* DM Type */}
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Message type</label>
                                <div className={styles.typeRow}>
                                    {DM_TYPES.map((t) => (
                                        <button
                                            key={t.value}
                                            className={`${styles.typeBtn} ${dmType === t.value ? styles.typeBtnActive : ''}`}
                                            onClick={() => setDmType(t.value)}
                                        >
                                            {t.icon}{t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message */}
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>Message</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder={dmType === 'multi_cta'
                                        ? "Hey! Here are some links just for you 👇"
                                        : "Hey! Thanks for commenting — here's something special for you 🎁"}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={4}
                                />
                                <span className={styles.charCount}>{message.length} chars</span>
                            </div>

                            {/* CTA Buttons */}
                            {dmType === 'multi_cta' && (
                                <div className={styles.field}>
                                    <label className={styles.fieldLabel}>CTA Buttons <span className={styles.limitNote}>(max 3)</span></label>
                                    <div className={styles.ctaList}>
                                        {ctaButtons.map((btn, idx) => (
                                            <div key={idx} className={styles.ctaRow}>
                                                <span className={styles.ctaNum}>{idx + 1}</span>
                                                <input
                                                    className={styles.input}
                                                    placeholder="Button label"
                                                    value={btn.label}
                                                    maxLength={20}
                                                    style={{ flex: '0 0 130px' }}
                                                    onChange={(e) => {
                                                        const b = [...ctaButtons]; b[idx] = { ...b[idx], label: e.target.value };
                                                        setCtaButtons(b);
                                                    }}
                                                />
                                                <input
                                                    className={`${styles.input} ${styles.ctaUrl}`}
                                                    placeholder="https://..."
                                                    value={btn.url}
                                                    onChange={(e) => {
                                                        const b = [...ctaButtons]; b[idx] = { ...b[idx], url: e.target.value };
                                                        setCtaButtons(b);
                                                    }}
                                                />
                                                {ctaButtons.length > 1 && (
                                                    <button
                                                        className={styles.removeBtn}
                                                        onClick={() => setCtaButtons(ctaButtons.filter((_, i) => i !== idx))}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {ctaButtons.length < 3 && (
                                            <button
                                                className={styles.addBtn}
                                                onClick={() => setCtaButtons([...ctaButtons, { label: '', url: '' }])}
                                            >
                                                + Add button
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Rate limit */}
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>
                                    <Zap size={12} /> Send rate
                                </label>
                                <div className={styles.rateGrid}>
                                    {RATE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            className={`${styles.rateBtn} ${rateLimit === opt.value ? styles.rateBtnActive : ''}`}
                                            onClick={() => setRateLimit(opt.value)}
                                        >
                                            <span className={styles.rateBtnLabel}>{opt.label}</span>
                                            <span className={styles.rateBtnHint}>{opt.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Keyword filter */}
                            <div className={styles.field}>
                                <label className={styles.fieldLabel}>
                                    <Filter size={12} /> Keyword filter <span className={styles.limitNote}>(optional)</span>
                                </label>
                                <input
                                    className={styles.input}
                                    placeholder="e.g. link, info, send me"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                />
                                <span className={styles.fieldHint}>Only DM commenters whose comment contains at least one of these keywords. Leave blank to DM everyone.</span>
                            </div>

                            {startError && (
                                <div className={styles.errorBox}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                                    {startError}
                                </div>
                            )}

                            <button
                                className={styles.nextBtn}
                                onClick={() => { const e = validate(); if (e) { setStartError(e); } else { setStartError(''); setPhase('confirm'); } }}
                            >
                                Review & Start <ChevronRight size={15} />
                            </button>
                        </div>
                    )}

                    {/* ══════ CONFIRM phase ══════ */}
                    {phase === 'confirm' && (
                        <div className={styles.section}>
                            <div className={styles.confirmCard}>
                                <div className={styles.confirmRow}>
                                    <span className={styles.confirmLabel}><Users size={13} /> Recipients</span>
                                    <span className={styles.confirmValue}>
                                        {previewLoading ? (
                                            <span className={styles.previewLoading}>
                                                <RefreshCw size={11} className={styles.spin} /> Calculating…
                                            </span>
                                        ) : preview ? (
                                            <>
                                                {preview.newCount.toLocaleString()} will receive this DM
                                                {preview.skippedCount > 0 && (
                                                    <span className={styles.previewNote}> · {preview.skippedCount.toLocaleString()} skipped</span>
                                                )}
                                            </>
                                        ) : (
                                            'All commenters (deduped)'
                                        )}
                                    </span>
                                </div>
                                <div className={styles.confirmRow}>
                                    <span className={styles.confirmLabel}><MessageSquare size={13} /> Type</span>
                                    <span className={styles.confirmValue}>
                                        {DM_TYPES.find((t) => t.value === dmType)?.label}
                                    </span>
                                </div>
                                <div className={styles.confirmRow}>
                                    <span className={styles.confirmLabel}><Zap size={13} /> Rate</span>
                                    <span className={styles.confirmValue}>{rateLimit} DMs/min</span>
                                </div>
                                <div className={styles.confirmRow}>
                                    <span className={styles.confirmLabel}>Message preview</span>
                                    <span className={styles.confirmValue} style={{ fontStyle: 'italic', maxWidth: 220, textAlign: 'right' }}>
                                        &ldquo;{message.slice(0, 80)}{message.length > 80 ? '…' : ''}&rdquo;
                                    </span>
                                </div>
                                {keywords.trim() && (
                                    <div className={styles.confirmRow}>
                                        <span className={styles.confirmLabel}><Filter size={13} /> Keywords</span>
                                        <span className={styles.confirmValue} style={{ maxWidth: 220, textAlign: 'right', wordBreak: 'break-word' }}>
                                            {keywords}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.warningBox}>
                                <AlertTriangle size={13} style={{ flexShrink: 0, color: '#FCD34D' }} />
                                <span>
                                    Broadcast DMs are sent using your connected Instagram account.
                                    Meta may temporarily rate-limit your account if you send too many DMs too fast.
                                    The <strong>{rateLimit}/min</strong> rate is enforced automatically.
                                </span>
                            </div>

                            {preview?.newCount === 0 && !previewLoading && (
                                <div className={styles.errorBox}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                                    Everyone who commented on this post has already received a DM. Nothing to send.
                                </div>
                            )}

                            {startError && (
                                <div className={styles.errorBox}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                                    {startError}
                                </div>
                            )}

                            <div className={styles.confirmActions}>
                                <button
                                    className={styles.backBtn}
                                    onClick={() => setPhase('configure')}
                                    disabled={isCountingDown || startLoading}
                                >
                                    ← Back
                                </button>
                                <button
                                    className={styles.startBtn}
                                    onClick={isCountingDown || startLoading || preview?.newCount === 0 ? undefined : () => setCountdown(10)}
                                    disabled={isCountingDown || startLoading || preview?.newCount === 0}
                                >
                                    {startLoading ? (
                                        <><RefreshCw size={14} className={styles.spin} /> Starting…</>
                                    ) : isCountingDown ? (
                                        <><RefreshCw size={14} className={styles.spin} /> Sending in {countdown}s</>
                                    ) : (
                                        <><Send size={14} /> Start Broadcast</>
                                    )}
                                </button>
                            </div>
                            {isCountingDown && (
                                <button className={styles.undoBtn} onClick={() => setCountdown(null)}>
                                    Undo — cancel send
                                </button>
                            )}
                        </div>
                    )}

                    {/* ══════ RUNNING phase ══════ */}
                    {phase === 'running' && (
                        <div className={styles.section}>

                            {/* Status header */}
                            <div className={styles.runningStatus}>
                                {jobData && statusIcon(jobData.status)}
                                <span className={styles.runningStatusLabel}>
                                    {jobData ? statusLabel(jobData.status) : 'Starting…'}
                                </span>
                            </div>

                            {/* Progress bar */}
                            {jobData && (
                                <ProgressBar
                                    pct={jobData.progressPct || 0}
                                    status={jobData.status}
                                    styles={styles}
                                />
                            )}

                            {/* Stat cards */}
                            {jobData && (
                                <div className={styles.statGrid}>
                                    <div className={styles.statCard}>
                                        <p className={styles.statVal}>{jobData.total_recipients?.toLocaleString() || 0}</p>
                                        <p className={styles.statLbl}>Total</p>
                                    </div>
                                    <div className={styles.statCard}>
                                        <p className={`${styles.statVal} ${styles.statValSent}`}>{jobData.sent_count?.toLocaleString() || 0}</p>
                                        <p className={styles.statLbl}>Sent ✓</p>
                                    </div>
                                    <div className={styles.statCard}>
                                        <p className={`${styles.statVal} ${jobData.failed_count > 0 ? styles.statValFailed : ''}`}>
                                            {jobData.failed_count?.toLocaleString() || 0}
                                        </p>
                                        <p className={styles.statLbl}>Failed</p>
                                    </div>
                                    <div className={styles.statCard}>
                                        <p className={styles.statVal}>{jobData.skipped_count?.toLocaleString() || 0}</p>
                                        <p className={styles.statLbl}>Skipped</p>
                                    </div>
                                </div>
                            )}

                            {/* Rate info */}
                            {jobData?.status === 'running' && (
                                <p className={styles.rateInfo}>
                                    Sending at up to <strong>{jobData.rate_limit_per_min} DMs/min</strong> · processed in batches every 5 minutes
                                </p>
                            )}

                            {/* Throttle banner */}
                            {jobData?.status === 'throttled' && (
                                <div className={styles.throttleBox}>
                                    <RefreshCw size={13} />
                                    <span>
                                        Meta rate-limited this account
                                        {jobData.throttleCount > 1 ? ` (${jobData.throttleCount}× today)` : ''}.{' '}
                                        {retryIn != null
                                            ? <>Auto-retrying in <strong>{formatRetryIn(retryIn)}</strong></>
                                            : <>Retrying shortly…</>}
                                    </span>
                                </div>
                            )}

                            {/* Error */}
                            {jobData?.error_message && jobData.status === 'failed' && (
                                <div className={styles.errorBox}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                                    {jobData.error_message}
                                </div>
                            )}

                            {/* Completed success */}
                            {jobData?.status === 'completed' && (
                                <div className={styles.successBox}>
                                    <CheckCircle size={14} />
                                    Broadcast complete! {jobData.sent_count?.toLocaleString()} DMs sent successfully.
                                </div>
                            )}

                            {/* Lock hint - shown while job is active */}
                            {isJobActive && (
                                <p className={styles.lockHint}>
                                    {jobData?.status === 'throttled'
                                        ? 'Cancel to close the window'
                                        : 'Pause or cancel to close the window'}
                                </p>
                            )}

                            {/* Controls */}
                            <div className={styles.runningControls}>
                                {jobData?.status === 'running' && (
                                    <button className={styles.pauseBtn} onClick={() => handleAction('pause')}>
                                        <Pause size={13} /> Pause
                                    </button>
                                )}
                                {jobData?.status === 'paused' && (
                                    <button className={styles.resumeBtn} onClick={() => handleAction('resume')}>
                                        <Play size={13} /> Resume
                                    </button>
                                )}
                                {['running', 'paused', 'throttled'].includes(jobData?.status) && (
                                    <button className={styles.cancelBtn} onClick={async () => {
                                        const ok = await confirm({
                                            title: 'Cancel this broadcast?',
                                            message: 'The broadcast will stop sending to remaining recipients. This cannot be undone.',
                                            confirmText: 'Cancel broadcast',
                                            cancelText: 'Keep running',
                                        });
                                        if (ok) handleAction('cancel');
                                    }}>
                                        <XCircle size={13} /> Cancel
                                    </button>
                                )}
                                {['completed', 'failed'].includes(jobData?.status) && (
                                    <button className={styles.doneBtn} onClick={onClose}>
                                        Done
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
        </Modal>
    );
}
