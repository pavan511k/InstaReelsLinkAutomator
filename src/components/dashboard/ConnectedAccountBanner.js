'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Instagram, Facebook, LogOut, RefreshCw, Plus } from 'lucide-react';
import styles from './ConnectedAccountBanner.module.css';

export default function ConnectedAccountBanner({ accounts = [], connectedPlatforms = [] }) {
    const router = useRouter();
    const [syncingId, setSyncingId] = useState(null);
    const [disconnectingId, setDisconnectingId] = useState(null);
    const [syncResults, setSyncResults] = useState({});

    const handleDisconnect = async (accountId) => {
        if (!confirm('Disconnect this account? Your posts and automations will be preserved.')) return;
        setDisconnectingId(accountId);
        try {
            const res = await fetch('/api/accounts/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId }),
            });
            if (res.ok) {
                router.refresh();
            }
        } catch (err) {
            console.error('Disconnect failed:', err);
        } finally {
            setDisconnectingId(null);
        }
    };

    const handleSync = async (accountId) => {
        setSyncingId(accountId);
        setSyncResults((prev) => ({ ...prev, [accountId]: null }));
        try {
            const res = await fetch('/api/posts/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSyncResults((prev) => ({ ...prev, [accountId]: `✅ Synced ${data.synced} posts` }));
                router.refresh();
            } else {
                setSyncResults((prev) => ({ ...prev, [accountId]: `❌ ${data.error}` }));
            }
        } catch (err) {
            setSyncResults((prev) => ({ ...prev, [accountId]: `❌ Sync failed: ${err.message}` }));
        } finally {
            setSyncingId(null);
        }
    };

    const handleConnect = (type) => {
        window.location.href = `/api/auth/meta/connect?type=${type}`;
    };

    const hasFacebook = connectedPlatforms.includes('facebook') || connectedPlatforms.includes('both');
    const hasInstagram = connectedPlatforms.includes('instagram') || connectedPlatforms.includes('both');

    const getPlatformIcon = (platform) => {
        if (platform === 'instagram') return <Instagram size={18} />;
        if (platform === 'facebook') return <Facebook size={18} />;
        return <Instagram size={18} />;
    };

    const getPlatformLabel = (platform) => {
        if (platform === 'instagram') return 'Instagram';
        if (platform === 'facebook') return 'Facebook';
        if (platform === 'both') return 'Instagram + Facebook';
        return platform;
    };

    return (
        <div className={styles.container}>
            {/* Account rows */}
            {accounts.map((account) => (
                <div key={account.id} className={styles.banner}>
                    <div className={styles.accountInfo}>
                        <div className={`${styles.accountAvatar} ${styles[`avatar_${account.platform}`]}`}>
                            {account.ig_profile_picture_url ? (
                                <img src={account.ig_profile_picture_url} alt="" />
                            ) : (
                                getPlatformIcon(account.platform)
                            )}
                        </div>
                        <div className={styles.accountDetails}>
                            <span className={styles.accountName}>
                                {account.ig_username
                                    ? `@${account.ig_username}`
                                    : account.fb_page_name || 'Connected Account'}
                            </span>
                            <span className={`${styles.accountPlatform} ${styles[`platform_${account.platform}`]}`}>
                                {getPlatformIcon(account.platform)}
                                {getPlatformLabel(account.platform)} Connected
                            </span>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSync(account.id)}
                            disabled={syncingId === account.id}
                        >
                            <RefreshCw size={14} className={syncingId === account.id ? styles.spinning : ''} />
                            {syncingId === account.id ? 'Syncing...' : 'Sync Posts'}
                        </button>

                        <button
                            className={styles.disconnectBtn}
                            onClick={() => handleDisconnect(account.id)}
                            disabled={disconnectingId === account.id}
                        >
                            <LogOut size={14} />
                            {disconnectingId === account.id ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    </div>

                    {syncResults[account.id] && (
                        <div className={styles.syncResult}>
                            <span>{syncResults[account.id]}</span>
                        </div>
                    )}
                </div>
            ))}

            {/* Connect more platforms */}
            <div className={styles.connectMore}>
                {!hasInstagram && (
                    <button className={styles.connectMoreBtn} onClick={() => handleConnect('instagram')}>
                        <Instagram size={14} />
                        Connect Instagram
                    </button>
                )}
                {!hasFacebook && (
                    <button className={styles.connectMoreBtn} onClick={() => handleConnect('facebook')}>
                        <Facebook size={14} />
                        Connect Facebook
                    </button>
                )}
                {hasInstagram && hasFacebook && (
                    <span className={styles.allConnected}>
                        <Plus size={14} />
                        All platforms connected
                    </span>
                )}
            </div>
        </div>
    );
}
