'use client';

import { useState } from 'react';
import { Calendar, Clock, CalendarClock, ArrowRight, Plus, Trash2, ChevronDown, BookmarkPlus, Lock } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsTab.module.css';
import lightStyles from './SettingsTab.light.module.css';
import darkSettingsStyles from './SettingsContent.module.css';
import lightSettingsStyles from './SettingsContent.light.module.css';

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
                        <div className={styles.flowStepIndicator}>
                            {idx + 1}
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={styles.flowStepConnector} />
                        )}
                    </div>

                    {/* Step card */}
                    <div className={styles.flowStepCard}>
                        {/* Delay selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <Clock size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>Send after</span>
                            <select
                                className={styles.flowStepDelaySelect}
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
                                className={styles.flowStepRemoveBtn}
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
                    className={styles.flowStepAddBtn}
                    style={{ marginLeft: 38, marginTop: 4 }}
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

export default function SettingsTab({ config, onChange, userPlan = 'free', onSaveTemplate }) {
    const isPro = userPlan === 'pro' || userPlan === 'business' || userPlan === 'trial';
    const styles = useStyles(darkStyles, lightStyles);
    const settingsStyles = useStyles(darkSettingsStyles, lightSettingsStyles);
    const updateConfig = (updates) => onChange({ ...config, ...updates });

    /* Collapse the four niche setting blocks (send delay, universal-trigger
       disable, flow automation, upsell) under a single "Advanced settings"
       toggle. Schedule + expiry stay visible since they're the most-used
       knobs. Auto-expand if any advanced setting is already on. */
    const advancedActive = !!config.delayMessage
        || !!config.disableUniversalTriggers
        || !!config.flowAutomation
        || !!config.upsell?.enabled;
    const [showAdvanced, setShowAdvanced] = useState(advancedActive);

    /* Save Template lives at the end of the Settings tab — the natural
       end-of-wizard moment to capture the whole config (DM + trigger +
       settings) into a reusable template. */
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const handleSaveTemplateConfirm = () => {
        if (templateName.trim()) onSaveTemplate?.(templateName.trim());
        setShowTemplateModal(false); setTemplateName('');
    };

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
        <>
        <div className={styles.tab}>

            {/* ── Automation Schedule ──────────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Automation Schedule</p>

                {/* ── Schedule start card ── */}
                <div className={`${styles.scheduleCard} ${!isPro ? styles.proFeature : ''}`}>
                    <label className={styles.expiryToggleRow}>
                        <div className={styles.expiryToggleLeft}>
                            <div className={`${styles.expiryIcon} ${styles.scheduleIcon}`}>
                                <CalendarClock size={14} />
                            </div>
                            <div>
                                <span className={styles.checkText}>
                                    Schedule start time
                                    {!isPro && <span className={styles.proBadge}>Pro</span>}
                                </span>
                                <p className={styles.checkDesc}>
                                    Automation activates automatically at this date and time. Save as inactive until then.
                                </p>
                            </div>
                        </div>
                        <div
                            className={`${styles.toggle} ${isPro && config.scheduledStartEnabled ? styles.toggleOn : ''}`}
                            onClick={() => {
                                if (!isPro) return;
                                updateConfig({
                                    scheduledStartEnabled: !config.scheduledStartEnabled,
                                    scheduledStartAt: !config.scheduledStartEnabled ? config.scheduledStartAt : null,
                                });
                            }}
                            role="switch"
                            aria-checked={isPro && !!config.scheduledStartEnabled}
                            aria-disabled={!isPro}
                            style={!isPro ? { cursor: 'not-allowed' } : undefined}
                        >
                            <div className={styles.toggleThumb} />
                        </div>
                    </label>

                    {isPro && config.scheduledStartEnabled && (
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

            {/* ── Advanced settings ─────────────────────────────────
                Send delay, universal-trigger disable, flow automation,
                and upsell follow-up all live behind a single disclosure
                so the Settings tab reads as "Schedule → Expiry → done"
                for the common case. Power users still have one click to
                everything. */}
            <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className={styles.advancedToggle}
                aria-expanded={showAdvanced}
            >
                <span>
                    Advanced settings
                    {advancedActive && <span className={styles.advancedActiveDot} aria-hidden="true" />}
                </span>
                <ChevronDown
                    size={14}
                    style={{
                        transform: showAdvanced ? 'rotate(180deg)' : 'none',
                        transition: 'transform 180ms',
                    }}
                />
            </button>

            {showAdvanced && (
            <div className={styles.advancedBody}>

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
                            Add a random 30s–2min delay before queued DMs go out, so sends look
                            more human. Doesn’t apply to instant flows like Follow-Gate gate
                            messages, Email Collector asks, or Story-Mention replies.
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
                            Send up to 3 automatic follow-up messages after the initial DM, each with its own delay.
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

            {/* ── Follow-up to Non-Clickers ─────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Follow-up to Non-Clickers</p>

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
                            After the delay, AutoDM sends a second DM only to recipients who
                            haven’t clicked your link yet. Click attribution is per-recipient.
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
                                            className={`${styles.delayPill} ${active ? styles.delayPillActive : ''}`}
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
            )}

            {/* ── Save as Template — end-of-wizard action ──────────
                Sits below all other settings so the user reaches it
                naturally as the last step before clicking Save & Activate.
                Captures the full config (DM + trigger + settings) into a
                named template that can be reused on future posts. */}
            {onSaveTemplate && (
                <div className={styles.settingGroup} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <p className={styles.groupTitle}>Save as Template</p>
                    {isPro ? (
                        <button
                            type="button"
                            className={styles.advancedToggle}
                            onClick={() => { setTemplateName(''); setShowTemplateModal(true); }}
                            style={{ marginTop: 4 }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <BookmarkPlus size={14} />
                                Save this configuration as a template
                            </span>
                        </button>
                    ) : (
                        <a
                            href="/pricing"
                            className={styles.advancedToggle}
                            style={{
                                marginTop: 4, opacity: 0.85, textDecoration: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                            title="Upgrade to Pro to save templates"
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <Lock size={13} />
                                Save as Template
                            </span>
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                background: 'rgba(167, 139, 250, 0.18)',
                                color: '#A78BFA', borderRadius: 100, letterSpacing: '0.04em',
                            }}>
                                PRO
                            </span>
                        </a>
                    )}
                </div>
            )}

        </div>

        {/* ── Save template modal ─────────────────────────────── */}
        {showTemplateModal && (
            <div className={settingsStyles.modalOverlay} onClick={() => setShowTemplateModal(false)}>
                <div className={settingsStyles.modal} onClick={(e) => e.stopPropagation()}>
                    <div className={settingsStyles.modalIcon}><BookmarkPlus size={28} /></div>
                    <h3 className={settingsStyles.modalTitle}>Save as Template</h3>
                    <p className={settingsStyles.modalDesc}>Give this configuration a name so you can reuse it on future posts.</p>
                    <div className={settingsStyles.formGroup}>
                        <label className={settingsStyles.formLabel}>Template Name</label>
                        <input
                            className={settingsStyles.formInput}
                            placeholder="E.g., Product launch DM"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplateConfirm()}
                            autoFocus
                        />
                    </div>
                    <div className={settingsStyles.modalActions}>
                        <button className={settingsStyles.cancelBtn} onClick={() => setShowTemplateModal(false)}>Cancel</button>
                        <button
                            className={settingsStyles.modalPrimaryBtn}
                            onClick={handleSaveTemplateConfirm}
                            disabled={!templateName.trim()}
                        >
                            <BookmarkPlus size={14} /> Save Template
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
