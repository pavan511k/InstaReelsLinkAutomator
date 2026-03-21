'use client';

import { Instagram, Film } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './TopPosts.module.css';
import lightStyles from './TopPosts.light.module.css';

export default function TopPosts({ posts = [] }) {
    const styles = useStyles(darkStyles, lightStyles);

    if (!posts.length) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>📊</div>
                <p className={styles.emptyTitle}>No data yet</p>
                <p className={styles.emptyDesc}>Top posts will appear once your automations start sending DMs.</p>
            </div>
        );
    }

    const maxCount = posts[0].count;

    return (
        <div className={styles.list}>
            {posts.map((post, index) => {
                const barWidth = maxCount > 0 ? (post.count / maxCount) * 100 : 0;
                const isReel   = post.mediaType === 'VIDEO' || post.mediaType === 'REEL';
                const caption  = post.caption?.length > 38
                    ? post.caption.slice(0, 38) + '…'
                    : post.caption || 'No caption';

                return (
                    <div key={post.id} className={styles.row}>
                        {/* Rank */}
                        <span className={styles.rank}>#{index + 1}</span>

                        {/* Thumbnail */}
                        <div className={styles.thumb}>
                            {post.thumbnailUrl ? (
                                <img src={post.thumbnailUrl} alt="" />
                            ) : (
                                <div className={styles.thumbPlaceholder}>
                                    <Instagram size={12} />
                                </div>
                            )}
                            {isReel && (
                                <span className={styles.reelPip}><Film size={8} /></span>
                            )}
                        </div>

                        {/* Caption + bar */}
                        <div className={styles.info}>
                            <span className={styles.caption}>{caption}</span>
                            <div className={styles.barTrack}>
                                <div
                                    className={styles.barFill}
                                    style={{ width: `${barWidth}%` }}
                                />
                            </div>
                        </div>

                        {/* Count */}
                        <span className={styles.count}>{post.count.toLocaleString()}</span>
                    </div>
                );
            })}
        </div>
    );
}
