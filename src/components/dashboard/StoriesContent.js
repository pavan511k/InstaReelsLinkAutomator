'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Instagram, Facebook, Clock, Search, Edit3, Pause, Play, Trash2 } from 'lucide-react';
import SetupDMModal from '@/components/dashboard/SetupDMModal';
import { useStyles } from '@/lib/useStyles';
import darkStyles from '../../app/(dashboard)/stories/stories.module.css';
import lightStyles from '../../app/(dashboard)/stories/stories.light.module.css';

export default function StoriesContent({ stories = [], isConnected = false, platform = 'instagram' }) {
    const styles = useStyles(darkStyles, lightStyles);
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStoryId, setSelectedStoryId] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [skippingId, setSkippingId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const recentStories = stories.filter((s) => !s.story_expires_at || new Date(s.story_expires_at) > new Date());

    const handleConnect = () => {
        window.location.href = '/api/auth/meta/connect?type=instagram';
    };

    const handleCheckForNewStories = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const res = await fetch('/api/posts/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSyncMessage(`✅ Synced ${data.synced} items`);
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
        if (!confirm('Remove DM automation for this story?')) return;
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

    const getStatusBadge = (story) => {
        const isExpired = story.story_expires_at && new Date(story.story_expires_at) <= new Date();
        if (isExpired) return <span className={styles.expiredBadge}>Expired</span>;
        switch (story.status) {
            case 'active': return <span className={styles.activeBadge}>✅ Active</span>;
            case 'paused': return <span className={styles.pausedBadge}>⏸ Paused</span>;
            default: return <span className={styles.setupBadge} onClick={() => handleSetupStory(story.id)}>Configure AutoDM</span>;
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
                    {syncMessage && <span className={styles.syncTime}>{syncMessage}</span>}
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
                        {recentStories.map((story) => (
                            <div key={story.id} className={styles.storyCard}>
                                <div className={styles.storyMedia}>
                                    {story.media_url ? (
                                        <img src={story.media_url} alt="" />
                                    ) : (
                                        <div className={styles.storyPlaceholder}>
                                            <Instagram size={22} />
                                        </div>
                                    )}
                                    {story.media_type === 'VIDEO' && (
                                        <span className={styles.videoIcon}>▶</span>
                                    )}
                                    <span className={`${styles.storyPlatformBadge} ${platform === 'facebook' ? styles.storyPlatformBadgeFacebook : ''}`}>
                                        {platform === 'facebook' ? <Facebook size={13} /> : <Instagram size={13} />}
                                    </span>
                                </div>
                                <div className={styles.storyMeta}>
                                    <span className={styles.storyDate}>
                                        {new Date(story.timestamp).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                        })}
                                    </span>
                                    {story.story_expires_at && (
                                        <div className={styles.storyExpiry}>
                                            <Clock size={11} />
                                            <span>Expires in {Math.max(0, Math.round((new Date(story.story_expires_at) - new Date()) / 3600000))}h</span>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.storyActions}>
                                    {story.status === 'setup' ? (
                                        <>
                                            <button className={styles.storyActionBtn} onClick={() => handleSetupStory(story.id)}>
                                                Configure AutoDM
                                            </button>
                                            <button className={styles.skipBtn} onClick={() => handleSkipStory(story.id)} disabled={skippingId === story.id}>
                                                {skippingId === story.id ? 'Skipping…' : 'Skip'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button className={styles.storyActionBtn} onClick={() => handleSetupStory(story.id)}>
                                                <Edit3 size={12} /> Edit
                                            </button>
                                            <button className={styles.skipBtn} onClick={() => handleToggleStatus(story)} disabled={togglingId === story.id}>
                                                {story.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                                                {story.status === 'active' ? 'Pause' : 'Resume'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
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
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                    {['Story', 'Status', 'Sent', 'Open', 'Clicks', 'CTR', ''].map((h) => (
                                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filterBySearch(stories).map((story) => (
                                    <tr key={story.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div className={styles.storyRow}>
                                                <div className={styles.storyThumb}>
                                                    {story.media_url && <img src={story.media_url} alt="" />}
                                                </div>
                                                <span className={styles.storyRowDate}>
                                                    {new Date(story.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>{getStatusBadge(story)}</td>
                                        <td className={styles.metricCell} style={{ padding: '12px 14px' }}>{story.sent || 0}</td>
                                        <td className={styles.metricCell} style={{ padding: '12px 14px' }}>0</td>
                                        <td className={styles.metricCell} style={{ padding: '12px 14px' }}>0</td>
                                        <td className={styles.metricCell} style={{ padding: '12px 14px' }}>{story.sent > 0 ? '0%' : '-'}</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {(story.status === 'active' || story.status === 'paused') && (
                                                <div className={styles.actionBtns}>
                                                    <button className={styles.actionBtn} title="Edit" onClick={() => handleSetupStory(story.id)}><Edit3 size={13} /></button>
                                                    <button className={styles.actionBtn} title={story.status === 'active' ? 'Pause' : 'Resume'} onClick={() => handleToggleStatus(story)} disabled={togglingId === story.id}>
                                                        {story.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                                                    </button>
                                                    <button className={`${styles.actionBtn} ${styles.actionDanger}`} title="Remove" onClick={() => handleDeleteAutomation(story)} disabled={deletingId === story.id}><Trash2 size={13} /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <SetupDMModal
                    onClose={() => { setIsModalOpen(false); setSelectedStoryId(null); }}
                    postId={selectedStoryId}
                />
            )}
        </div>
    );
}
