'use client';

import { Instagram, Facebook, Film, Pencil, CheckCircle2, PauseCircle } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './PostCard.module.css';
import lightStyles from './PostCard.light.module.css';

export default function PostCard({ post, onSetupDM, onSkip }) {
    const styles = useStyles(darkStyles, lightStyles);
    const isReel = post.mediaType === 'VIDEO' || post.mediaType === 'REEL';
    const isFacebook = post.platform === 'facebook';
    const truncatedCaption = post.caption?.length > 60
        ? post.caption.substring(0, 60) + '...'
        : post.caption || '';

    return (
        <div className={styles.card}>
            <div className={styles.thumbnailWrapper}>
                {post.thumbnailUrl ? (
                    <img
                        src={post.thumbnailUrl}
                        alt={truncatedCaption}
                        className={styles.thumbnail}
                        loading="lazy"
                    />
                ) : (
                    <div className={styles.thumbnailPlaceholder}>
                        {isFacebook ? <Facebook size={24} /> : <Instagram size={24} />}
                    </div>
                )}
                {isReel && (
                    <span className={styles.reelBadge}>
                        <Film size={12} />
                    </span>
                )}
                <span className={`${styles.platformBadge} ${isFacebook ? styles.platformBadgeFacebook : ''}`}>
                    {isFacebook ? <Facebook size={12} /> : <Instagram size={12} />}
                </span>
            </div>

            <div className={styles.cardBody}>
                <p className={styles.caption}>{truncatedCaption || 'No caption'}</p>
                <span className={styles.timestamp}>{post.timestamp}</span>
            </div>

            <div className={styles.cardActions}>
                {post.status === 'setup' && (
                    <button
                        className={styles.setupBtn}
                        onClick={() => onSetupDM?.(post)}
                    >
                        <Pencil size={14} /> Configure AutoDM
                    </button>
                )}
                {post.status === 'active' && (
                    <button
                        className={`${styles.setupBtn} ${styles.activeBtn}`}
                        onClick={() => onSetupDM?.(post)}
                    >
                        <CheckCircle2 size={14} /> Edit AutoDM
                    </button>
                )}
                {post.status === 'paused' && (
                    <button
                        className={`${styles.setupBtn} ${styles.pausedBtn}`}
                        onClick={() => onSetupDM?.(post)}
                    >
                        <PauseCircle size={14} /> Resume AutoDM
                    </button>
                )}
            </div>
        </div>
    );
}
