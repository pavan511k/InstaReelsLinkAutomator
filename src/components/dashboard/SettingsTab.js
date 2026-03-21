'use client';

import { useState } from 'react';
import { Calendar, Clock, CalendarClock, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsTab.module.css';
import lightStyles from './SettingsTab.light.module.css';

// Returns the minimum datetime string for the datetime-local input (now + 1h)
function getMinDatetime() {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduledCountdown(isoString) {
    if (!isoString) return null;
    const diff = new Date(isoString) - new Date();
    if (diff <= 0) return 'In the past — pick a future time';
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (days >= 2)  return `Starts in ${days} days`;
    if (hours >= 1) return `Starts in ${hours}h`;
    return `Starts in ${mins}m`;
}

function formatExpiryCountdown(isoString) {
    if (!isoString) return null;
    const diff = new Date(isoString) - new Date();
    if (diff <= 0) return 'Expired';
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (days >= 2)  return `Pauses in ${days} days`;
    if (hours >= 1) return `Pauses in ${hours}h`;
    return `Pauses in ${mins}m`;
}

function toLocalInputValue(isoString) {
    if (!isoString) return '';
    // Convert ISO to YYYY-MM-DDTHH:MM in local time
    const d   = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Flow Step Builder ───────────────────────────────────────────────────────

const DELAY_OPTIONS = [
    { label: '1 hour',   value: 1   },
    { label: '6 hours',  value: 6   },
    { label: '12 hours', value: 12  },
    { label: '1 day',    value: 24  },
    { label: '2 days',   value: 48  },
    { label: '3 days',   value: 72  },
    { label: '5 days',   value: 120 },
    { label: '7 days',   value: 168 },
];

function FlowStepBuilder({ steps, onChange, styles }) {
    const MAX_STEPS = 3;

    const addStep = () => {
        if (steps.length >= MAX_STEPS) return;
        onChange([
            ...steps,
            { id: `step_${Date.now()}`, message: '', delayHours: 24, dmType: 'message_template' },
        ]);
    };

    const removeStep = (idx) => {
        onChange(steps.filter((_, i) => i !== idx));
    };

    const updateStep = (idx, updates) => {
        const next = [...steps];
        next[idx] = { ...next[idx], ...updates };
        onChange(next);
    };

    // Compute cumulative delays for the preview timeline
    const cumulativeDelays = steps.reduce((acc, step, i) => {
        acc.push((acc[i - 1] || 0) + step.delayHours);
        return acc;
    }, []);

    return (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Timeline header */}
            <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 10, paddingLeft: 2 }}>
                Steps run in sequence after the initial DM is sent.
            </div>

            {steps.map((step, idx) => (
                <div key={step.id || idx} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: 12,
                            fontWeight: 700, background: 'rgba(139,92,246,0.2)',
                            border: '1px solid rgba(139,92,246,0.4)', color: 'rgb(196,181,253)',
                        }}>
                            {idx + 1}
                        </div>
                        {idx < steps.length - 1 && (
                            <div style={{ width: 1, flex: 1, minHeight: 20, background: 'rgba(139,92,246,0.2)', margin: '4px 0' }} />
                        )}
                    </div>

                    {/* Step card */}
                    <div style={{
                        flex: 1, background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 10, padding: 12, marginBottom: idx < steps.length - 1 ? 0 : 0,
                    }}>
                        {/* Delay selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <Clock size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>Send after</span>
                            <select
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 6, padding: '3px 8px', fontSize: 12, color: 'inherit', cursor: 'pointer',
                                }}
                                value={step.delayHours}
                                onChange={(e) => updateStep(idx, { delayHours: Number(e.target.value) })}
                            >
                                {DELAY_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            <span style={{ fontSize: 11, opacity: 0.4 }}>
                                ({cumulativeDelays[idx]}h from initial DM)
                            </span>
                            <div style={{ flex: 1 }} />
                            <button
                                style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: 'rgba(239,68,68,0.7)', padding: '2px 4px', borderRadius: 4,
                                    display: 'flex', alignItems: 'center',
                                }}
                                onClick={() => removeStep(idx)}
                                title="Remove step"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>

                        {/* Message textarea */}
                        <textarea
                            className={styles.textarea}
                            placeholder={`Step ${idx + 1} message — e.g. \"Hey {first_name}, just following up!\"`}
                            rows={2}
                            value={step.message}
                            onChange={(e) => updateStep(idx, { message: e.target.value })}
                        />
                        <p className={styles.checkDesc} style={{ marginTop: 4, opacity: 0.4 }}>
                            Supports {'{first_name}'} and {'{username}'}.
                        </p>
                    </div>
                </div>
            ))}

            {steps.length < MAX_STEPS ? (
                <button
                    className={styles.checkDesc}
                    style={{
                        marginLeft: 38, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)',
                        borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'rgb(196,181,253)',
                        fontSize: 12, fontWeight: 500,
                    }}
                    onClick={addStep}
                >
                    <Plus size={13} /> Add step ({steps.length}/{MAX_STEPS})
                </button>
            ) : (
                <p className={styles.checkDesc} style={{ marginLeft: 38, marginTop: 4, opacity: 0.45 }}>
                    Maximum 3 steps reached.
                </p>
            )}
        </div>
    );
}

