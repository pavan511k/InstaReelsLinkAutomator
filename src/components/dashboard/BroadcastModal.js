'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, Send, Users, Zap, AlertTriangle, CheckCircle,
    Pause, Play, XCircle, RefreshCw, MessageSquare,
    MousePointerClick, ChevronRight, Radio,
} from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './BroadcastModal.module.css';
import lightStyles from './BroadcastModal.light.module.css';

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
    // Phase: 'configure' | 'confirm' | 'running'
    const [phase, setPhase] = useState('configure');

    // Configure
    const [dmType,         setDmType]         = useState('message_template');
    const [message,        setMessage]         = useState('');
    const [ctaButtons,     setCtaButtons]      = useState([{ label: '', url: '' }]);
    const [rateLimit,      setRateLimit]       = useState(10);
    const [useExisting,    setUseExisting]     = useState(true);  // pre-fill from automation
    const [existingConfig, setExistingConfig]  = useState(null);
    const [loadingConfig,  setLoadingConfig]   = useState(true);

    // Confirm
    const [startLoading,   setStartLoading]    = useState(false);
    const [startError,     setStartError]      = useState('');
    const [recipientCount, setRecipientCount]  = useState(null); // set after start

    // Running
    const [jobId,   setJobId]   = useState(null);
    const [jobData, setJobData] = useState(null);
    const pollRef = useRef(null);

    // ── Load existing automation config ───────────────────────────
    useEffect(() => {
        if (!post?.id) { setLoadingConfig(false); return; }
        fetch(`/api/automations?postId=${post.id}`)
            .then((r) => r.json())
            .then((d) => {
                const auto = d.automations?.[0];
                if (auto?.dm_config) {
                    setExistingConfig(auto.dm_config);
                    // Pre-fill form from existing config
                    const cfg = auto.dm_config;
                    const cfgType = cfg.abEnabled ? (cfg.variantA?.type || 'message_template') : (cfg.type || 'message_template');
                    const cfgMsg  = cfg.abEnabled ? (cfg.variantA?.message || '') : (cfg.message || '');
                    const cfgBtns = cfg.abEnabled ? (cfg.variantA?.buttons || []) : (cfg.buttons || []);
                    if (cfgType === 'multi_cta' || cfgType === 'message_template') {
                        setDmType(cfgType);
                        setMessage(cfgMsg);
                        if (cfgBtns.length > 0) setCtaButtons(cfgBtns.map((b) => ({ label: b.label || '', url: b.url || '' })));
                    }
                }
            })
            .catch(() => {})
            .finally(() => setLoadingConfig(false));
    }, [post?.id]);

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
                }),
            });
            const data = await res.json();

            if (!res.ok) {
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
        return <RefreshCw size={18} className={styles.spin} style={{ color: '#A78BFA' }} />;
    };

    const statusLabel = (s) => ({
        running: 'Sending…', paused: 'Paused', completed: 'Completed', failed: 'Failed',
    })[s] || s;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
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
                    <button className={styles.closeBtn} onClick={onClose}>
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
                                    <span className={styles.confirmValue}>All commenters (duplicates removed)</span>
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
                            </div>

                            <div className={styles.warningBox}>
                                <AlertTriangle size={13} style={{ flexShrink: 0, color: '#FCD34D' }} />
                                <span>
                                    Broadcast DMs are sent using your connected Instagram account.
                                    Meta may temporarily rate-limit your account if you send too many DMs too fast.
                                    The <strong>{rateLimit}/min</strong> rate is enforced automatically.
                                </span>
                            </div>

                            {startError && (
                                <div className={styles.errorBox}>
                                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                                    {startError}
                                </div>
                            )}

                            <div className={styles.confirmActions}>
                                <button className={styles.backBtn} onClick={() => setPhase('configure')}>
                                    ← Back
                                </button>
                                <button
                                    className={styles.startBtn}
                                    onClick={handleStart}
                                    disabled={startLoading}
                                >
                                    {startLoading ? (
                                        <><RefreshCw size={14} className={styles.spin} /> Starting…</>
                                    ) : (
                                        <><Send size={14} /> Start Broadcast</>
                                    )}
                                </button>
                            </div>
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
                                {['running', 'paused'].includes(jobData?.status) && (
                                    <button className={styles.cancelBtn} onClick={() => {
                                        if (confirm('Cancel this broadcast? This cannot be undone.')) handleAction('cancel');
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
            </div>
        </div>
    );
}
