'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Instagram, Check, ChevronRight, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './ConnectAccount.module.css';
import lightStyles from './ConnectAccount.light.module.css';

const CONNECTION_OPTIONS = [
    {
        id: 'instagram',
        title: 'Instagram Account',
        iconBg: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)',
        description: 'Reply to comments and DMs from your Instagram business account.',
        features: [
            'AutoDM on post, reel & story comments',
            'Story replies & mentions',
            'Welcome openers & follow gate',
            'Email lead capture',
            'A/B testing on every DM type',
        ],
        buttonLabel: 'Connect Instagram',
        buttonColor: '#E1306C',
        badge: { text: 'Recommended', variant: 'recommended' },
    },
    {
        id: 'facebook',
        title: 'Facebook Page',
        iconBg: '#1877F2',
        // Honest list of what actually works on FB. Rich DM types fall back
        // to plain text in send-dm.js, and Stories / Welcome Openers /
        // Follow Gate are Instagram-only, so we don't promise them here.
        description: 'Comment-triggered DMs from your Facebook Page (text replies only).',
        features: [
            'Comment-triggered text DMs',
            'Auto-reply on comments',
            'Keyword & global triggers',
            'A/B testing (text variants)',
        ],
        buttonLabel: 'Connect Facebook',
        buttonColor: '#1877F2',
        badge: { text: 'Limited features', variant: 'limited' },
    },
    {
        id: 'both',
        title: 'Instagram + Facebook',
        iconBg: 'linear-gradient(135deg, #1E293B, #334155)',
        description: 'Connect both for complete coverage across platforms.',
        features: [
            'Everything in Instagram + Facebook',
            'Single dashboard for both inboxes',
            'Cross-posted content auto-detection',
        ],
        buttonLabel: 'Coming soon',
        buttonColor: '#1E293B',
        badge: { text: 'Coming soon', variant: 'soon' },
        disabled: true,
    },
];

const ERROR_MESSAGES = {
    oauth_denied: 'You denied access. Please try again and grant the required permissions.',
    missing_params: 'Something went wrong. Please try connecting again.',
    invalid_state: 'Invalid session. Please try connecting again.',
    no_instagram_account: 'No Instagram Business account found. Make sure your Instagram account is a Business or Creator account linked to a Facebook Page.',
    no_facebook_page: 'No Facebook Page found. You need at least one Facebook Page to connect.',
    save_failed: 'Failed to save your account. Please try again.',
    oauth_failed: 'Connection failed. Please try again.',
};

export default function ConnectAccount() {
    const styles = useStyles(darkStyles, lightStyles);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [errorMessage, setErrorMessage] = useState('');
    const [isConnecting, setIsConnecting] = useState('');

    useEffect(() => {
        const error = searchParams.get('error');
        const message = searchParams.get('message');
        if (error) {
            setErrorMessage(ERROR_MESSAGES[error] || message || 'An unknown error occurred.');
        }
        const connected = searchParams.get('connected');
        if (connected) {
            router.refresh();
        }
    }, [searchParams, router]);

    const handleConnect = (connectionType) => {
        setIsConnecting(connectionType);
        setErrorMessage('');
        window.location.href = `/api/auth/meta/connect?type=${connectionType}`;
    };

    return (
        <div className={styles.container}>
            {/* Hero Section */}
            <div className={styles.hero}>
                <div className={styles.heroIconGroup}>
                    <div className={`${styles.heroIcon} ${styles.heroIconInstagram}`}>
                        <Instagram size={24} color="white" />
                    </div>
                    <div className={styles.heroConnector} />
                    <div className={`${styles.heroIcon} ${styles.heroIconFacebook}`}>
                        <span style={{ color: 'white', fontWeight: 800, fontSize: '1.5rem', fontFamily: 'Arial' }}>f</span>
                    </div>
                </div>

                <div className={styles.header}>
                    <h1 className={styles.title}>Connect Your Account</h1>
                    <p className={styles.subtitle}>
                        Choose how you want to connect. Each option enables different automation features.
                    </p>
                </div>
            </div>

            {/* Step Indicator */}
            <div className={styles.steps}>
                <div className={`${styles.step} ${styles.activeStep}`}>
                    <span className={styles.stepNumber}>1</span>
                    Choose Platform
                </div>
                <ChevronRight size={14} className={styles.stepArrow} />
                <div className={styles.step}>
                    <span className={styles.stepNumber}>2</span>
                    Authorize
                </div>
                <ChevronRight size={14} className={styles.stepArrow} />
                <div className={styles.step}>
                    <span className={styles.stepNumber}>3</span>
                    Start Automating
                </div>
            </div>

            {errorMessage && (
                <div className={styles.errorBanner}>
                    <p>{errorMessage}</p>
                </div>
            )}

            {/* Platform Cards */}
            <div className={styles.cards}>
                {CONNECTION_OPTIONS.map((option) => (
                    <div
                        key={option.id}
                        className={`${styles.card} ${option.disabled ? styles.cardDisabled : ''}`}
                    >
                        {option.badge && (
                            <span className={`${styles.cardBadge} ${styles[`cardBadge_${option.badge.variant}`]}`}>
                                {option.badge.text}
                            </span>
                        )}
                        <div className={styles.cardHeader}>
                            <div
                                className={styles.cardIcon}
                                style={{ background: option.iconBg }}
                            >
                                {option.id === 'facebook' ? (
                                    <span className={styles.fbIcon}>f</span>
                                ) : option.id === 'instagram' ? (
                                    <Instagram size={20} color="white" />
                                ) : (
                                    <span style={{ color: 'white', fontSize: '1rem' }}>⚡</span>
                                )}
                            </div>
                            <h3 className={styles.cardTitle}>{option.title}</h3>
                        </div>

                        <p className={styles.cardDesc}>{option.description}</p>

                        <ul className={styles.featureList}>
                            {option.features.map((feature) => (
                                <li key={feature} className={styles.featureItem}>
                                    <Check size={14} className={styles.featureCheckIcon} />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button
                            className={styles.connectBtn}
                            style={option.disabled ? undefined : { backgroundColor: option.buttonColor }}
                            onClick={() => !option.disabled && handleConnect(option.id)}
                            disabled={!!isConnecting || option.disabled}
                            title={option.disabled ? 'This option is not available yet' : undefined}
                        >
                            {isConnecting === option.id ? 'Connecting...' : option.buttonLabel}
                        </button>
                    </div>
                ))}
            </div>

            {/* Trust Footer */}
            <div className={styles.footer}>
                <span className={styles.partnerText}>
                    <Shield size={14} />
                    Official Meta Business Partner since 2026
                </span>
                <div className={styles.footerBadges}>
                    <div className={styles.badge}>
                        <span className={styles.metaLogo}>Ⓜ</span>
                        <div>
                            <span className={styles.badgeTitle}>Meta</span>
                            <span className={styles.badgeSub}>Business Partner</span>
                        </div>
                    </div>
                    <div className={styles.badge}>
                        <span className={styles.metaLogo}>Ⓜ</span>
                        <div>
                            <span className={styles.badgeTitle}>Meta</span>
                            <span className={styles.badgeSub}>Tech Provider</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
