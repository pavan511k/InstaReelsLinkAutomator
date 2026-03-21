'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PostCard from './PostCard';
import SetupDMModal from './SetupDMModal';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './PostCardsGrid.module.css';
import lightStyles from './PostCardsGrid.light.module.css';

const MAX_VISIBLE_CARDS = 4;

export default function PostCardsGrid({ posts = [], totalCount = 0 }) {
    const styles = useStyles(darkStyles, lightStyles);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);

    const visiblePosts = posts.slice(0, MAX_VISIBLE_CARDS);
    const hasMore = totalCount > MAX_VISIBLE_CARDS;

    const handleSetupDM = (post) => {
        setSelectedPost(post);
        setShowSetupModal(true);
    };

    const handleCloseModal = () => {
        setShowSetupModal(false);
        setSelectedPost(null);
    };

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
                        onSetupDM={handleSetupDM}
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

            {/* Setup DM Modal */}
            {showSetupModal && (
                <SetupDMModal
                    onClose={handleCloseModal}
                    postId={selectedPost?.id}
                    postCaption={selectedPost?.caption || ''}
                />
            )}
        </div>
    );
}
