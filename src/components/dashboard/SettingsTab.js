'use client';

import styles from './SettingsTab.module.css';

export default function SettingsTab({ config, onChange }) {
    const updateConfig = (updates) => {
        onChange({ ...config, ...updates });
    };

    return (
        <div className={styles.tab}>
            {/* Send Delay */}
            <div className={styles.settingGroup}>
                <h4 className={styles.groupTitle}>Send Delay</h4>
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
                            Add a random delay (30s-2min) before sending the DM to appear more natural
                        </p>
                    </div>
                </label>
            </div>

            {/* Trigger Controls */}
            <div className={styles.settingGroup}>
                <h4 className={styles.groupTitle}>Trigger Controls</h4>
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
                            Only use post-specific triggers instead of universal triggers
                        </p>
                    </div>
                </label>

                <div className={styles.checkboxGroup}>
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={config.commentAutoReply}
                            onChange={(e) => updateConfig({ commentAutoReply: e.target.checked })}
                        />
                        <div>
                            <span className={styles.checkText}>Comment Auto-Reply</span>
                            <p className={styles.checkDesc}>
                                Automatically reply to the user's comment in addition to sending a DM
                            </p>
                        </div>
                    </label>
                    {config.commentAutoReply && (
                        <div className={styles.nestedInput}>
                            <textarea
                                className="form-input"
                                placeholder="E.g., Sent you a DM! Check your requests."
                                value={config.replyMessage || ''}
                                onChange={(e) => updateConfig({ replyMessage: e.target.value })}
                                rows={2}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Flow Logic */}
            <div className={styles.settingGroup}>
                <h4 className={styles.groupTitle}>Flow Logic</h4>
                <label className={`${styles.checkboxLabel} ${styles.proFeature}`}>
                    <input type="checkbox" className={styles.checkbox} disabled />
                    <div>
                        <span className={styles.checkText}>
                            Flow Automation
                            <span className="badge badge-pro" style={{ marginLeft: '8px' }}>Pro</span>
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
