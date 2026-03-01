'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PostCard from './PostCard';
import styles from './PostCardsGrid.module.css';

const MAX_VISIBLE_CARDS = 4;

export default function PostCardsGrid({ posts = [], totalCount = 0 }) {
    const visiblePosts = posts.slice(0, MAX_VISIBLE_CARDS);
    const hasMore = totalCount > MAX_VISIBLE_CARDS;

    if (posts.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>No posts to set up. Click &quot;Sync Posts&quot; above to fetch your latest posts.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {visiblePosts.map((post) => (
                    <PostCard
                        key={post.id}
                        post={post}
                    />
                ))}
            </div>

            {hasMore && (
                <div className={styles.viewAllWrapper}>
                    <Link href="/posts" className={styles.viewAllBtn}>
                        View All
                        <ArrowRight size={14} />
                    </Link>
                </div>
            )}
        </div>
    );
}
