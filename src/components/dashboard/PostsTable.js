'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Download, Edit3, Pause, Trash2, Instagram, Facebook } from 'lucide-react';
import PostCard from './PostCard';
import SetupDMModal from './SetupDMModal';
import styles from './PostsTable.module.css';

const STATUS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'setup', label: 'Setup' },
    { key: 'paused', label: 'Paused' },
];

const INITIAL_CARDS = 8;
const LOAD_MORE_COUNT = 8;

export default function PostsTable({ posts = [], onSetupDM, isConnected = false, connectedAccounts = [] }) {
    const router = useRouter();
    const [activeStatusFilter, setActiveStatusFilter] = useState('all');
    const [activePlatformFilter, setActivePlatformFilter] = useState('all');
    const [visibleCardCount, setVisibleCardCount] = useState(INITIAL_CARDS);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);

    // Platform filtering
    const platformFiltered = activePlatformFilter === 'all'
        ? posts
        : posts.filter((post) => post.platform === activePlatformFilter);

    // Status filtering (applied on top of platform filter)
    const filteredPosts = activeStatusFilter === 'all'
        ? platformFiltered
        : platformFiltered.filter((post) => post.status === activeStatusFilter);

    // Cards: show only setup posts from platform filter
    const setupPosts = platformFiltered.filter((p) => p.status === 'setup');
    const visibleCards = setupPosts.slice(0, visibleCardCount);
    const hasMoreCards = setupPosts.length > visibleCardCount;

    // Platform counts
    const platformCounts = {
        all: posts.length,
        instagram: posts.filter((p) => p.platform === 'instagram').length,
        facebook: posts.filter((p) => p.platform === 'facebook').length,
    };

    // Determine which platform tabs to show
    const hasMultiplePlatforms = connectedAccounts.length > 1 ||
        new Set(posts.map((p) => p.platform)).size > 1;

    const handleLoadMore = () => {
        setIsLoadingMore(true);
        setTimeout(() => {
            setVisibleCardCount((prev) => prev + LOAD_MORE_COUNT);
            setIsLoadingMore(false);
        }, 300);
    };

    const handlePlatformChange = (platform) => {
        setActivePlatformFilter(platform);
        setVisibleCardCount(INITIAL_CARDS);
    };

    const handleCheckForNewPosts = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const res = await fetch('/api/posts/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSyncMessage(`✅ Synced ${data.synced} posts`);
                router.refresh();
            } else {
                setSyncMessage(`❌ ${data.error}`);
            }
        } catch (err) {
            setSyncMessage(`❌ Sync failed: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSetupDM = (post) => {
        setSelectedPost(post);
        setShowSetupModal(true);
    };

    const handleCloseModal = () => {
        setShowSetupModal(false);
        setSelectedPost(null);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <span className={`badge badge-success`}>✅ Active</span>;
            case 'setup':
                return (
                    <button className={styles.setupBadge} onClick={() => handleSetupDM()}>
                        🔴 Setup LinkDM
                    </button>
                );
            case 'paused':
                return <span className={`badge badge-warning`}>⏸ Paused</span>;
            default:
                return null;
        }
    };

    const getStatusFilterCount = (filterKey) => {
        return platformFiltered.filter((p) => p.status === filterKey).length;
    };

    const getPlatformIcon = (platform) => {
        if (platform === 'instagram') return <Instagram size={12} />;
        if (platform === 'facebook') return <Facebook size={12} />;
        return null;
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Posts & Reels</h1>
                </div>
                <div className={styles.headerRight}>
                    <button
                        className="btn btn-primary btn-sm"
                        disabled={!isConnected || isSyncing}
                        onClick={handleCheckForNewPosts}
                    >
                        <RefreshCw size={14} className={isSyncing ? styles.spinning : ''} />
                        {isSyncing ? 'Syncing...' : 'Check for new posts'}
                    </button>
                    {syncMessage && <span className={styles.syncTime}>{syncMessage}</span>}
                </div>
            </div>

            {/* Platform Tabs */}
            {hasMultiplePlatforms && (
                <div className={styles.platformTabs}>
                    <button
                        className={`${styles.platformTab} ${activePlatformFilter === 'all' ? styles.platformTabActive : ''}`}
                        onClick={() => handlePlatformChange('all')}
                    >
                        All <span className={styles.platformCount}>{platformCounts.all}</span>
                    </button>
                    {platformCounts.instagram > 0 && (
                        <button
                            className={`${styles.platformTab} ${activePlatformFilter === 'instagram' ? styles.platformTabActive : ''} ${styles.platformTabInstagram}`}
                            onClick={() => handlePlatformChange('instagram')}
                        >
                            <Instagram size={14} />
                            Instagram <span className={styles.platformCount}>{platformCounts.instagram}</span>
                        </button>
                    )}
                    {platformCounts.facebook > 0 && (
                        <button
                            className={`${styles.platformTab} ${activePlatformFilter === 'facebook' ? styles.platformTabActive : ''} ${styles.platformTabFacebook}`}
                            onClick={() => handlePlatformChange('facebook')}
                        >
                            <Facebook size={14} />
                            Facebook <span className={styles.platformCount}>{platformCounts.facebook}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Empty State */}
            {posts.length === 0 ? (
                <div className={styles.emptyState}>
                    <Instagram size={48} className={styles.emptyIcon} />
                    <h3 className={styles.emptyTitle}>No posts yet</h3>
                    <p className={styles.emptyDesc}>
                        {isConnected
                            ? 'Click "Check for new posts" to sync your Instagram posts.'
                            : 'Connect your Instagram account to see your posts here.'}
                    </p>
                    {!isConnected && (
                        <button className="btn btn-primary" onClick={() => window.location.href = '/api/auth/meta/connect?type=instagram'}>Connect Instagram</button>
                    )}
                </div>
            ) : (
                <>
                    {/* Ready to Setup — Card Grid */}
                    {setupPosts.length > 0 && (
                        <div className={styles.cardsSection}>
                            <div className={styles.cardsSectionHeader}>
                                <h2 className={styles.cardsSectionTitle}>
                                    Ready to Setup
                                    <span className="badge-count">{setupPosts.length}</span>
                                </h2>
                                <p className={styles.cardsSectionSub}>AutoDM isn&apos;t active on these posts yet</p>
                            </div>
                            <div className={styles.cardsGrid}>
                                {visibleCards.map((post) => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        onSetupDM={handleSetupDM}
                                    />
                                ))}
                            </div>
                            {hasMoreCards && (
                                <div className={styles.loadMoreWrapper}>
                                    <button
                                        className={styles.loadMoreBtn}
                                        onClick={handleLoadMore}
                                        disabled={isLoadingMore}
                                    >
                                        {isLoadingMore ? 'Loading...' : `View All (${setupPosts.length})`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* All Posts — Status Table */}
                    <div className={styles.tableSection}>
                        <div className={styles.tableSectionHeader}>
                            <h2 className={styles.tableSectionTitle}>All Posts</h2>
                            <div className="filter-pills">
                                {STATUS_FILTERS.map((filter) => (
                                    <button
                                        key={filter.key}
                                        className={`filter-pill ${activeStatusFilter === filter.key ? 'active' : ''}`}
                                        onClick={() => setActiveStatusFilter(filter.key)}
                                    >
                                        {filter.label}
                                        {filter.key !== 'all' && (
                                            <span className={styles.filterCount}>
                                                {getStatusFilterCount(filter.key)}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Post</th>
                                        <th>Status</th>
                                        <th>Sent</th>
                                        <th>Open</th>
                                        <th>Clicks</th>
                                        <th>CTR</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPosts.map((post) => (
                                        <tr key={post.id} className={styles.postRow}>
                                            <td>
                                                <div className={styles.postCell}>
                                                    <div className={styles.postThumb}>
                                                        {post.thumbnailUrl ? (
                                                            <img src={post.thumbnailUrl} alt="" />
                                                        ) : null}
                                                        {getPlatformIcon(post.platform) && (
                                                            <span className={`${styles.thumbPlatform} ${styles[`thumbPlatform_${post.platform}`]}`}>
                                                                {getPlatformIcon(post.platform)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className={styles.postInfo}>
                                                        <p className={styles.postCaption}>{post.caption}</p>
                                                        <span className={styles.postTime}>{post.timestamp}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{getStatusBadge(post.status)}</td>
                                            <td className={styles.metricCell}>{post.sent}</td>
                                            <td className={styles.metricCell}>{post.open}</td>
                                            <td className={styles.metricCell}>{post.clicks}</td>
                                            <td className={styles.metricCell}>{post.ctr}</td>
                                            <td>
                                                <div className={styles.actions}>
                                                    {post.status === 'active' && (
                                                        <>
                                                            <button className={styles.actionBtn} title="Edit">
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button className={styles.actionBtn} title="Pause">
                                                                <Pause size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button className={`${styles.actionBtn} ${styles.actionDanger}`} title="Remove">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Import Section */}
            <div className={styles.importSection}>
                <Download size={20} className={styles.importIcon} />
                <div>
                    <p className={styles.importTitle}>Import Additional Posts</p>
                    <p className={styles.importDesc}>Looking for older posts? Import your last 100 Instagram posts for free!</p>
                </div>
                <button className="btn btn-outline btn-sm" disabled={!isConnected}>Import Posts</button>
            </div>

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
