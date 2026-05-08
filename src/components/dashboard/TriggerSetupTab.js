'use client';

import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import Select from '@/components/ui/Select';
import darkStyles from './TriggerSetupTab.module.css';
import lightStyles from './TriggerSetupTab.light.module.css';

// Plain-language description shown directly under the trigger-type
// dropdown so users can see what each option fires on without trial-and-
// error. Keep these in sync with the matchers in
// src/app/api/webhooks/instagram/route.js (processAutomationForComment).
const TRIGGER_DESCRIPTIONS = {
    keywords:      'Fires when a comment contains any of your keywords. Match is case-insensitive and substring-based ("art" also matches "party").',
    all_comments:  'Fires on every new comment on this post. Combine with the rate limit in Settings if you expect heavy traffic.',
    emojis_only:   'Fires only when the entire comment is emojis (with optional spaces or punctuation). Examples that match: "🔥", "❤️🔥", "🎉!". Examples that don’t: "🔥 link", "1 🔥", "thanks 🙌".',
    mentions_only: 'Fires when the comment contains an @mention of any user.',
};

const TRIGGER_OPTIONS = [
    { value: 'keywords',      label: 'Keywords',       desc: 'Match specific words or phrases' },
    { value: 'all_comments',  label: 'All Comments',   desc: 'Fire on every new comment' },
    { value: 'emojis_only',   label: 'Emojis Only',    desc: 'Fire on emoji-only reactions' },
    { value: 'mentions_only', label: '@Mentions Only', desc: 'Fire when a comment @-tags someone' },
];

export default function TriggerSetupTab({ config, onChange, settings = {}, onSettingsChange = () => {} }) {
    const styles = useStyles(darkStyles, lightStyles);
    const [inputValue, setInputValue] = useState('');
    /* Auto-open the Advanced section if any of its options are already
       turned on — otherwise a user editing an existing automation
       wouldn't see why their trigger was behaving differently. */
    const advancedActive = !!config.excludeKeywords || !!config.excludeMentions;
    const [showAdvanced, setShowAdvanced] = useState(advancedActive);

    const updateConfig = (updates) => onChange({ ...config, ...updates });
    const updateSettings = (updates) => onSettingsChange({ ...settings, ...updates });

    const addKeyword = () => {
        const kw = inputValue.trim();
        if (!kw || config.keywords.includes(kw)) return;
        updateConfig({ keywords: [...config.keywords, kw] });
        setInputValue('');
    };

    const removeKeyword = (kw) => updateConfig({ keywords: config.keywords.filter((k) => k !== kw) });

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addKeyword(); }
    };

    return (
        <div className={styles.tab}>

            {/* Trigger type */}
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>Trigger Type</label>
                <Select
                    value={config.type}
                    onChange={(value) => updateConfig({ type: value })}
                    options={TRIGGER_OPTIONS}
                    aria-label="Trigger type"
                />
                {TRIGGER_DESCRIPTIONS[config.type] && (
                    <p className={styles.helperText}>{TRIGGER_DESCRIPTIONS[config.type]}</p>
                )}
            </div>

            {/* Keyword input */}
            {config.type === 'keywords' && (
                <div className={styles.formGroup}>
                    <div className={styles.keywordLabelRow}>
                        <label className={styles.formLabel}>Keyword Triggers</label>
                        <a href="/settings" className={styles.defaultKeywordsHint}>
                            View default keywords →
                        </a>
                    </div>
                    <div className={styles.tagInput}>
                        {config.keywords.length > 0 && (
                            <div className={styles.tags}>
                                {config.keywords.map((kw) => (
                                    <span key={kw} className={styles.tag}>
                                        {kw}
                                        <button
                                            className={styles.tagRemove}
                                            onClick={() => removeKeyword(kw)}
                                            aria-label={`Remove ${kw}`}
                                        >
                                            <X size={11} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <input
                            className={styles.tagField}
                            placeholder="Type a keyword and press Enter..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <p className={styles.helperText}>
                        Account-wide default keywords from
                        {' '}<a href="/settings" style={{ color: '#A78BFA', textDecoration: 'none' }}>Settings → Configuration</a>{' '}
                        are automatically merged in at runtime.
                    </p>
                </div>
            )}

            {/* Settings — sendOncePerUser stays visible (most users keep
                it on, default true). The two niche switches are collapsed
                behind an "Advanced" toggle so the trigger pane reads as
                three steps (type → keywords → primary setting), not five. */}
            <div className={styles.settings}>
                <p className={styles.settingsTitle}>Settings</p>

                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={config.sendOncePerUser}
                        onChange={(e) => updateConfig({ sendOncePerUser: e.target.checked })}
                    />
                    <div>
                        <span className={styles.checkText}>Send once per user / per post</span>
                        <p className={styles.checkDesc}>Prevents duplicate DMs to the same user on the same post</p>
                    </div>
                </label>

                {/* Advanced trigger options — collapsed by default. */}
                <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className={styles.advancedToggle}
                    aria-expanded={showAdvanced}
                >
                    <span>
                        Advanced trigger options
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
                        {/* Only meaningful when matching against a keyword list. */}
                        {config.type === 'keywords' && (
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    checked={config.excludeKeywords}
                                    onChange={(e) => updateConfig({ excludeKeywords: e.target.checked })}
                                />
                                <div>
                                    <span className={styles.checkText}>Exclude Keywords</span>
                                    <p className={styles.checkDesc}>DM everyone except those who use these keywords</p>
                                </div>
                            </label>
                        )}

                        {/* Hidden for 'mentions_only' — combining the two would
                            cancel the trigger out. */}
                        {config.type !== 'mentions_only' && (
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    checked={config.excludeMentions}
                                    onChange={(e) => updateConfig({ excludeMentions: e.target.checked })}
                                />
                                <div>
                                    <span className={styles.checkText}>Exclude @Mentions</span>
                                    <p className={styles.checkDesc}>Ignores comments that are replies to other users</p>
                                </div>
                            </label>
                        )}
                    </div>
                )}
            </div>

            {/* Comment Auto-Reply — lives here (next to the trigger config)
                rather than in the Settings tab because it's the public
                response to the trigger event, not an orchestration setting.
                Persists in settings_config (commentReplyEnabled / replyMessage)
                so it stays compatible with existing rows. */}
            <div className={styles.commentReplyCard}>
                <div className={styles.commentReplyHeader}>
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💬</span>
                    <div style={{ flex: 1 }}>
                        <span className={styles.checkText} style={{ display: 'block', marginBottom: 3 }}>Comment Auto-Reply</span>
                        <p className={styles.checkDesc}>
                            Reply publicly to the triggering comment after sending the DM.
                            Turn off if you’d rather not surface the trigger to non-followers
                            (e.g. on Follow-Gate automations). Leave the message blank to use
                            the default.
                        </p>
                    </div>
                    <div
                        className={`${styles.toggle} ${settings.commentReplyEnabled !== false ? styles.toggleOn : ''}`}
                        onClick={() => updateSettings({
                            commentReplyEnabled: settings.commentReplyEnabled === false,
                        })}
                        role="switch"
                        aria-checked={settings.commentReplyEnabled !== false}
                    >
                        <div className={styles.toggleThumb} />
                    </div>
                </div>
                {settings.commentReplyEnabled !== false && (
                    <textarea
                        className={styles.textarea}
                        placeholder="Hey! Just sent you a DM 📩 — check your inbox."
                        value={settings.replyMessage || ''}
                        onChange={(e) => updateSettings({ replyMessage: e.target.value })}
                        rows={2}
                    />
                )}
            </div>

        </div>
    );
}
