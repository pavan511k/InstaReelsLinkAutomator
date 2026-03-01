'use client';

import { useState } from 'react';
import { RefreshCw, Download, Edit3, Pause, Trash2, ChevronLeft, ChevronRight, Instagram } from 'lucide-react';
import styles from './PostsTable.module.css';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'setup', label: 'Setup' },
    { key: 'paused', label: 'Paused' },
];

export default function PostsTable({ posts = [], onSetupDM, isConnected = false }) {
    const [activeFilter, setActiveFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);

    const filteredPosts = activeFilter === 'all'
        ? posts
        : posts.filter((post) => post.status === activeFilter);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return <span className={`badge badge-success`}>✅ Active</span>;
            case 'setup':
                return (
                    <button className={styles.setupBtn} onClick={() => onSetupDM?.()}>
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

            {/* Filter tabs */}
            <div className={styles.filters}>
                <div className="filter-pills">
                    {FILTERS.map((filter) => (
                        <button
                            key={filter.key}
                            className={`filter-pill ${activeFilter === filter.key ? 'active' : ''}`}
                            onClick={() => { setActiveFilter(filter.key); setCurrentPage(1); }}
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

            {/* Empty State or Table */}
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
                                                    {post.thumbnailUrl && (
                                                        <img src={post.thumbnailUrl} alt="" />
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

                    {/* Pagination */}
                    <div className={styles.pagination}>
                        <div className={styles.pageInfo}>
                            Showing {filteredPosts.length} posts
                        </div>
                        <div className={styles.pageControls}>
                            <button className={styles.pageBtn} disabled={currentPage === 1}>
                                <ChevronLeft size={16} />
                            </button>
                            <span className={styles.pageNum}>{currentPage}</span>
                            <button className={styles.pageBtn} disabled>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <select className={styles.pageSize}>
                            <option>20 posts</option>
                            <option>50 posts</option>
                        </select>
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
