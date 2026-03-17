'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import styles from './TriggerSetupTab.module.css';

export default function TriggerSetupTab({ config, onChange }) {
    const [inputValue, setInputValue] = useState('');

    const updateConfig = (updates) => onChange({ ...config, ...updates });

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
                <select
                    className={styles.select}
                    value={config.type}
                    onChange={(e) => updateConfig({ type: e.target.value })}
                >
                    <option value="keywords">Keywords</option>
                    <option value="all_comments">All Comments</option>
                    <option value="emojis_only">Emojis Only</option>
                    <option value="mentions_only">@Mentions Only</option>
                </select>
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
                        Press Enter to add each keyword. Your account-wide default keywords from
                        {' '}<a href="/settings" style={{ color: '#A78BFA', textDecoration: 'none' }}>Settings → Configuration</a>{' '}
                        are automatically merged in at runtime.
                    </p>
                </div>
            )}

            {/* Settings */}
            <div className={styles.settings}>
                <p className={styles.settingsTitle}>Settings</p>

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
            </div>

        </div>
    );
}
