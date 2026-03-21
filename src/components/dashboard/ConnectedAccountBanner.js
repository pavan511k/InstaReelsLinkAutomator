'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Instagram, Facebook, LogOut, RefreshCw } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './ConnectedAccountBanner.module.css';
import lightStyles from './ConnectedAccountBanner.light.module.css';
import DisconnectModal from './DisconnectModal';

export default function ConnectedAccountBanner({ accounts = [], connectedPlatforms = [] }) {
    const router = useRouter();
    const styles = useStyles(darkStyles, lightStyles);
    const [syncingId, setSyncingId] = useState(null);
    const [disconnectingId, setDisconnectingId] = useState(null);
    const [syncResults, setSyncResults] = useState({});
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [disconnectTargetId, setDisconnectTargetId] = useState(null);

    const initiateDisconnect = (accountId) => {
        setDisconnectTargetId(accountId);
        setShowDisconnectModal(true);
    };

    const handleDisconnectConfirm = async () => {
        if (!disconnectTargetId) return;
        setShowDisconnectModal(false);
        setDisconnectingId(disconnectTargetId);
        try {
            const res = await fetch('/api/accounts/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: disconnectTargetId }),
            });
            if (res.ok) {
                window.location.reload();
            }
        } catch (err) {
            console.error('Disconnect failed:', err);
        } finally {
            setDisconnectingId(null);
            setDisconnectTargetId(null);
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
        <>
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
                                <span className={styles.accountStatus}>
                                    Securely Connected
                                </span>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <button
                                className={styles.syncBtn}
                                onClick={() => handleSync(account.id)}
                                disabled={syncingId === account.id}
                            >
                                <RefreshCw size={14} className={syncingId === account.id ? styles.spinning : ''} />
                                {syncingId === account.id ? 'Syncing...' : 'Sync posts'}
                            </button>

                            <button
                                className={styles.disconnectBtn}
                                onClick={() => initiateDisconnect(account.id)}
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
            </div>

            <DisconnectModal
                isOpen={showDisconnectModal}
                onClose={() => { setShowDisconnectModal(false); setDisconnectTargetId(null); }}
                onConfirm={handleDisconnectConfirm}
                isDisconnecting={disconnectingId !== null}
            />
        </>
    );
}
