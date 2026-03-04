'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Instagram, Link2, Loader2, Check, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './ConnectAccount.module.css';

const CONNECTION_OPTIONS = [
    {
        id: 'instagram',
        title: 'Instagram Account',
        iconBg: '#E1306C',
        cardClass: 'cardInstagram',
        description: 'Reply to comments and DMs from your Instagram business account.',
        features: [
            'AutoDM on Instagram post, reel & story comments',
            'Inbox automation for Instagram DMs',
        ],
        buttonLabel: 'Connect Instagram',
        buttonColor: '#E1306C',
    },
    {
        id: 'facebook',
        title: 'Facebook Page',
        iconBg: '#1877F2',
        cardClass: 'cardFacebook',
        description: 'Reply to comments and DMs from your Facebook Page.',
        features: [
            'AutoDM on Facebook post, reel & story comments',
            'Inbox automation for Facebook DMs',
        ],
        buttonLabel: 'Connect Facebook',
        buttonColor: '#1877F2',
    },
    {
        id: 'both',
        title: 'Instagram + Facebook',
        iconBg: '#1A1A2E',
        cardClass: 'cardBoth',
        recommended: true,
        description: 'Connect both your Instagram account and Facebook Page for complete coverage and easier management.',
        features: [
            'AutoDM on Instagram and Facebook post, reel & story comments',
            'AutoDM on cross-posted content',
        ],
        buttonLabel: 'Connect Both',
        buttonColor: '#1A1A2E',
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
        // Redirect to our API endpoint which builds the OAuth URL
        window.location.href = `/api/auth/meta/connect?type=${connectionType}`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerIcon}>
                    <Link2 size={28} color="white" strokeWidth={2} />
                </div>
                <h1 className={styles.title}>Connect Your Account</h1>
                <p className={styles.subtitle}>
                    Choose how you want to connect. Each option enables different features and requires different permissions.
                </p>
            </div>

            {errorMessage && (
                <div className={styles.errorBanner}>
                    <p>{errorMessage}</p>
                </div>
            )}

            <div className={styles.cards}>
                {CONNECTION_OPTIONS.map((option) => (
                    <div key={option.id} className={`${styles.card} ${styles[option.cardClass]}`}>
                        {option.recommended && (
                            <div className={styles.recommendedBadge}>Recommended</div>
                        )}
                        <div className={styles.cardHeader}>
                            <div
                                className={styles.cardIcon}
                                style={{ backgroundColor: option.iconBg }}
                            >
                                {option.id === 'facebook' ? (
                                    <span className={styles.fbIcon}>f</span>
                                ) : option.id === 'instagram' ? (
                                    <Instagram size={22} color="white" />
                                ) : (
                                    <span className={styles.bothIcon}>🔗</span>
                                )}
                            </div>
                            <h3 className={styles.cardTitle}>{option.title}</h3>
                        </div>

                        <p className={styles.cardDesc}>{option.description}</p>

                        <ul className={styles.featureList}>
                            {option.features.map((feature) => (
                                <li key={feature} className={styles.featureItem}>
                                    <Check size={14} color="var(--color-ig-pink)" className={styles.checkIcon} />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button
                            className={styles.connectBtn}
                            style={{ backgroundColor: option.buttonColor }}
                            onClick={() => handleConnect(option.id)}
                            disabled={!!isConnecting}
                        >
                            {isConnecting === option.id ? (
                                <>
                                    <Loader2 size={16} className={styles.spinner} />
                                    Connecting...
                                </>
                            ) : option.buttonLabel}
                        </button>
                    </div>
                ))}
            </div>

            <div className={styles.footer}>
                <div className={styles.footerLeft}>
                    <span className={styles.partnerText}>
                        <ShieldCheck size={16} color="var(--color-ig-pink)" />
                        Secure connection via Meta Business Platform
                    </span>
                </div>
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
