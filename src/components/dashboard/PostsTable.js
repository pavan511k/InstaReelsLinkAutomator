'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Download, Edit3, Pause, Play, Trash2, Instagram, Facebook, AlertTriangle, ScrollText, Copy, Timer, MousePointerClick, CalendarClock, Radio } from 'lucide-react';
import Link from 'next/link';
import PostCard from './PostCard';
import SetupDMModal from './SetupDMModal';
import DuplicateModal from './DuplicateModal';
import ClickStatsModal from './ClickStatsModal';
import BroadcastModal from './BroadcastModal';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './PostsTable.module.css';
import lightStyles from './PostsTable.light.module.css';
import settingsStyles from './SettingsContent.module.css';

const STATUS_FILTERS = [
    { key: 'all',       label: 'All' },
    { key: 'active',    label: 'Active' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'setup',     label: 'Setup' },
    { key: 'paused',    label: 'Paused' },
];

const INITIAL_CARDS = 8;
const LOAD_MORE_COUNT = 8;

/** Returns a short label for a scheduled start time, or null */
function formatScheduled(isoString) {
    if (!isoString) return null;
    const diff = new Date(isoString) - new Date();
    if (diff <= 0) return null; // already past, cron should have activated
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (days >= 2)   return `Starts in ${days}d`;
    if (hours >= 1)  return `Starts in ${hours}h`;
    return           `Starts in ${mins}m`;
}

/** Returns { label, urgent } for an expiry ISO string, or null if no expiry */
function formatExpiry(isoString) {
    if (!isoString) return null;
    const diff = new Date(isoString) - new Date();
    if (diff <= 0) return { label: 'Expired', urgent: true,  expired: true };
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (days >= 2)   return { label: `Expires in ${days}d`,  urgent: false, expired: false };
    if (hours >= 1)  return { label: `Expires in ${hours}h`, urgent: true,  expired: false };
    return           { label: `Expires in ${mins}m`,          urgent: true,  expired: false };
}

