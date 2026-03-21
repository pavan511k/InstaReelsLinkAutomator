'use client';

import { createPortal } from 'react-dom';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';

/**
 * DisconnectModal — rendered via portal so backdrop-filter blurs the
 * entire viewport, not just the nearest stacking context ancestor.
 */
export default function DisconnectModal({ isOpen, onClose, onConfirm, isDisconnecting }) {
    const styles = useStyles(darkStyles, lightStyles);
    if (!isOpen) return null;

    return createPortal(
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalIcon}>
                    <AlertTriangle size={32} />
                </div>
                <h3 className={styles.modalTitle}>Disconnect this account?</h3>
                <p className={styles.modalDesc}>
                    Per <strong>Meta policy</strong>, disconnecting will permanently delete all Platform Data
                    fetched from Instagram/Facebook:
                </p>
                <ul className={styles.deleteList}>
                    <li>All synced posts, reels, and stories</li>
                    <li>Profile info, usernames, and media data</li>
                    <li>Stored access tokens</li>
                </ul>
                <p className={styles.modalDesc}>
                    Your <strong>DM automation configurations</strong> will be preserved (paused) and can
                    be reactivated if you reconnect later.
                </p>
                <div className={styles.modalActions}>
                    <button
                        className={styles.cancelBtn}
                        onClick={onClose}
                        disabled={isDisconnecting}
                    >
                        Cancel
                    </button>
                    <button
                        className={styles.confirmDeleteBtn}
                        onClick={onConfirm}
                        disabled={isDisconnecting}
                    >
                        <LogOut size={14} />
                        {isDisconnecting ? 'Disconnecting...' : 'Yes, disconnect'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
