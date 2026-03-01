'use client';

import { Instagram, Film } from 'lucide-react';
import styles from './PostCard.module.css';

export default function PostCard({ post, onSetupDM, onSkip }) {
    const isReel = post.mediaType === 'VIDEO' || post.mediaType === 'REEL';
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
                        <Instagram size={24} />
                    </div>
                )}
                {isReel && (
                    <span className={styles.reelBadge}>
                        <Film size={12} />
                    </span>
                )}
                <span className={styles.platformBadge}>
                    <Instagram size={12} />
                </span>
            </div>

            <div className={styles.cardBody}>
                <p className={styles.caption}>{truncatedCaption || 'No caption'}</p>
                <span className={styles.timestamp}>{post.timestamp}</span>
            </div>

            <div className={styles.cardActions}>
                <button
                    className={styles.setupBtn}
                    onClick={() => onSetupDM?.(post)}
                >
                    ✏️ Setup LinkDM
                </button>
                <button
                    className={styles.skipBtn}
                    onClick={() => onSkip?.(post)}
                >
                    Skip
                </button>
            </div>
        </div>
    );
}
