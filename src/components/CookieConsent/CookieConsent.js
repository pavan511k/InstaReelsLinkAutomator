'use client';

import { useState, useEffect } from 'react';
import styles from './CookieConsent.module.css';

const COOKIE_CONSENT_KEY = 'autodm_cookie_consent';

export default function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [preferences, setPreferences] = useState({
        essential: true, // Always required — cannot be disabled
        analytics: false,
    });

    useEffect(() => {
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!consent) {
            // Small delay so it doesn't flash immediately on load
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAcceptAll = () => {
        setPreferences({ essential: true, analytics: true });
        saveConsent({ essential: true, analytics: true });
    };

    const handleAcceptEssential = () => {
        saveConsent({ essential: true, analytics: false });
    };

    const handleSavePreferences = () => {
        saveConsent(preferences);
    };

    const saveConsent = (prefs) => {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
            ...prefs,
            timestamp: new Date().toISOString(),
        }));
        setIsVisible(false);
        setShowPreferences(false);
    };

    if (!isVisible) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.banner}>
                <div className={styles.content}>
                    <h3 className={styles.title}>🍪 Cookie Preferences</h3>
                    <p className={styles.description}>
                        We use essential cookies for authentication and session management.
                        These are required for the app to function.
                        We do not use advertising or third-party tracking cookies.
                    </p>

                    {showPreferences && (
                        <div className={styles.preferences}>
                            <label className={styles.preferenceItem}>
                                <input
                                    type="checkbox"
                                    checked={preferences.essential}
                                    disabled
                                    className={styles.checkbox}
                                />
                                <div>
                                    <span className={styles.prefLabel}>Essential Cookies</span>
                                    <span className={styles.prefRequired}>Required</span>
                                    <p className={styles.prefDesc}>
                                        Session management and authentication via Supabase Auth.
                                        These cookies are necessary for the app to work.
                                    </p>
                                </div>
                            </label>
                            <label className={styles.preferenceItem}>
                                <input
                                    type="checkbox"
                                    checked={preferences.analytics}
                                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                                    className={styles.checkbox}
                                />
                                <div>
                                    <span className={styles.prefLabel}>Analytics Cookies</span>
                                    <span className={styles.prefOptional}>Optional</span>
                                    <p className={styles.prefDesc}>
                                        Help us understand how you use the app so we can improve it.
                                        Currently not in use.
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>

                <div className={styles.actions}>
                    {!showPreferences ? (
                        <>
                            <button className={styles.customizeBtn} onClick={() => setShowPreferences(true)}>
                                Customize
                            </button>
                            <button className={styles.essentialBtn} onClick={handleAcceptEssential}>
                                Essential Only
                            </button>
                            <button className={styles.acceptBtn} onClick={handleAcceptAll}>
                                Accept All
                            </button>
                        </>
                    ) : (
                        <>
                            <button className={styles.essentialBtn} onClick={() => setShowPreferences(false)}>
                                Back
                            </button>
                            <button className={styles.acceptBtn} onClick={handleSavePreferences}>
                                Save Preferences
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