export default function SettingsTab({ config, onChange, userPlan = 'free' }) {
    const isPro = userPlan === 'pro' || userPlan === 'business' || userPlan === 'trial';
    const styles = useStyles(darkStyles, lightStyles);
    const updateConfig = (updates) => onChange({ ...config, ...updates });

    const scheduledCountdown = config.scheduledStartEnabled && config.scheduledStartAt
        ? formatScheduledCountdown(config.scheduledStartAt)
        : null;
    const scheduledInPast = scheduledCountdown === 'In the past — pick a future time';

    const expiryCountdown = config.expiresEnabled && config.expiresAt
        ? formatExpiryCountdown(config.expiresAt)
        : null;
    const isExpired = expiryCountdown === 'Expired';

    // Show a "runs from → to" summary when both are set and valid
    const showRange = config.scheduledStartEnabled && config.scheduledStartAt &&
                      !scheduledInPast && config.expiresEnabled && config.expiresAt && !isExpired;

    return (
        <div className={styles.tab}>

            {/* ── Automation Schedule ──────────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Automation Schedule</p>

                {/* ── Schedule start card ── */}
                <div className={styles.scheduleCard}>
                    <label className={styles.expiryToggleRow}>
                        <div className={styles.expiryToggleLeft}>
                            <div className={`${styles.expiryIcon} ${styles.scheduleIcon}`}>
                                <CalendarClock size={14} />
                            </div>
                            <div>
                                <span className={styles.checkText}>Schedule start time</span>
                                <p className={styles.checkDesc}>
                                    Automation activates automatically at this date and time. Save as inactive until then.
                                </p>
                            </div>
                        </div>
                        <div
                            className={`${styles.toggle} ${config.scheduledStartEnabled ? styles.toggleOn : ''}`}
                            onClick={() => updateConfig({
                                scheduledStartEnabled: !config.scheduledStartEnabled,
                                scheduledStartAt: !config.scheduledStartEnabled ? config.scheduledStartAt : null,
                            })}
                            role="switch"
                            aria-checked={config.scheduledStartEnabled}
                        >
                            <div className={styles.toggleThumb} />
                        </div>
                    </label>

                    {config.scheduledStartEnabled && (
                        <div className={styles.expiryPickerWrap}>
                            <div className={styles.expiryPickerRow}>
                                <Clock size={13} className={styles.expiryPickerIcon} />
                                <input
                                    type="datetime-local"
                                    className={`${styles.expiryInput} ${scheduledInPast ? styles.expiryInputExpired : ''}`}
                                    value={toLocalInputValue(config.scheduledStartAt)}
                                    min={getMinDatetime()}
                                    onChange={(e) => updateConfig({
                                        scheduledStartAt: e.target.value
                                            ? new Date(e.target.value).toISOString()
                                            : null,
                                    })}
                                />
                            </div>

                            {scheduledCountdown && (
                                <div className={`${styles.countdownPill} ${scheduledInPast ? styles.countdownExpired : styles.countdownScheduled}`}>
                                    {scheduledInPast ? '⚠️ ' : '🚀 '}{scheduledCountdown}
                                </div>
                            )}

                            {!config.scheduledStartAt && (
                                <p className={styles.expiryHint}>
                                    Pick a future date — the automation will activate automatically.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Range summary (both start and expiry set) ── */}
                {showRange && (
                    <div className={styles.rangeRow}>
                        <span className={styles.rangeLabel}>
                            {new Date(config.scheduledStartAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <ArrowRight size={12} className={styles.rangeArrow} />
                        <span className={styles.rangeLabel}>
                            {new Date(config.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={styles.rangeDuration}>
                            {Math.ceil((new Date(config.expiresAt) - new Date(config.scheduledStartAt)) / 86_400_000)} days
                        </span>
                    </div>
                )}

                {/* ── Expiry card ── */}
                <div className={styles.expiryCard}>
                    <label className={styles.expiryToggleRow}>
                        <div className={styles.expiryToggleLeft}>
                            <div className={styles.expiryIcon}>
                                <Calendar size={14} />
                            </div>
                            <div>
                                <span className={styles.checkText}>Set expiry date</span>
                                <p className={styles.checkDesc}>
                                    Automation pauses automatically on this date — great for flash sales and limited-time offers.
                                </p>
                            </div>
                        </div>
                        <div
                            className={`${styles.toggle} ${config.expiresEnabled ? styles.toggleOn : ''}`}
                            onClick={() => updateConfig({
                                expiresEnabled: !config.expiresEnabled,
                                expiresAt: !config.expiresEnabled ? config.expiresAt : null,
                            })}
                            role="switch"
                            aria-checked={config.expiresEnabled}
                        >
                            <div className={styles.toggleThumb} />
                        </div>
                    </label>

                    {config.expiresEnabled && (
                        <div className={styles.expiryPickerWrap}>
                            <div className={styles.expiryPickerRow}>
                                <Clock size={13} className={styles.expiryPickerIcon} />
                                <input
                                    type="datetime-local"
                                    className={`${styles.expiryInput} ${isExpired ? styles.expiryInputExpired : ''}`}
                                    value={toLocalInputValue(config.expiresAt)}
                                    min={getMinDatetime()}
                                    onChange={(e) => updateConfig({
                                        expiresAt: e.target.value
                                            ? new Date(e.target.value).toISOString()
                                            : null,
                                    })}
                                />
                            </div>

                            {expiryCountdown && (
                                <div className={`${styles.countdownPill} ${isExpired ? styles.countdownExpired : styles.countdownActive}`}>
                                    {isExpired ? '⛔ ' : '⏱ '}{expiryCountdown}
                                </div>
                            )}

                            {!config.expiresAt && (
                                <p className={styles.expiryHint}>
                                    Pick a date and time — the automation will pause automatically at that moment.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Send Delay ────────────────────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Send Delay</p>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={config.delayMessage}
                        onChange={(e) => updateConfig({ delayMessage: e.target.checked })}
                    />
                    <div>
                        <span className={styles.checkText}>Delay Message</span>
                        <p className={styles.checkDesc}>
                            Add a random delay (30s–2min) before sending the DM to appear more natural
                        </p>
                    </div>
                </label>
            </div>

            {/* ── Trigger Controls ──────────────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Trigger Controls</p>

                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={config.disableUniversalTriggers}
                        onChange={(e) => updateConfig({ disableUniversalTriggers: e.target.checked })}
                    />
                    <div>
                        <span className={styles.checkText}>Disable Universal Triggers</span>
                        <p className={styles.checkDesc}>
                            Only use post-specific triggers instead of account-wide universal triggers
                        </p>
                    </div>
                </label>

                <div className={styles.checkboxGroup}>
                    <div className={styles.commentReplyCard}>
                        <div className={styles.commentReplyHeader}>
                            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💬</span>
                            <div>
                                <span className={styles.checkText} style={{ display: 'block', marginBottom: 3 }}>Comment Auto-Reply</span>
                                <p className={styles.checkDesc}>
                                    AutoDM always replies to the triggering comment after sending the DM.
                                    Leave blank to use the default message.
                                </p>
                            </div>
                        </div>
                        <textarea
                            className={styles.textarea}
                            placeholder="Hey! Check your DM ❤️ Didn't receive the link? Follow and comment again."
                            value={config.replyMessage || ''}
                            onChange={(e) => updateConfig({ replyMessage: e.target.value })}
                            rows={2}
                        />
                    </div>
                </div>
            </div>

            {/* ── Flow Automation ──────────────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Flow Automation</p>

                <label className={`${styles.checkboxLabel} ${!isPro ? styles.proFeature : ''}`}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        disabled={!isPro}
                        checked={isPro && !!config.flowAutomation}
                        onChange={(e) => isPro && updateConfig({
                            flowAutomation: e.target.checked,
                            flowSteps: e.target.checked && !config.flowSteps?.length
                                ? [{ message: '', delayHours: 24, requiresResponse: false, dmType: 'message_template' }]
                                : config.flowSteps,
                        })}
                    />
                    <div>
                        <span className={styles.checkText}>
                            Enable multi-step follow-up sequence
                            {!isPro && <span className={styles.proBadge}>Pro</span>}
                        </span>
                        <p className={styles.checkDesc}>
                            Send up to 3 automatic follow-up messages after the initial DM, with optional delays and yes/no branching.
                        </p>
                    </div>
                </label>

                {isPro && config.flowAutomation && (
                    <FlowStepBuilder
                        steps={config.flowSteps || []}
                        onChange={(steps) => updateConfig({ flowSteps: steps })}
                        styles={styles}
                    />
                )}
            </div>

            {/* ── Upsell Follow-up ──────────────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Upsell Follow-up</p>

                <label className={`${styles.checkboxLabel} ${!isPro ? styles.proFeature : ''}`}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        disabled={!isPro}
                        checked={isPro && !!config.upsell?.enabled}
                        onChange={(e) => isPro && updateConfig({
                            upsell: { ...(config.upsell || {}), enabled: e.target.checked }
                        })}
                    />
                    <div>
                        <span className={styles.checkText}>
                            Send a follow-up DM to non-clickers
                            {!isPro && <span className={styles.proBadge}>Pro</span>}
                        </span>
                        <p className={styles.checkDesc}>
                            If someone receives your DM but doesn’t click the link within the delay window,
                            AutoDM sends them a second message automatically.
                        </p>
                    </div>
                </label>

                {isPro && config.upsell?.enabled && (
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <p className={styles.checkDesc} style={{ marginBottom: 6 }}>Send follow-up after</p>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {[6, 12, 24, 48, 72].map((h) => {
                                    const active = (config.upsell?.delayHours ?? 24) === h;
                                    return (
                                        <button
                                            key={h}
                                            style={{
                                                padding: '5px 14px', borderRadius: 20, border: '1px solid',
                                                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                                                borderColor: active ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.12)',
                                                background:  active ? 'rgba(139,92,246,0.15)' : 'transparent',
                                                color:       active ? 'rgb(196,181,253)' : 'inherit',
                                            }}
                                            onClick={() => updateConfig({
                                                upsell: { ...(config.upsell || {}), delayHours: h }
                                            })}
                                        >
                                            {h}h
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className={styles.checkDesc} style={{ marginBottom: 6 }}>Follow-up message</p>
                            <textarea
                                className={styles.textarea}
                                placeholder={`Hey {first_name}! 👋 Still interested? Here's another look at what we shared — grab it before it's gone! 🔗`}
                                rows={3}
                                value={config.upsell?.message || ''}
                                onChange={(e) => updateConfig({
                                    upsell: { ...(config.upsell || {}), message: e.target.value, dmType: 'message_template' }
                                })}
                            />
                            <p className={styles.checkDesc} style={{ marginTop: 4, opacity: 0.5 }}>
                                Supports {'{first_name}'} and {'{username}'}. Keep it short and human.
                            </p>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
