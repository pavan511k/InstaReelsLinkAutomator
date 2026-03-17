'use client';

import { Calendar, Clock, CalendarClock, ArrowRight } from 'lucide-react';
import styles from './SettingsTab.module.css';

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

export default function SettingsTab({ config, onChange }) {
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

            {/* ── Flow Logic ────────────────────────────────────── */}
            <div className={styles.settingGroup}>
                <p className={styles.groupTitle}>Flow Logic</p>
                <label className={`${styles.checkboxLabel} ${styles.proFeature}`}>
                    <input type="checkbox" className={styles.checkbox} disabled />
                    <div>
                        <span className={styles.checkText}>
                            Flow Automation
                            <span className={styles.proBadge}>Pro</span>
                        </span>
                        <p className={styles.checkDesc}>
                            Create multi-step automation flows with conditional logic
                        </p>
                    </div>
                </label>
            </div>

        </div>
    );
}
