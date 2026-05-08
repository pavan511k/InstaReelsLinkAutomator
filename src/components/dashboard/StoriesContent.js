'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Instagram, Facebook, Clock, Search, Edit3, Pause, Play, Trash2, Film, Copy } from 'lucide-react';
import { toast } from 'sonner';
import SetupDMModal from '@/components/dashboard/SetupDMModal';
import DuplicateModal from '@/components/dashboard/DuplicateModal';
import { useStyles } from '@/lib/useStyles';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import Pagination, { paginate } from '@/components/ui/Pagination';
import darkStyles from '../../app/(dashboard)/stories/stories.module.css';
import lightStyles from '../../app/(dashboard)/stories/stories.light.module.css';

export default function StoriesContent({ stories = [], isConnected = false, platform = 'instagram' }) {
    const styles = useStyles(darkStyles, lightStyles);
    const { confirm } = useConfirm();
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStoryId, setSelectedStoryId] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [skippingId, setSkippingId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [duplicateStory, setDuplicateStory] = useState(null);

    // Recent = known live: must have an expiry AND it must be in the future.
    // Stories without `story_expires_at` are pre-backfill rows where we can't
    // prove liveness, so we exclude them rather than risk showing expired ones.
    const recentStories = stories.filter((s) => s.story_expires_at && new Date(s.story_expires_at) > new Date());

    const handleConnect = () => {
        window.location.href = '/api/auth/meta/connect?type=instagram';
    };

    const handleCheckForNewStories = async () => {
        setIsSyncing(true);
        const toastId = toast.loading('Checking for new stories…');
        try {
            const res = await fetch('/api/posts/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Synced ${data.synced} items`, { id: toastId });
                router.refresh();
            } else {
                toast.error(data.error || 'Sync failed', { id: toastId });
            }
        } catch (err) {
            toast.error(`Sync failed: ${err.message}`, { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSkipStory = async (storyId) => {
        setSkippingId(storyId);
        try {
            const { createClient } = await import('@/lib/supabase-client');
            const supabase = createClient();
            await supabase.from('instagram_posts').update({ is_skipped: true }).eq('id', storyId);
            router.refresh();
        } catch (err) {
            console.error('Skip failed:', err);
        } finally {
            setSkippingId(null);
        }
    };

    const handleSetupStory = (storyId) => {
        setSelectedStoryId(storyId);
        setIsModalOpen(true);
    };

    const handleToggleStatus = async (story) => {
        setTogglingId(story.id);
        try {
            const newStatus = story.status !== 'active';
            const res = await fetch('/api/automations/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId: story.id, isActive: newStatus }),
            });
            if (res.ok) router.refresh();
        } catch (err) {
            console.error('Toggle failed:', err);
        } finally {
            setTogglingId(null);
        }
    };

    const handleDeleteAutomation = async (story) => {
        const ok = await confirm({
            title: 'Remove DM automation?',
            message: 'The DM automation for this story will be removed. This cannot be undone.',
            confirmText: 'Remove',
        });
        if (!ok) return;
        setDeletingId(story.id);
        try {
            const res = await fetch(`/api/automations?postId=${story.id}`, { method: 'DELETE' });
            if (res.ok) router.refresh();
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const filterBySearch = (storyList) => {
        if (!searchQuery.trim()) return storyList;
        const q = searchQuery.toLowerCase();
        return storyList.filter((s) =>
            (s.caption && s.caption.toLowerCase().includes(q)) ||
            new Date(s.timestamp).toLocaleDateString().includes(q)
        );
    };

    // ── All Stories pagination ────────────────────────────────────
    const [storiesPage, setStoriesPage]         = useState(1);
    const [storiesPageSize, setStoriesPageSize] = useState(20);
    // Reset page on search or page-size change so we don't show empty pages.
    useEffect(() => { setStoriesPage(1); }, [searchQuery, storiesPageSize]);
    const filteredStories  = filterBySearch(stories);
    const paginatedStories = paginate(filteredStories, storiesPage, storiesPageSize);

    const getStatusBadge = (story) => {
        const isExpired = story.story_expires_at && new Date(story.story_expires_at) <= new Date();
        if (isExpired) return <span className={styles.expiredBadge}>Expired</span>;
        switch (story.status) {
            case 'active': return <span className={styles.activeBadge}>✅ Active</span>;
            case 'paused': return <span className={styles.pausedBadge}>⏸ Paused</span>;
            default: return <span className={styles.setupBadge} onClick={() => handleSetupStory(story.id)}>Configure</span>;
        }
    };

    return (
        <div className={styles.storiesPage}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>Stories</h1>
                <div className={styles.headerRight}>
                    <button
                        className={styles.syncBtn}
                        disabled={!isConnected || isSyncing}
                        onClick={handleCheckForNewStories}
                    >
                        <RefreshCw size={14} className={isSyncing ? styles.spinning : ''} />
                        {isSyncing ? 'Syncing...' : 'Check for new stories'}
                    </button>
                </div>
            </div>

            {/* Not connected */}
            {!isConnected && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIconWrapper}>
                        <div className={styles.pulseBg} />
                        <Instagram size={36} className={styles.emptyIcon} />
                    </div>
                    <h3 className={styles.emptyTitle}>No stories yet</h3>
                    <p className={styles.emptyDesc}>
                        Connect your Instagram account to see your stories here.
                        Only active (non-expired) stories can have DM automations set up.
                    </p>
                    <div className={styles.emptyAction}>
                        <button className={styles.connectBtn} onClick={handleConnect}>Connect Instagram</button>
                    </div>
                </div>
            )}

            {/* Connected but no stories */}
            {isConnected && stories.length === 0 && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIconWrapper}>
                        <div className={styles.pulseBg} />
                        <Instagram size={36} className={styles.emptyIcon} />
                    </div>
                    <h3 className={styles.emptyTitle}>No stories found</h3>
                    <p className={styles.emptyDesc}>
                        Post a story on Instagram, then click &ldquo;Check for new stories&rdquo; to sync it here.
                        Stories are only available for 24 hours.
                    </p>
                </div>
            )}

            {/* Recent stories grid */}
            {isConnected && recentStories.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>Recent Stories</h2>
                            <p className={styles.sectionSub}>Add a DM automation to these active stories</p>
                        </div>
                    </div>
                    <div className={styles.storyGrid}>
                        {recentStories.map((story) => {
                            const truncatedCaption = story.caption?.length > 55
                                ? story.caption.substring(0, 55) + '...'
                                : story.caption || '';
                            const isVideo = story.media_type === 'VIDEO';
                            const isFacebook = story.platform === 'facebook';
                            return (
                                <div key={story.id} className={styles.storyCard}>
                                    {/* Thumbnail */}
                                    <div className={styles.storyMedia}>
                                        {story.media_url ? (
                                            <img src={story.media_url} alt={truncatedCaption} className={styles.storyImg} />
                                        ) : (
                                            <div className={styles.storyPlaceholder}>
                                                <Instagram size={22} />
                                            </div>
                                        )}
                                        {/* Top-left: video badge */}
                                        {isVideo && (
                                            <span className={styles.videoBadge}>
                                                <Film size={11} />
                                            </span>
                                        )}
                                        {/* Top-right: platform badge */}
                                        <span className={`${styles.storyPlatformBadge} ${isFacebook ? styles.storyPlatformBadgeFacebook : ''}`}>
                                            {isFacebook ? <Facebook size={12} /> : <Instagram size={12} />}
                                        </span>
                                        {/* Bottom-left: sent count */}
                                        {story.sent > 0 && (
                                            <span className={styles.sentBadge}>✉ {story.sent}</span>
                                        )}
                                        {/* Status pill overlay */}
                                        {story.status === 'active' && (
                                            <span className={styles.statusOverlayActive}>● Active</span>
                                        )}
                                        {story.status === 'paused' && (
                                            <span className={styles.statusOverlayPaused}>⏸ Paused</span>
                                        )}
                                    </div>

                                    {/* Body */}
                                    <div className={styles.storyBody}>
                                        <p className={styles.storyCaption}>
                                            {truncatedCaption || 'No caption'}
                                        </p>
                                        <div className={styles.storyFooter}>
                                            <span className={styles.storyDate}>
                                                {new Date(story.timestamp).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric',
                                                })}
                                            </span>
                                            {story.story_expires_at && (
                                                <div className={styles.storyExpiry}>
                                                    <Clock size={10} />
                                                    <span>{Math.max(0, Math.round((new Date(story.story_expires_at) - new Date()) / 3600000))}h left</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Single CTA — pause / resume / delete live in the All Stories
                                        table to keep the card focused on the primary action. */}
                                    <div className={styles.storyActions}>
                                        {story.status === 'setup' ? (
                                            <button className={styles.storyActionBtn} onClick={() => handleSetupStory(story.id)}>
                                                <Edit3 size={13} /> Set up auto-DM
                                            </button>
                                        ) : (
                                            <button
                                                className={`${styles.storyActionBtn} ${story.status === 'active' ? styles.storyActionBtnActive : styles.storyActionBtnPaused}`}
                                                onClick={() => handleSetupStory(story.id)}
                                            >
                                                <Edit3 size={13} /> Edit auto-DM
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* All stories table */}
            {isConnected && stories.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionHeaderLeft}>
                            <h2 className={styles.sectionTitle}>All Stories</h2>
                        </div>
                        <div className={styles.searchBox}>
                            <Search size={13} className={styles.searchIcon} />
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className={styles.tableScroll}>
                        <table className={styles.storyTable}>
                            <thead>
                                <tr className={styles.storyTableHeadRow}>
                                    {['Story', 'Status', 'Sent', 'Open', 'Clicks', 'CTR', ''].map((h) => (
                                        <th key={h} className={styles.storyTableTh}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedStories.map((story) => (
                                    <tr key={story.id} className={styles.storyTableRow}>
                                        <td className={styles.storyTableTd}>
                                            <div className={styles.storyRow}>
                                                <div className={styles.storyThumb}>
                                                    {story.media_url && <img src={story.media_url} alt="" />}
                                                </div>
                                                <span className={styles.storyRowDate}>
                                                    {new Date(story.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={styles.storyTableTd}>{getStatusBadge(story)}</td>
                                        <td className={`${styles.metricCell} ${styles.storyTableTd}`}>{story.sent || 0}</td>
                                        <td className={`${styles.metricCell} ${styles.storyTableTd}`}>0</td>
                                        <td className={`${styles.metricCell} ${styles.storyTableTd}`}>0</td>
                                        <td className={`${styles.metricCell} ${styles.storyTableTd}`}>{story.sent > 0 ? '0%' : '-'}</td>
                                        <td className={styles.storyTableTd}>
                                            {(story.status === 'active' || story.status === 'paused') && (() => {
                                                // Once a story expires, the automation can't fire even if active —
                                                // hide Edit / Pause / Resume so the row only offers actions that
                                                // still make sense (copy the config to a live story, or remove
                                                // the dead row entirely).
                                                const isExpired = story.story_expires_at && new Date(story.story_expires_at) <= new Date();
                                                return (
                                                    <div className={styles.actionBtns}>
                                                        {!isExpired && (
                                                            <button className={styles.actionBtn} title="Edit" onClick={() => handleSetupStory(story.id)}><Edit3 size={13} /></button>
                                                        )}
                                                        <button className={styles.actionBtn} title="Copy automation to another story" onClick={() => setDuplicateStory(story)}><Copy size={13} /></button>
                                                        {!isExpired && (
                                                            <button className={styles.actionBtn} title={story.status === 'active' ? 'Pause' : 'Resume'} onClick={() => handleToggleStatus(story)} disabled={togglingId === story.id}>
                                                                {story.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                                                            </button>
                                                        )}
                                                        <button className={`${styles.actionBtn} ${styles.actionDanger}`} title="Remove" onClick={() => handleDeleteAutomation(story)} disabled={deletingId === story.id}><Trash2 size={13} /></button>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        totalItems={filteredStories.length}
                        currentPage={storiesPage}
                        pageSize={storiesPageSize}
                        onPageChange={setStoriesPage}
                        onPageSizeChange={setStoriesPageSize}
                    />
                </div>
            )}

            {isModalOpen && (
                <SetupDMModal
                    onClose={() => { setIsModalOpen(false); setSelectedStoryId(null); }}
                    postId={selectedStoryId}
                />
            )}

            {duplicateStory && (() => {
                // DuplicateModal expects camelCase `thumbnailUrl` (the Posts page
                // already maps to that shape; the Stories page passes raw rows
                // with `thumbnail_url`). Normalise here so thumbnails render
                // and the source preview / list items aren't blank.
                const toModalShape = (s) => ({
                    ...s,
                    thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || s.media_url || null,
                    caption: s.caption || 'No caption',
                });
                return (
                    <DuplicateModal
                        sourcePost={toModalShape(duplicateStory)}
                        allPosts={stories.map(toModalShape)}
                        onClose={() => setDuplicateStory(null)}
                        onSuccess={() => {
                            setDuplicateStory(null);
                            toast.success('Automation copied');
                            router.refresh();
                        }}
                    />
                );
            })()}
        </div>
    );
}
