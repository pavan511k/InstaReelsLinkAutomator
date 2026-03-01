'use client';

import { useState } from 'react';
import { RefreshCw, Download, Edit3, Pause, Trash2, Instagram } from 'lucide-react';
import PostCard from './PostCard';
import styles from './PostsTable.module.css';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'setup', label: 'Setup' },
    { key: 'paused', label: 'Paused' },
];

const INITIAL_CARDS = 8;
const LOAD_MORE_COUNT = 8;

export default function PostsTable({ posts = [], onSetupDM, isConnected = false }) {
    const [activeFilter, setActiveFilter] = useState('all');
    const [visibleCardCount, setVisibleCardCount] = useState(INITIAL_CARDS);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const filteredPosts = activeFilter === 'all'
        ? posts
        : posts.filter((post) => post.status === activeFilter);

    const setupPosts = posts.filter((p) => p.status === 'setup');
    const visibleCards = setupPosts.slice(0, visibleCardCount);
    const hasMoreCards = setupPosts.length > visibleCardCount;

    const handleLoadMore = () => {
        setIsLoadingMore(true);
        // Simulate lazy load delay for smoother UX
        setTimeout(() => {
            setVisibleCardCount((prev) => prev + LOAD_MORE_COUNT);
            setIsLoadingMore(false);
        }, 300);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <span className={`badge badge-success`}>✅ Active</span>;
            case 'setup':
                return (
                    <button className={styles.setupBadge} onClick={() => onSetupDM?.()}>
                        🔴 Setup LinkDM
                    </button>
                );
            case 'paused':
                return <span className={`badge badge-warning`}>⏸ Paused</span>;
            default:
                return null;
        }
    };

    const getFilterCount = (filterKey) => {
        return posts.filter((p) => p.status === filterKey).length;
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Posts & Reels</h1>
                </div>
                <div className={styles.headerRight}>
                    <button className="btn btn-primary btn-sm" disabled={!isConnected}>
                        <RefreshCw size={14} />
                        Check for new posts
                    </button>
                    <span className={styles.syncTime}>Last synced: never</span>
                </div>
            </div>

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
                                        onSetupDM={onSetupDM}
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
                                {FILTERS.map((filter) => (
                                    <button
                                        key={filter.key}
                                        className={`filter-pill ${activeFilter === filter.key ? 'active' : ''}`}
                                        onClick={() => setActiveFilter(filter.key)}
                                    >
                                        {filter.label}
                                        {filter.key !== 'all' && (
                                            <span className={styles.filterCount}>
                                                {getFilterCount(filter.key)}
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
        </div>
    );
}
