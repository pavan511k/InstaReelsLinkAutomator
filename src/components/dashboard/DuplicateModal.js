'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Copy, CheckCircle, Loader2, Instagram, Facebook } from 'lucide-react';
import styles from './DuplicateModal.module.css';

export default function DuplicateModal({ sourcePost, allPosts, onClose, onSuccess }) {
    const [search,     setSearch]     = useState('');
    const [selected,   setSelected]   = useState(null);
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState('');
    const [done,       setDone]       = useState(false);
    const searchRef = useRef(null);

    // Focus search on mount
    useEffect(() => { searchRef.current?.focus(); }, []);

    // Posts eligible for duplication — exclude the source and any that already have automations
    const eligible = allPosts.filter(
        (p) => p.id !== sourcePost.id && p.status === 'setup',
    );

    const filtered = search.trim()
        ? eligible.filter((p) =>
            p.caption.toLowerCase().includes(search.toLowerCase()),
        )
        : eligible;

    const handleDuplicate = async () => {
        if (!selected) return;
        setLoading(true);
        setError('');

        try {
            const res  = await fetch('/api/automations/duplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourcePostId: sourcePost.id, targetPostId: selected.id }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Duplication failed');
            }

            setDone(true);
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1600);

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const getPlatformIcon = (platform) => {
        if (platform === 'instagram') return <Instagram size={11} />;
        if (platform === 'facebook')  return <Facebook size={11} />;
        return null;
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIcon}>
                            <Copy size={16} />
                        </div>
                        <div>
                            <h2 className={styles.title}>Duplicate automation</h2>
                            <p className={styles.subtitle}>Copy this automation's config to another post</p>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                {/* ── Source preview ── */}
                <div className={styles.sourceCard}>
                    <span className={styles.sourceLabel}>Copying from</span>
                    <div className={styles.sourcePost}>
                        {sourcePost.thumbnailUrl ? (
                            <img src={sourcePost.thumbnailUrl} alt="" className={styles.sourceThumb} />
                        ) : (
                            <div className={styles.sourceThumbBlank} />
                        )}
                        <span className={styles.sourceCaption}>{sourcePost.caption}</span>
                    </div>
                </div>

                {/* ── Target picker ── */}
                {done ? (
                    <div className={styles.successState}>
                        <CheckCircle size={32} style={{ color: '#10B981' }} />
                        <p className={styles.successTitle}>Automation duplicated!</p>
                        <p className={styles.successSub}>
                            It&apos;s saved as <strong>paused</strong> on the target post — activate it when you&apos;re ready.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className={styles.searchWrap}>
                            <Search size={14} className={styles.searchIcon} />
                            <input
                                ref={searchRef}
                                className={styles.searchInput}
                                placeholder="Search posts by caption…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button className={styles.clearSearch} onClick={() => setSearch('')}>
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <div className={styles.listWrap}>
                            {eligible.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p className={styles.emptyTitle}>No eligible posts</p>
                                    <p className={styles.emptyDesc}>
                                        All your other posts already have automations configured.
                                    </p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p className={styles.emptyTitle}>No results for &ldquo;{search}&rdquo;</p>
                                </div>
                            ) : (
                                <ul className={styles.list}>
                                    {filtered.map((post) => (
                                        <li key={post.id}>
                                            <button
                                                className={`${styles.postItem} ${selected?.id === post.id ? styles.postItemSelected : ''}`}
                                                onClick={() => setSelected(post)}
                                            >
                                                <div className={styles.postThumbWrap}>
                                                    {post.thumbnailUrl ? (
                                                        <img src={post.thumbnailUrl} alt="" className={styles.postThumb} />
                                                    ) : (
                                                        <div className={styles.postThumbBlank} />
                                                    )}
                                                    <span className={styles.platformBadge}>
                                                        {getPlatformIcon(post.platform)}
                                                    </span>
                                                </div>
                                                <div className={styles.postMeta}>
                                                    <span className={styles.postCaption}>{post.caption}</span>
                                                    <span className={styles.postTime}>{post.timestamp}</span>
                                                </div>
                                                <div className={styles.postCheck}>
                                                    {selected?.id === post.id && (
                                                        <CheckCircle size={16} style={{ color: '#10B981' }} />
                                                    )}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {error && (
                            <div className={styles.errorBar}>
                                {error}
                            </div>
                        )}

                        {/* ── Footer ── */}
                        <div className={styles.footer}>
                            <div className={styles.footerNote}>
                                {selected
                                    ? <>Copying to: <strong>{selected.caption.slice(0, 32)}{selected.caption.length > 32 ? '…' : ''}</strong></>
                                    : 'Select a destination post above'}
                            </div>
                            <div className={styles.footerActions}>
                                <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
                                    Cancel
                                </button>
                                <button
                                    className={styles.duplicateBtn}
                                    onClick={handleDuplicate}
                                    disabled={!selected || loading}
                                >
                                    {loading ? (
                                        <><Loader2 size={14} className={styles.spin} /> Duplicating…</>
                                    ) : (
                                        <><Copy size={14} /> Duplicate</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