export default function PostsTable({ posts = [], onSetupDM, isConnected = false, connectedAccounts = [], userPlan = 'free' }) {
    const isPro = userPlan === 'pro' || userPlan === 'trial' || userPlan === 'business';
    const styles = useStyles(darkStyles, lightStyles);
    const router = useRouter();
    const [activeStatusFilter, setActiveStatusFilter] = useState('all');
    const [activePlatformFilter, setActivePlatformFilter] = useState('all');
    const [visibleCardCount, setVisibleCardCount] = useState(INITIAL_CARDS);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [postToDelete,   setPostToDelete]   = useState(null);
    const [isDeleting,     setIsDeleting]     = useState(false);
    const [duplicatePost,  setDuplicatePost]  = useState(null);
    const [clickStatsPost,  setClickStatsPost]  = useState(null);
    const [broadcastPost,   setBroadcastPost]   = useState(null);

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

    const handleToggleStatus = async (post) => {
        const newStatus = post.status === 'active' ? false : true;
        try {
            const res = await fetch('/api/automations/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId: post.id, isActive: newStatus }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert('Failed to update status');
            }
        } catch (err) {
            console.error('Status update failed', err);
        }
    };

    const handleDeleteAutomation = (post) => { setPostToDelete(post); };
    const handleDuplicate = (post) => { setDuplicatePost(post); };
    const handleDuplicateClose = () => { setDuplicatePost(null); };
    const handleDuplicateSuccess = () => {
        setDuplicatePost(null);
        router.refresh();
    };

    const handleConfirmDelete = async () => {
        if (!postToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/automations?postId=${postToDelete.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setPostToDelete(null);
                router.refresh();
            } else {
                alert('Failed to delete automation');
            }
        } catch (err) {
            console.error('Delete automation failed', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCancelDelete = () => {
        if (!isDeleting) setPostToDelete(null);
    };

    const getStatusBadge = (status, post) => {
        switch (status) {
            case 'active':
                return <span className="badge badge-success">✅ Active</span>;
            case 'scheduled':
                return <span className={styles.scheduledBadge}>🚀 Scheduled</span>;
            case 'setup':
                return (
                    <button className={styles.setupBadge} onClick={() => handleSetupDM(post)}>
                        <span className={styles.pulseDot} /> Configure AutoDM
                    </button>
                );
            case 'paused':
                return <span className="badge badge-warning">⏸ Paused</span>;
            default:
                return null;
        }
    };

    const getStatusFilterCount = (filterKey) => {
        if (filterKey === 'all') return platformFiltered.length;
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <h2 className={styles.tableSectionTitle}>All Posts</h2>
                                <Link href="/logs" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#A78BFA', textDecoration: 'none' }}>
                                    <ScrollText size={13} /> View DM Logs
                                </Link>
                            </div>
                            <div className={styles.filterPills}>
                                {STATUS_FILTERS.map((filter) => (
                                    <button
                                        key={filter.key}
                                        className={`${styles.filterPill} ${activeStatusFilter === filter.key ? styles.filterPillActive : ''}`}
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
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                                                    {getStatusBadge(post.status, post)}

                                                    {/* Scheduled start countdown */}
                                                    {post.status === 'scheduled' && post.scheduledStartAt && (() => {
                                                        const label = formatScheduled(post.scheduledStartAt);
                                                        if (!label) return null;
                                                        return (
                                                            <span
                                                                className={styles.scheduledCountdownBadge}
                                                                title={new Date(post.scheduledStartAt).toLocaleString('en-IN')}
                                                            >
                                                                <CalendarClock size={10} strokeWidth={2.5} />
                                                                {label}
                                                            </span>
                                                        );
                                                    })()}

                                                    {/* Expiry countdown */}
                                                    {(post.status === 'active' || post.status === 'paused') && (() => {
                                                        const exp = formatExpiry(post.expiresAt);
                                                        if (!exp) return null;
                                                        return (
                                                            <span
                                                                className={exp.expired ? styles.expiryBadgeExpired : exp.urgent ? styles.expiryBadgeUrgent : styles.expiryBadge}
                                                                title={post.expiresAt ? new Date(post.expiresAt).toLocaleString('en-IN') : ''}
                                                            >
                                                                <Timer size={10} strokeWidth={2.5} />
                                                                {exp.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className={styles.metricCell}>{post.sent}</td>
                                            <td className={styles.metricCell}>{post.open || '—'}</td>
                                            <td className={styles.metricCell}>
                                                {post.automationId ? (
                                                    isPro ? (
                                                        // Pro: clickable button that opens the full analytics modal
                                                        <button
                                                            className={`${styles.clicksCell} ${post.clicks > 0 ? styles.clicksCellActive : ''}`}
                                                            onClick={() => setClickStatsPost(post)}
                                                            title="View click breakdown"
                                                        >
                                                            {post.clicks > 0 && <MousePointerClick size={11} strokeWidth={2.5} />}
                                                            {post.clicks}
                                                        </button>
                                                    ) : (
                                                        // Free: show the count, hint that detail is Pro
                                                        <span className={styles.clicksCellFree} title="Upgrade to Pro for the full click breakdown">
                                                            {post.clicks > 0 && <MousePointerClick size={11} strokeWidth={2.5} />}
                                                            {post.clicks}
                                                            {post.clicks > 0 && (
                                                                <a href="/pricing" className={styles.clicksDetailLock} title="See click breakdown — Pro">
                                                                    🔒
                                                                </a>
                                                            )}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className={styles.metricCell}>—</span>
                                                )}
                                            </td>
                                            <td className={styles.metricCell}>
                                                {/* CTR is shown to everyone — it’s just arithmetic */}
                                                {post.ctr !== '-' ? (
                                                    isPro ? (
                                                        // Pro: clickable, opens modal
                                                        <button
                                                            className={styles.ctrCell}
                                                            onClick={() => setClickStatsPost(post)}
                                                            title="View CTR breakdown"
                                                        >
                                                            {post.ctr}
                                                        </button>
                                                    ) : (
                                                        // Free: just the number, hint at upgrade
                                                        <span className={styles.ctrCellFree} title="Upgrade to Pro for the full CTR analytics">
                                                            {post.ctr}
                                                            <a href="/pricing" className={styles.clicksDetailLock} title="Full analytics — Pro">🔒</a>
                                                        </span>
                                                    )
                                                ) : '—'}
                                            </td>
                                            <td>
                                                <div className={styles.actions}>
                                                    {(post.status === 'active' || post.status === 'paused' || post.status === 'scheduled') && (
                                                        <>
                                                            <button className={styles.actionBtn} title="Edit" onClick={() => handleSetupDM(post)}>
                                                                <Edit3 size={14} />
                                                            </button>
                                                            {/* Scheduled posts: no pause/resume — edit to cancel the schedule */}
                                                            {post.status !== 'scheduled' && (
                                                                <button className={styles.actionBtn} title={post.status === 'active' ? 'Pause' : 'Resume'} onClick={() => handleToggleStatus(post)}>
                                                                    {post.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                                                                </button>
                                                            )}
                                                            {/* Broadcast DM — only for active/paused (not scheduled) */}
                                                            {post.status !== 'scheduled' && (
                                                                <button
                                                                    className={`${styles.actionBtn} ${styles.actionBroadcast}`}
                                                                    title="Broadcast DM to all commenters"
                                                                    onClick={() => setBroadcastPost(post)}
                                                                >
                                                                    <Radio size={14} />
                                                                </button>
                                                            )}
                                                            <button className={styles.actionBtn} title="Duplicate to another post" onClick={() => handleDuplicate(post)}>
                                                                <Copy size={14} />
                                                            </button>
                                                            <button className={`${styles.actionBtn} ${styles.actionDanger}`} title="Remove" onClick={() => handleDeleteAutomation(post)}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
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
                <button
                    className="btn btn-outline btn-sm"
                    disabled={!isConnected || isSyncing}
                    onClick={handleCheckForNewPosts}
                >
                    {isSyncing ? 'Importing...' : 'Import Posts'}
                </button>
            </div>

            {/* Setup DM Modal */}
            {showSetupModal && (
                <SetupDMModal
                    onClose={handleCloseModal}
                    postId={selectedPost?.id}
                    postCaption={selectedPost?.caption || ''}
                />
            )}

            {/* Broadcast Modal */}
            {broadcastPost && (
                <BroadcastModal
                    post={broadcastPost}
                    onClose={() => setBroadcastPost(null)}
                />
            )}

            {/* Click Stats Modal */}
            {clickStatsPost && (
                <ClickStatsModal
                    automationId={clickStatsPost.automationId}
                    postCaption={clickStatsPost.caption}
                    onClose={() => setClickStatsPost(null)}
                />
            )}

            {/* Duplicate Automation Modal */}
            {duplicatePost && (
                <DuplicateModal
                    sourcePost={duplicatePost}
                    allPosts={posts}
                    onClose={handleDuplicateClose}
                    onSuccess={handleDuplicateSuccess}
                />
            )}

            {/* Delete Automation Confirmation Modal */}
            {postToDelete && (
                <div className={settingsStyles.modalOverlay} onClick={handleCancelDelete}>
                    <div className={settingsStyles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={settingsStyles.modalIcon}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className={settingsStyles.modalTitle}>Delete this automation?</h3>
                        <p className={settingsStyles.modalDesc}>
                            This will permanently stop all DMs for the post{' '}
                            <strong>&ldquo;{postToDelete.caption || 'Untitled'}&rdquo;</strong>
                            . This action cannot be undone.
                        </p>
                        <div className={settingsStyles.modalActions}>
                            <button
                                className={settingsStyles.cancelBtn}
                                onClick={handleCancelDelete}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className={settingsStyles.confirmDeleteBtn}
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                            >
                                <Trash2 size={14} />
                                {isDeleting ? 'Deleting...' : 'Yes, delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
