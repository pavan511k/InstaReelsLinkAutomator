'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import styles from './TriggerSetupTab.module.css';

export default function TriggerSetupTab({ config, onChange }) {
    const [inputValue, setInputValue] = useState('');

    const updateConfig = (updates) => {
        onChange({ ...config, ...updates });
    };

    const addKeyword = () => {
        const keyword = inputValue.trim();
        if (!keyword || config.keywords.includes(keyword)) return;
        updateConfig({ keywords: [...config.keywords, keyword] });
        setInputValue('');
    };

    const removeKeyword = (keyword) => {
        updateConfig({ keywords: config.keywords.filter((k) => k !== keyword) });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword();
        }
    };

    return (
        <div className={styles.tab}>
            {/* Trigger Type */}
            <div className="form-group">
                <label className="form-label">Trigger Type</label>
                <select className="form-input" value={config.type} onChange={(e) => updateConfig({ type: e.target.value })}>
                    <option value="keywords">Keywords</option>
                    <option value="all_comments">All Comments</option>
                    <option value="emojis_only">Emojis Only</option>
                    <option value="mentions_only">@Mentions Only</option>
                </select>
            </div>

            {/* Keyword Triggers — only shown when type is 'keywords' */}
            {config.type === 'keywords' && (
                <div className="form-group">
                    <label className="form-label">Keyword Triggers</label>
                    <div className={styles.tagInput}>
                        <div className={styles.tags}>
                            {config.keywords.map((keyword) => (
                                <span key={keyword} className="tag">
                                    {keyword}
                                    <button
                                        className="tag-remove"
                                        onClick={() => removeKeyword(keyword)}
                                        aria-label={`Remove ${keyword}`}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            className={styles.tagField}
                            placeholder="Type a keyword and press Enter..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <p className={styles.helperText}>
                        Save each trigger keyword by pressing the ENTER or RETURN key
                    </p>
                </div>
            )}

            {/* Trigger Settings */}
            <div className={styles.settings}>
                <h4 className={styles.settingsTitle}>Settings</h4>

                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={config.excludeKeywords}
                        onChange={(e) => updateConfig({ excludeKeywords: e.target.checked })}
                    />
                    <div>
                        <span className={styles.checkText}>Exclude Keywords</span>
                        <p className={styles.checkDesc}>DM everyone except those who comment with these keywords</p>
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
                        <span className={styles.checkText}>Send once per user/per post</span>
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
