'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Instagram, LogOut, Link as LinkIcon, RefreshCw } from 'lucide-react';
import styles from './ConnectedAccountBanner.module.css';

export default function ConnectedAccountBanner({ account }) {
    const router = useRouter();
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect this account? All synced posts and automations will be removed.')) return;
        setIsDisconnecting(true);
        try {
            const res = await fetch('/api/accounts/disconnect', { method: 'POST' });
            if (res.ok) {
                router.refresh();
            }
        } catch (err) {
            console.error('Disconnect failed:', err);
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/posts/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSyncResult(`✅ Synced ${data.synced} posts`);
                router.refresh();
            } else {
                setSyncResult(`❌ ${data.error}`);
            }
        } catch (err) {
            setSyncResult(`❌ Sync failed: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleConnectMore = (type) => {
        window.location.href = `/api/auth/meta/connect?type=${type}`;
    };

    const platformLabel = {
        instagram: 'Instagram',
        facebook: 'Facebook',
        both: 'Instagram + Facebook',
    };

    return (
        <div className={styles.banner}>
            <div className={styles.accountInfo}>
                <div className={styles.accountAvatar}>
                    {account.ig_profile_picture_url ? (
                        <img src={account.ig_profile_picture_url} alt="" />
                    ) : (
                        <Instagram size={20} />
                    )}
                </div>
                <div className={styles.accountDetails}>
                    <span className={styles.accountName}>
                        {account.ig_username
                            ? `@${account.ig_username}`
                            : account.fb_page_name || 'Connected Account'}
                    </span>
                    <span className={styles.accountPlatform}>
                        {platformLabel[account.platform] || account.platform} Connected
                    </span>
                </div>
            </div>

            <div className={styles.actions}>
                {/* Show option to connect the other platform */}
                {account.platform === 'facebook' && (
                    <button
                        className={styles.connectMoreBtn}
                        onClick={() => handleConnectMore('instagram')}
                    >
                        <Instagram size={14} />
                        Also Connect Instagram
                    </button>
                )}
                {account.platform === 'instagram' && (
                    <button
                        className={styles.connectMoreBtn}
                        onClick={() => handleConnectMore('facebook')}
                    >
                        <LinkIcon size={14} />
                        Also Connect Facebook
                    </button>
                )}

                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                >
                    <RefreshCw size={14} className={isSyncing ? styles.spinning : ''} />
                    {isSyncing ? 'Syncing...' : 'Sync Posts'}
                </button>

                <button
                    className={styles.disconnectBtn}
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                >
                    <LogOut size={14} />
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
            </div>

            {syncResult && (
                <div className={styles.syncResult}>
                    <span>{syncResult}</span>
                </div>
            )}
        </div>
    );
}
