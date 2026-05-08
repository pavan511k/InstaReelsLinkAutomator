'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
    Plus, Trash2, X, Image as ImageIcon, BookmarkPlus, FileDown, Loader2,
    Link2, MousePointerClick, Zap, FlaskConical, ChevronDown,
    UploadCloud, Lock,
} from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import { FREE_SLIDE_LIMIT } from '@/lib/plans';
import darkStyles from './DMSetupTab.module.css';
import lightStyles from './DMSetupTab.light.module.css';

const EMPTY_SLIDE = {
    imageUrl: '', headline: '', description: '', appendBranding: true, buttonLabel: '',
    buttonUrl: '', buttons: [{ type: 'url', label: '', value: '' }],
};

const DEFAULT_VARIANT_CONFIG = {
    type: 'button_template',
    slides: [{ ...EMPTY_SLIDE }],
    message: '',
    quickReplies: [{ id: '1', title: '' }],
    buttons: [{ id: '1', label: '', url: '' }],
};

// Instagram caps DM text at 1000 chars. Facebook is more permissive (2000)
// but we use the stricter limit to avoid platform-specific surprises.
const MESSAGE_LIMIT = 1000;
// Generic Template title (used by Multi-CTA card heading) — Meta hard cap.
const MULTI_CTA_TITLE_LIMIT = 80;

const DM_TYPES = [
    { value: 'button_template',  label: 'Button Template', icon: '🖼️', desc: 'Image card with a CTA button',           pro: false },
    { value: 'message_template', label: 'Message',         icon: '💬', desc: 'Plain text DM with variables',           pro: false },
    { value: 'quick_reply',      label: 'Quick Reply',     icon: '⚡', desc: 'Message with tappable reply chips',      pro: false },
    { value: 'multi_cta',        label: 'Multi-CTA',       icon: '🔗', desc: 'Text + up to 3 URL buttons',            pro: false },
    { value: 'follow_up',        label: 'Follow Gate',     icon: '🔒', desc: 'Send link only after they follow',       pro: true  },
    { value: 'email_collector',  label: 'Email Collector', icon: '📧', desc: 'Ask for their email and save as a lead', pro: true  },
];

export default function DMSetupTab({
    config, onChange, templates = [],
    onLoadTemplate, onDeleteTemplate,
    userPlan = 'free',
    platform = 'instagram',
    activeSlideIndex = 0, onSlideChange,
    activeAbVariant = 'A', onAbVariantChange,
}) {
    const isFacebook = platform === 'facebook';
    // On Facebook, send-dm.js can only send plain text — rich types
    // collapse to text. So we restrict the picker to message_template
    // (and surface a note explaining why).
    const availableTypes = isFacebook
        ? DM_TYPES.filter((t) => t.value === 'message_template')
        : DM_TYPES;
    const styles = useStyles(darkStyles, lightStyles);
    const { confirm, alert } = useConfirm();
    const isPro = userPlan === 'pro' || userPlan === 'business' || userPlan === 'trial';
    const fileInputRefs    = useRef({});
    const rewardImageRef   = useRef(null);
    const [_localSlide, _setLocalSlide] = useState(0);
    const setActiveSlideIndex = onSlideChange || _setLocalSlide;
    const [rewardSlideIndex, setRewardSlideIndex]   = useState(0);
    /* Save Template state moved out of DMSetupTab — the Save action
       lives in the Settings tab now (end of the wizard flow). DMSetupTab
       is only responsible for *loading* a template here. */
    const [isFetchingUrl, setIsFetchingUrl]         = useState(false);
    const [fetchError, setFetchError]               = useState('');
    // Progressive disclosure — both collapsed by default for noob users.
    // Advanced auto-opens when A/B is enabled so variant pills stay reachable.
    const [showAdvanced, setShowAdvanced]           = useState(false);
    const [showTemplates, setShowTemplates]         = useState(templates.length > 0);
    /* When true, the Templates dropdown switches purpose: instead of
       loading the picked template, picking it triggers delete. Replaces
       the old "type the template name to find it" prompt() flow which
       could fail silently on typos. */
    const [templateDeleteMode, setTemplateDeleteMode] = useState(false);

    // Force the saved DM type to message_template when configuring a
    // Facebook post. Without this, a previously-saved 'button_template'
    // would stay in formConfig and get persisted on next save even though
    // the picker only shows the message option.
    useEffect(() => {
        if (isFacebook && config.type && config.type !== 'message_template') {
            onChange?.({ ...config, type: 'message_template' });
        }
    }, [isFacebook, config, onChange]);

    // ─── A/B routing ─────────────────────────────────────────────
    const isAB = !!config.abEnabled;

    const formConfig = useMemo(() => {
        if (!isAB) return config;
        const key = activeAbVariant === 'A' ? 'variantA' : 'variantB';
        return config[key] || { ...DEFAULT_VARIANT_CONFIG };
    }, [isAB, activeAbVariant, config]);

    const updateFormConfig = useCallback((updates) => {
        if (!isAB) {
            onChange({ ...config, ...updates });
            return;
        }
        const key = activeAbVariant === 'A' ? 'variantA' : 'variantB';
        onChange({ ...config, [key]: { ...(config[key] || {}), ...updates } });
    }, [isAB, activeAbVariant, config, onChange]);

    /* Returns true if a variant has user-entered content worth preserving.
       Used to warn before discarding variant B when A/B testing is turned
       off. A "blank" variant (default empty slide, empty message, empty
       buttons) returns false so the toggle stays one click. */
    const variantHasData = (v) => {
        if (!v) return false;
        if (v.message && v.message.trim()) return true;
        if (Array.isArray(v.slides)
            && v.slides.some((s) => s.imageUrl || s.headline || s.description
                || (s.buttons || []).some((b) => b.label || b.value)
                || s.buttonLabel || s.buttonUrl)) return true;
        if (Array.isArray(v.quickReplies) && v.quickReplies.some((q) => q.title)) return true;
        if (Array.isArray(v.buttons) && v.buttons.some((b) => b.label || b.url)) return true;
        return false;
    };

    const handleToggleAB = async () => {
        if (!isAB) {
            setShowAdvanced(true); // ensure Advanced section is open so variant pills are visible
            onChange({
                ...config,
                abEnabled: true,
                variantA: {
                    type: config.type || 'button_template',
                    slides: config.slides || [{ ...EMPTY_SLIDE }],
                    message: config.message || '',
                    quickReplies: config.quickReplies || [{ id: '1', title: '' }],
                    buttons: config.buttons || [{ id: '1', label: '', url: '' }],
                    branding: config.branding,
                },
                variantB: { ...DEFAULT_VARIANT_CONFIG },
            });
            if (onAbVariantChange) onAbVariantChange('A');
        } else {
            // Warn before discarding variant B if it has real content. Variant A
            // is preserved (becomes the new root config), so no warning needed
            // for that side.
            if (variantHasData(config.variantB)) {
                const ok = await confirm({
                    title: 'Disable A/B testing?',
                    message: 'Variant B has unsaved content. Turning off A/B testing will discard variant B and keep only variant A.',
                    confirmText: 'Discard variant B',
                });
                if (!ok) return;
            }
            const vA = config.variantA || {};
            onChange({
                ...config,
                abEnabled: false,
                abWinner: undefined,
                type: vA.type || config.type || 'button_template',
                slides: vA.slides || config.slides || [{ ...EMPTY_SLIDE }],
                message: vA.message || config.message || '',
                quickReplies: vA.quickReplies || config.quickReplies,
                buttons: vA.buttons || config.buttons,
                branding: vA.branding || config.branding,
            });
        }
    };

    // ─── Slide management ────────────────────────────────────────
    // Meta's Generic Template hard-caps a carousel at 10 cards regardless of
    // plan. Free users hit FREE_SLIDE_LIMIT first; Pro users can go all the
    // way to META_MAX_CARDS.
    const META_MAX_CARDS = 10;
    const slideCount     = (formConfig.slides || []).length;
    const planSlideCap   = isPro ? META_MAX_CARDS : FREE_SLIDE_LIMIT;
    const atSlideLimit   = slideCount >= planSlideCap;
    const atMetaSlideCap = slideCount >= META_MAX_CARDS;

    // Drag-to-reorder state — index of the pill currently being dragged.
    const [dragSlideIndex, setDragSlideIndex] = useState(null);
    const [dragOverIndex,  setDragOverIndex]  = useState(null);

    const addSlide = () => {
        if (atSlideLimit) return;
        const newSlides = [...(formConfig.slides || []), { ...EMPTY_SLIDE }];
        updateFormConfig({ slides: newSlides });
        setActiveSlideIndex(newSlides.length - 1);
    };
    const removeSlide = (index) => {
        if ((formConfig.slides || []).length <= 1) return;
        const newSlides = (formConfig.slides || []).filter((_, i) => i !== index);
        updateFormConfig({ slides: newSlides });
        // Keep the active index pointing at a real slide
        setActiveSlideIndex((cur) => {
            if (cur === index) return Math.max(0, index - 1);
            if (cur > index) return cur - 1;
            return cur;
        });
    };
    const reorderSlides = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const next = [...(formConfig.slides || [])];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        updateFormConfig({ slides: next });
        // Track the active slide as it moves
        setActiveSlideIndex((cur) => {
            if (cur === fromIndex) return toIndex;
            if (fromIndex < cur && cur <= toIndex) return cur - 1;
            if (toIndex <= cur && cur < fromIndex) return cur + 1;
            return cur;
        });
    };

    // Status indicator for each pill: 'complete' | 'partial' | 'empty'
    const slideStatus = (slide) => {
        const hasImage    = !!slide?.imageUrl;
        const hasHeadline = !!slide?.headline?.trim();
        const hasButton   = !!(slide?.buttonLabel?.trim() && slide?.buttonUrl?.trim());
        const filledCount = [hasImage, hasHeadline, hasButton].filter(Boolean).length;
        if (filledCount === 0) return 'empty';
        if (filledCount === 3) return 'complete';
        return 'partial';
    };
    const slides       = formConfig.slides || [{ ...EMPTY_SLIDE }];
    const currentSlide = slides[activeSlideIndex] || slides[0] || EMPTY_SLIDE;
    const updateCurrentSlide = useCallback((updates) => {
        const newSlides = [...(formConfig.slides || [])];
        newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], ...updates };
        if (updates.buttonLabel !== undefined || updates.buttonUrl !== undefined) {
            const label = updates.buttonLabel ?? newSlides[activeSlideIndex].buttonLabel ?? '';
            const value = updates.buttonUrl   ?? newSlides[activeSlideIndex].buttonUrl   ?? '';
            newSlides[activeSlideIndex].buttons = [{ type: 'url', label, value }];
        }
        updateFormConfig({ slides: newSlides });
    }, [formConfig.slides, activeSlideIndex, updateFormConfig]);

    // ─── Quick Reply chips ────────────────────────────────────────
    // Each chip has: { id, title, responseMessage }. The responseMessage is
    // sent back to the recipient when they tap that chip — that's how the
    // intent-qualification loop closes (webhook handler matches the chip's
    // payload back to this config).
    const quickReplies = formConfig.quickReplies || [{ id: '1', title: '', responseMessage: '' }];
    const updateQuickReplies = (r) => updateFormConfig({ quickReplies: r });
    const addQuickReply = () => {
        if (quickReplies.length >= 5) return;
        updateQuickReplies([...quickReplies, { id: Date.now().toString(), title: '', responseMessage: '' }]);
    };
    const removeQuickReply = (id) => updateQuickReplies(quickReplies.filter((q) => q.id !== id));
    const updateQuickReplyField = (id, patch) =>
        updateQuickReplies(quickReplies.map((q) => q.id === id ? { ...q, ...patch } : q));

    // ─── Multi-CTA buttons ────────────────────────────────────────
    const ctaButtons = formConfig.buttons || [{ id: '1', label: '', url: '' }];
    const updateCtaButtons = (b) => updateFormConfig({ buttons: b });
    const addCtaButton = () => {
        if (ctaButtons.length >= 3) return;
        updateCtaButtons([...ctaButtons, { id: Date.now().toString(), label: '', url: '' }]);
    };
    const removeCtaButton = (id) => updateCtaButtons(ctaButtons.filter((b) => b.id !== id));
    const updateCtaButton = (id, field, value) => updateCtaButtons(ctaButtons.map((b) => b.id === id ? { ...b, [field]: value } : b));

    // ─── URL fetch ───────────────────────────────────────────────
    const handleUrlChange = (url) => { updateCurrentSlide({ buttonUrl: url }); setFetchError(''); };
    const fetchUrlMetadata = async (url) => {
        if (!url || isFetchingUrl) return;
        try { new URL(url); } catch { setFetchError('Enter a valid URL'); return; }
        setIsFetchingUrl(true); setFetchError('');
        try {
            const res  = await fetch('/api/url-metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
            const data = await res.json();
            if (res.ok) {
                const updates = {};
                if (data.title && !currentSlide.headline)      updates.headline    = data.title;
                if (data.image && !currentSlide.imageUrl)      updates.imageUrl    = data.image;
                if (data.description && !currentSlide.description) updates.description = data.description;
                if (Object.keys(updates).length) updateCurrentSlide(updates);
            } else setFetchError(data.error || 'Could not fetch URL info');
        } catch (err) { setFetchError(`Fetch failed: ${err.message}`); }
        finally { setIsFetchingUrl(false); }
    };
    const handleUrlBlur    = () => { const url = currentSlide.buttonUrl?.trim(); if (url && !currentSlide.headline && !currentSlide.imageUrl) fetchUrlMetadata(url); };
    const handleUrlKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchUrlMetadata(currentSlide.buttonUrl?.trim()); } };

    // ─── Image upload ─────────────────────────────────────────────
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
            alert({ title: 'Unsupported file type', message: 'Please select a JPEG, PNG, WebP or GIF image.', danger: true });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert({ title: 'Image too large', message: 'Please choose an image smaller than 5 MB.', danger: true });
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => updateCurrentSlide({ imageUrl: ev.target.result });
        reader.readAsDataURL(file);
    };
    const triggerFileInput = () => fileInputRefs.current[`${activeAbVariant}-${activeSlideIndex}`]?.click();

    const addVariable = (v) => updateFormConfig({ message: (formConfig.message || '') + ` {${v}}` });

    // ─── Follow Gate reward helpers ───────────────────────────────
    const rewardConfig  = formConfig.linkDmConfig || {};
    const rewardSlides  = rewardConfig.slides?.length ? rewardConfig.slides : [{ ...EMPTY_SLIDE }];
    const safeRewardIdx = Math.min(rewardSlideIndex, rewardSlides.length - 1);
    const rewardSlide   = rewardSlides[safeRewardIdx] || rewardSlides[0] || {};
    const updateRewardSlide = (updates) => {
        const newSlides = [...rewardSlides];
        newSlides[safeRewardIdx] = { ...newSlides[safeRewardIdx], ...updates };
        updateFormConfig({ linkDmConfig: { ...rewardConfig, slides: newSlides } });
    };
    const addRewardSlide = () => {
        const newSlides = [...rewardSlides, { ...EMPTY_SLIDE }];
        updateFormConfig({ linkDmConfig: { ...rewardConfig, slides: newSlides } });
        setRewardSlideIndex(newSlides.length - 1);
    };
    const removeRewardSlide = (idx) => {
        if (rewardSlides.length <= 1) return;
        const newSlides = rewardSlides.filter((_, i) => i !== idx);
        updateFormConfig({ linkDmConfig: { ...rewardConfig, slides: newSlides } });
        setRewardSlideIndex(Math.min(safeRewardIdx, newSlides.length - 1));
    };
    const rewardButtons = rewardConfig.buttons || [{ id: '1', label: '', url: '' }];
    const updateRewardButtons = (b) => updateFormConfig({ linkDmConfig: { ...rewardConfig, buttons: b } });
    const addRewardButton    = () => { if (rewardButtons.length < 3) updateRewardButtons([...rewardButtons, { id: Date.now().toString(), label: '', url: '' }]); };
    const removeRewardButton = (id) => updateRewardButtons(rewardButtons.filter((b) => b.id !== id));
    const updateRewardButton = (id, field, value) => updateRewardButtons(rewardButtons.map((b) => b.id === id ? { ...b, [field]: value } : b));
    const handleRewardFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
            alert({ title: 'Unsupported file type', message: 'Please select a JPEG, PNG, WebP or GIF image.', danger: true });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert({ title: 'Image too large', message: 'Please choose an image smaller than 5 MB.', danger: true });
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => updateRewardSlide({ imageUrl: ev.target.result });
        reader.readAsDataURL(file);
    };

    // ─── Branding toggle ──────────────────────────────────────────
    // One unified toggle per DM, persisted on dm_config.appendBranding
    // (default true). When unchecked, every DM type sends without the
    // "— Sent with AutoDM · …" suffix. Available to all plans — Pro users
    // can additionally customise the suffix text via dm_config.branding.
    const brandingEnabled = formConfig.appendBranding !== false;
    /* Compact, single-line branding toggle. Used to be a fat checkbox
       row with a 2-line description; now it sits inline as a quiet
       option at the bottom of the form. The "what does this do" detail
       is in the title attribute (hover) instead of always-visible
       helper text. */
    const BrandingToggle = () => (
        <label
            className={styles.brandingRow}
            title={'Adds a "Sent with AutoDM" footer line to the bottom of every DM.'}
        >
            <input
                type="checkbox"
                className={styles.checkbox}
                checked={brandingEnabled}
                onChange={(e) => updateFormConfig({ appendBranding: e.target.checked })}
            />
            <span>Append &ldquo;Sent with AutoDM&rdquo; branding</span>
        </label>
    );

    const winnerVariant = config.abWinner;

    return (
        <div className={styles.tab}>

            {/* ── DM Type selector ──
                Compact: "Type" label only (was a wordy "What do you want
                to send?"). The dropdown's selected label already includes
                the icon + name, so the redundant `.typeHint` description
                chip below is gone — it just repeated what the dropdown
                said. We still surface the upgrade prompt when a Pro-only
                type is selected without a Pro plan, since that's the only
                useful hint that block ever delivered. */}
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                    {isAB ? `Variant ${activeAbVariant} type` : 'Type'}
                </label>
                <Select
                    value={isFacebook ? 'message_template' : (formConfig.type || 'button_template')}
                    aria-label="Choose DM type"
                    onChange={(newValue, opt) => {
                        if (opt?.pro && !isPro) { window.location.href = '/pricing'; return; }
                        updateFormConfig({ type: newValue });
                    }}
                    options={availableTypes.map((t) => ({
                        value: t.value,
                        label: `${t.icon} ${t.label}`,
                        badge: t.pro ? 'PRO' : null,
                        desc: t.desc,
                        pro: t.pro,
                    }))}
                />
                {isFacebook && (
                    <div className={styles.fbNote}>
                        Facebook Pages support plain-text DMs only. Button cards, quick replies, and other rich formats are Instagram-only.
                    </div>
                )}
                {(() => {
                    const selected = DM_TYPES.find((t) => t.value === formConfig.type);
                    if (!selected || !selected.pro || isPro) return null;
                    // Only renders for Pro-locked types — the upgrade hint
                    // is the only piece of typeHint still pulling its weight.
                    return (
                        <div className={styles.typeHint}>
                            <Lock size={11} />
                            <span>This type is Pro-only.</span>
                            <a href="/pricing" className={styles.typeHintLink}>Upgrade</a>
                        </div>
                    );
                })()}
            </div>

            {/* ══════════ Button Template ══════════ */}
            {formConfig.type === 'button_template' && (
                <div className={styles.section}>
                    <div className={styles.carouselPills}>
                        <div className={styles.carouselHeader}>
                            <span className={styles.carouselLabel}>Slides</span>
                            <span className={styles.carouselCount}>
                                {slides.length} of {isPro ? META_MAX_CARDS : FREE_SLIDE_LIMIT}
                            </span>
                        </div>
                        <div className={styles.pillRow}>
                            {slides.map((slide, i) => {
                                const status = slideStatus(slide);
                                const isActive = i === activeSlideIndex;
                                const isDragOver = dragOverIndex === i && dragSlideIndex !== null && dragSlideIndex !== i;
                                return (
                                    <div
                                        key={i}
                                        className={`${styles.pillWrap} ${isDragOver ? styles.pillDragOver : ''} ${dragSlideIndex === i ? styles.pillDragging : ''}`}
                                        draggable={slides.length > 1}
                                        onDragStart={(e) => {
                                            setDragSlideIndex(i);
                                            // Required for some browsers to start the drag
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', String(i));
                                        }}
                                        onDragOver={(e) => {
                                            if (dragSlideIndex === null) return;
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (dragOverIndex !== i) setDragOverIndex(i);
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverIndex === i) setDragOverIndex(null);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (dragSlideIndex !== null && dragSlideIndex !== i) {
                                                reorderSlides(dragSlideIndex, i);
                                            }
                                            setDragSlideIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                        onDragEnd={() => {
                                            setDragSlideIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
                                            onClick={() => setActiveSlideIndex(i)}
                                            title={`Slide ${i + 1} — ${status}`}
                                        >
                                            <span className={`${styles.pillStatusDot} ${styles[`pillStatusDot_${status}`]}`} />
                                            {i + 1}
                                        </button>
                                        {slides.length > 1 && (
                                            <button
                                                type="button"
                                                className={styles.pillRemove}
                                                onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                                                title={`Remove slide ${i + 1}`}
                                                aria-label={`Remove slide ${i + 1}`}
                                            >
                                                <X size={11} strokeWidth={2.6} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {atSlideLimit ? (
                                atMetaSlideCap ? (
                                    <span className={styles.pillAdd} title={`Instagram supports up to ${META_MAX_CARDS} cards per carousel`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, opacity: 0.4, cursor: 'not-allowed' }}>
                                        <Plus size={14} />
                                    </span>
                                ) : (
                                    <a href="/pricing" className={styles.pillAdd} title="Upgrade to Pro for unlimited slides" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none', opacity: 0.7 }}>
                                        <Plus size={14} />
                                        <span style={{ fontSize: 10, fontWeight: 600 }}>Pro</span>
                                    </a>
                                )
                            ) : (
                                <button type="button" className={styles.pillAdd} onClick={addSlide} title="Add slide"><Plus size={14} /></button>
                            )}
                        </div>
                    </div>
                    {/* Field order is authoring-flow first: pasting Button URL
                        auto-fetches headline / description / image (handleUrlBlur
                        calls fetchUrlMetadata). The slide form is now flat —
                        previously it was three nested cards (formPanel → slideForm
                        → ctaGroup), each with its own border+padding adding visual
                        weight without information. */}
                    <div className={styles.slideForm}>

                        {/* Button URL + label — paired on one row at ≥520px.
                            Labels are pure text (no icons) so both pieces sit at
                            identical line-heights and the inputs below them line
                            up exactly. URL takes 1.6× the label's width because
                            URLs are meaningfully longer than CTA labels. */}
                        <div className={styles.fieldRow2col}>
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Button URL</label>
                                <div className={styles.urlInputRow}>
                                    <input className={`${styles.input} ${styles.urlInput}`} placeholder="https://amazon.in/product..." value={currentSlide.buttonUrl || ''} onChange={(e) => handleUrlChange(e.target.value)} onBlur={handleUrlBlur} onKeyDown={handleUrlKeyDown} />
                                    {isFetchingUrl && <div className={styles.fetchSpinner}><Loader2 size={15} className={styles.spinning} /></div>}
                                </div>
                                {!currentSlide.buttonUrl && !fetchError && (
                                    <span className={styles.fieldHint}>Paste a link — we&apos;ll auto-fill the rest.</span>
                                )}
                                {fetchError && <span className={styles.fetchError}>{fetchError}</span>}
                            </div>
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Button label</label>
                                <input className={styles.input} placeholder="Shop Now" value={currentSlide.buttonLabel || ''} onChange={(e) => updateCurrentSlide({ buttonLabel: e.target.value })} />
                            </div>
                        </div>

                        {/* Image — proper drop zone with stacked icon + helper
                            text instead of a single-line "Upload Image" button.
                            More inviting affordance, matches the spaciousness of
                            the rest of the redesigned form. */}
                        <div className={styles.formField}>
                            <label className={styles.fieldLabel}>Image</label>
                            <input type="file" accept="image/*" ref={(el) => (fileInputRefs.current[`${activeAbVariant}-${activeSlideIndex}`] = el)} onChange={handleFileSelect} className={styles.hiddenFileInput} />
                            {currentSlide.imageUrl ? (
                                <div className={styles.uploadedImage}>
                                    <img src={currentSlide.imageUrl} alt={`Slide ${activeSlideIndex + 1}`} onClick={triggerFileInput} />
                                    <div className={styles.imageOverlay} onClick={triggerFileInput}>
                                        <ImageIcon size={18} /><span>Change</span>
                                    </div>
                                    <button
                                        className={styles.imageRemoveBtn}
                                        onClick={(e) => { e.stopPropagation(); updateCurrentSlide({ imageUrl: '' }); }}
                                        title="Remove image"
                                        type="button"
                                        aria-label="Remove image"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.uploadDropZone}
                                    onClick={triggerFileInput}
                                >
                                    <UploadCloud size={22} className={styles.uploadDropZoneIcon} />
                                    <span className={styles.uploadDropZoneTitle}>Click to upload an image</span>
                                    <span className={styles.uploadDropZoneHint}>PNG, JPG, WebP &middot; up to 5&thinsp;MB</span>
                                </button>
                            )}
                        </div>

                        {/* Headline + Description — full-width stacked rows.
                            Pairing them side-by-side made the textarea cramped
                            (~220px wide) while the headline input was the same
                            cramped width but only needed one line. Now each gets
                            the full form width: headline on its own short row,
                            description on its own taller row (rows=3) so users
                            can actually see what they're typing without using
                            the corner resize handle. Char counter stays inline
                            to the description label. */}
                        <div className={styles.formField}>
                            <label className={styles.fieldLabel}>Headline</label>
                            <input className={styles.input} placeholder="Product name or headline..." value={currentSlide.headline || ''} onChange={(e) => updateCurrentSlide({ headline: e.target.value })} />
                            {isFetchingUrl && <span className={styles.fetchHint}>Fetching from URL...</span>}
                        </div>
                        <div className={styles.formField}>
                            <div className={styles.formLabelRow}>
                                <label className={styles.fieldLabel}>Description</label>
                                <span className={styles.charCounter}>
                                    {(currentSlide.description || '').length} / 80
                                </span>
                            </div>
                            <textarea
                                className={`${styles.input} ${styles.messageArea}`}
                                placeholder="Shown under the headline…"
                                rows={3}
                                maxLength={80}
                                value={currentSlide.description || ''}
                                onChange={(e) => updateCurrentSlide({ description: e.target.value })}
                            />
                        </div>
                    </div>
                    <BrandingToggle />
                </div>
            )}

            {/* ══════════ Message Template ══════════ */}
            {formConfig.type === 'message_template' && (
                <div className={styles.section}>
                    <div className={styles.formGroup}>
                        <div className={styles.formLabelRow}>
                            <label className={styles.formLabel}>Message</label>
                            <span className={`${styles.charCounter} ${(formConfig.message || '').length >= MESSAGE_LIMIT ? styles.charCounterOver : ''}`}>
                                {(formConfig.message || '').length} / {MESSAGE_LIMIT}
                            </span>
                        </div>
                        <textarea
                            className={`${styles.input} ${styles.messageArea}`}
                            placeholder="Type your message here..."
                            rows={5}
                            maxLength={MESSAGE_LIMIT}
                            value={formConfig.message || ''}
                            onChange={(e) => updateFormConfig({ message: e.target.value })}
                        />
                        {!(formConfig.message || '').trim() && (
                            <span className={styles.fieldHint}>Add a message — empty messages can&apos;t be saved.</span>
                        )}
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => addVariable('first_name')}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => addVariable('username')}>{'{username}'}</button>
                    </div>
                    <BrandingToggle />
                </div>
            )}

            {/* ══════════ Quick Reply ══════════ */}
            {formConfig.type === 'quick_reply' && (
                <div className={styles.section}>
                    <div className={styles.infoBox}>
                        <Zap size={13} />
                        <span>Users tap a chip to send that reply. Great for qualifying intent before sending the link.</span>
                    </div>
                    <div className={styles.formGroup}>
                        <div className={styles.formLabelRow}>
                            <label className={styles.formLabel}>Opening Message</label>
                            <span className={`${styles.charCounter} ${(formConfig.message || '').length >= MESSAGE_LIMIT ? styles.charCounterOver : ''}`}>
                                {(formConfig.message || '').length} / {MESSAGE_LIMIT}
                            </span>
                        </div>
                        <textarea
                            className={`${styles.input} ${styles.messageArea}`}
                            placeholder="E.g., Which product are you interested in? 👇"
                            rows={3}
                            maxLength={MESSAGE_LIMIT}
                            value={formConfig.message || ''}
                            onChange={(e) => updateFormConfig({ message: e.target.value })}
                        />
                        {!(formConfig.message || '').trim() && (
                            <span className={styles.fieldHint}>Add an opening message — empty messages can&apos;t be saved.</span>
                        )}
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => addVariable('first_name')}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => addVariable('username')}>{'{username}'}</button>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Quick Reply Options <span className={styles.limitNote}>(max 5)</span></label>
                        <div className={styles.chipList}>
                            {quickReplies.map((qr, qIdx) => (
                                <div key={qr.id} className={styles.chipCard}>
                                    <div className={styles.chipCardHeader}>
                                        <span className={styles.chipCardIndex}>{qIdx + 1}</span>
                                        <input
                                            className={`${styles.input} ${styles.chipInput}`}
                                            placeholder="Chip label (e.g., Send me the link)"
                                            value={qr.title}
                                            maxLength={20}
                                            onChange={(e) => updateQuickReplyField(qr.id, { title: e.target.value })}
                                        />
                                        <span className={styles.charCount}>{(qr.title || '').length}/20</span>
                                        {quickReplies.length > 1 && (
                                            <button className={styles.removeChipBtn} onClick={() => removeQuickReply(qr.id)} title="Remove chip">
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div className={styles.chipCardResponse}>
                                        <label className={styles.chipResponseLabel}>Reply when tapped</label>
                                        <textarea
                                            className={`${styles.input} ${styles.chipResponseArea}`}
                                            placeholder="E.g., Awesome! Here's the link: https://yourbrand.co/drop"
                                            rows={2}
                                            maxLength={MESSAGE_LIMIT}
                                            value={qr.responseMessage || ''}
                                            onChange={(e) => updateQuickReplyField(qr.id, { responseMessage: e.target.value })}
                                        />
                                        <span className={styles.fieldHint}>
                                            Sent as a DM the moment the user taps this chip. Paste a URL — Instagram auto-links it.
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {quickReplies.length < 5 && (
                                <button className={styles.addChipBtn} onClick={addQuickReply}>
                                    <Plus size={13} /> Add option
                                </button>
                            )}
                        </div>
                    </div>
                    <BrandingToggle />
                </div>
            )}

            {/* ══════════ Multi-CTA ══════════ */}
            {formConfig.type === 'multi_cta' && (
                <div className={styles.section}>
                    <div className={styles.infoBox}>
                        <MousePointerClick size={13} />
                        <span>A short heading with up to 3 URL buttons — fastest format to set up. No image required.</span>
                    </div>
                    <div className={styles.formGroup}>
                        <div className={styles.formLabelRow}>
                            <label className={styles.formLabel}>Card heading</label>
                            <span className={`${styles.charCounter} ${(formConfig.message || '').length >= MULTI_CTA_TITLE_LIMIT ? styles.charCounterOver : ''}`}>
                                {(formConfig.message || '').length} / {MULTI_CTA_TITLE_LIMIT}
                            </span>
                        </div>
                        <textarea
                            className={`${styles.input} ${styles.messageArea}`}
                            placeholder="E.g., Here are 3 things you can grab:"
                            rows={2}
                            maxLength={MULTI_CTA_TITLE_LIMIT}
                            value={formConfig.message || ''}
                            onChange={(e) => updateFormConfig({ message: e.target.value })}
                        />
                        <span className={styles.fieldHint}>
                            Instagram caps the card heading at {MULTI_CTA_TITLE_LIMIT} characters.
                        </span>
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => addVariable('first_name')}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => addVariable('username')}>{'{username}'}</button>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>CTA Buttons <span className={styles.limitNote}>(max 3)</span></label>
                        <div className={styles.ctaList}>
                            {ctaButtons.map((btn, idx) => (
                                <div key={btn.id} className={styles.ctaRow}>
                                    <span className={styles.ctaNum}>{idx + 1}</span>
                                    <input className={styles.input} placeholder="Button label" value={btn.label} maxLength={20} style={{ flex: '0 0 140px' }} onChange={(e) => updateCtaButton(btn.id, 'label', e.target.value)} />
                                    <input
                                        className={`${styles.input} ${styles.ctaUrl}`}
                                        type="url"
                                        inputMode="url"
                                        placeholder="https://yourbrand.co/drop"
                                        value={btn.url}
                                        onChange={(e) => updateCtaButton(btn.id, 'url', e.target.value)}
                                    />
                                    {ctaButtons.length > 1 && <button className={styles.removeChipBtn} onClick={() => removeCtaButton(btn.id)}><Trash2 size={12} /></button>}
                                </div>
                            ))}
                            {ctaButtons.length < 3 && <button className={styles.addChipBtn} onClick={addCtaButton}><Plus size={13} /> Add button</button>}
                        </div>
                        <span className={styles.fieldHint}>
                            Don&apos;t worry about <code>https://</code> — we&apos;ll add it if you forget.
                        </span>
                    </div>
                    <BrandingToggle />
                </div>
            )}

            {/* ══════════ Email Collector ══════════ */}
            {formConfig.type === 'email_collector' && (
                <div className={styles.section}>
                    <div className={`${styles.infoBox} ${styles.infoBoxBlue}`}>
                        <span style={{ fontSize: 14 }}>📧</span>
                        <span>When someone comments, we DM them asking for their email. Their reply is saved to your lead list automatically.</span>
                    </div>

                    <div className={styles.stepHeader}>
                        <span className={styles.stepBadge}>1</span>
                        <span className={styles.stepTitle}>Ask Message</span>
                        <span className={styles.stepDesc}>Sent immediately when someone comments</span>
                    </div>
                    <div className={styles.formGroup}>
                        <div className={styles.formLabelRow}>
                            <label className={styles.formLabel}>Ask message</label>
                            <span className={`${styles.charCounter} ${(formConfig.emailAskMessage || '').length >= MESSAGE_LIMIT ? styles.charCounterOver : ''}`}>
                                {(formConfig.emailAskMessage || '').length} / {MESSAGE_LIMIT}
                            </span>
                        </div>
                        <textarea
                            className={`${styles.input} ${styles.messageArea}`}
                            placeholder={`Hey {first_name}! 👋 Could you share your email address? I'll send you the details directly 📧`}
                            rows={3}
                            maxLength={MESSAGE_LIMIT}
                            value={formConfig.emailAskMessage || ''}
                            onChange={(e) => updateFormConfig({ emailAskMessage: e.target.value })}
                        />
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => updateFormConfig({ emailAskMessage: (formConfig.emailAskMessage || '') + ' {first_name}' })}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => updateFormConfig({ emailAskMessage: (formConfig.emailAskMessage || '') + ' {username}' })}>{'{username}'}</button>
                    </div>

                    <div className={styles.stepHeader}>
                        <span className={styles.stepBadge}>2</span>
                        <span className={styles.stepTitle}>Confirmation Message</span>
                        <span className={styles.stepDesc}>Sent after we capture their email</span>
                    </div>
                    <div className={styles.formGroup}>
                        <div className={styles.formLabelRow}>
                            <label className={styles.formLabel}>Confirmation message</label>
                            <span className={`${styles.charCounter} ${(formConfig.emailConfirmMessage || '').length >= MESSAGE_LIMIT ? styles.charCounterOver : ''}`}>
                                {(formConfig.emailConfirmMessage || '').length} / {MESSAGE_LIMIT}
                            </span>
                        </div>
                        <textarea
                            className={`${styles.input} ${styles.messageArea}`}
                            placeholder={`Thanks {first_name}! 🎉 We've got your email ({email}) and will be in touch soon.`}
                            rows={2}
                            maxLength={MESSAGE_LIMIT}
                            value={formConfig.emailConfirmMessage || ''}
                            onChange={(e) => updateFormConfig({ emailConfirmMessage: e.target.value })}
                        />
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => updateFormConfig({ emailConfirmMessage: (formConfig.emailConfirmMessage || '') + ' {first_name}' })}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => updateFormConfig({ emailConfirmMessage: (formConfig.emailConfirmMessage || '') + ' {email}' })}>{'{email}'}</button>
                    </div>

                    <div className={`${styles.infoBox} ${styles.infoBoxAmber}`} style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 13 }}>💡</span>
                        <span>Collected emails appear under <strong>Email Leads</strong> in the sidebar. Export them as CSV anytime.</span>
                    </div>
                    <BrandingToggle />
                </div>
            )}

            {/* ══════════ Follow Gate ══════════ */}
            {formConfig.type === 'follow_up' && (
                <div className={styles.section}>
                    <div className={`${styles.infoBox} ${styles.infoBoxViolet}`}>
                        <span style={{ fontSize: 14 }}>🔒</span>
                        <span>Comment triggers the gate message with <strong>✅ Yes, I followed!</strong> and <strong>❌ No, not yet</strong> reply buttons.</span>
                    </div>
                    <div className={styles.stepHeader}>
                        <span className={styles.stepBadge}>1</span>
                        <span className={styles.stepTitle}>Gate Message</span>
                        <span className={styles.stepDesc}>Sent immediately when someone comments</span>
                    </div>
                    <div className={styles.formGroup}>
                        <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="Hey {first_name}! 👋 To get the link, follow our page first, then reply YES 👇" rows={3} value={formConfig.gateMessage || ''} onChange={(e) => updateFormConfig({ gateMessage: e.target.value })} />
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => updateFormConfig({ gateMessage: (formConfig.gateMessage || '') + ' {first_name}' })}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => updateFormConfig({ gateMessage: (formConfig.gateMessage || '') + ' {username}' })}>{'{username}'}</button>
                    </div>
                    <BrandingToggle />
                    <div className={styles.stepHeader}>
                        <span className={styles.stepBadge}>2</span>
                        <span className={styles.stepTitle}>Not-Following Nudge</span>
                    </div>
                    <div className={styles.formGroup}>
                        <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="We couldn't verify your follow yet 🙈" rows={2} value={formConfig.nudgeMessage || ''} onChange={(e) => updateFormConfig({ nudgeMessage: e.target.value })} />
                    </div>
                    <div className={styles.stepHeader}>
                        <span className={styles.stepBadge}>3</span>
                        <span className={styles.stepTitle}>Decline Message</span>
                    </div>
                    <div className={styles.formGroup}>
                        <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="No worries! Follow us and tap ✅ Yes whenever you're ready 🙌" rows={2} value={formConfig.declineMessage || ''} onChange={(e) => updateFormConfig({ declineMessage: e.target.value })} />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Max retries</label>
                        <Select
                            value={formConfig.maxRetries || 3}
                            aria-label="Max retries"
                            onChange={(v) => updateFormConfig({ maxRetries: Number(v) })}
                            options={[
                                { value: 1, label: '1 attempt' },
                                { value: 2, label: '2 attempts' },
                                { value: 3, label: '3 attempts (recommended)' },
                                { value: 5, label: '5 attempts' },
                            ]}
                        />
                    </div>
                    <div className={styles.stepHeader}>
                        <span className={styles.stepBadge}>4</span>
                        <span className={styles.stepTitle}>Reward Link</span>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Reward type</label>
                        <Select
                            value={formConfig.linkDmType || 'message_template'}
                            aria-label="Reward type"
                            onChange={(v) => updateFormConfig({ linkDmType: v })}
                            options={[
                                { value: 'message_template', label: '💬 Text message',         desc: 'Plain text DM with the link' },
                                { value: 'button_template',  label: '🖼️ Button card',          desc: 'Image card with a CTA button' },
                                { value: 'multi_cta',        label: '🔗 Multi-CTA',            desc: 'Text + up to 3 URL buttons' },
                            ]}
                        />
                    </div>

                    {/* Reward: Text message */}
                    {(!formConfig.linkDmType || formConfig.linkDmType === 'message_template') && (
                        <div className={styles.formGroup}>
                            <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="🎉 Thanks for following! Here's your link: https://..." rows={3} value={formConfig.linkMessage || ''} onChange={(e) => updateFormConfig({ linkMessage: e.target.value, linkDmConfig: { message: e.target.value } })} />
                        </div>
                    )}

                    {/* Reward: Button card (multi-slide) */}
                    {formConfig.linkDmType === 'button_template' && (
                        <div className={styles.section} style={{ paddingTop: 0 }}>
                            <div className={styles.carouselPills}>
                                <span className={styles.carouselLabel}>Reward Slides</span>
                                <div className={styles.pillRow}>
                                    {rewardSlides.map((_, i) => (
                                        <button key={i} className={`${styles.pill} ${i === safeRewardIdx ? styles.pillActive : ''}`} onClick={() => setRewardSlideIndex(i)}>{i + 1}</button>
                                    ))}
                                    <button className={styles.pillAdd} onClick={addRewardSlide} title="Add reward slide"><Plus size={14} /></button>
                                    {rewardSlides.length > 1 && <button className={styles.pillDelete} onClick={() => removeRewardSlide(safeRewardIdx)} title="Remove slide"><Trash2 size={13} /></button>}
                                </div>
                            </div>
                            {/* CTA on top — matches the main slide editor so
                                users get a consistent authoring flow. The
                                reward editor doesn't auto-fetch URL metadata
                                (no handleUrlBlur), but keeping the order
                                identical avoids context-switching. */}
                            <div className={styles.slideForm}>
                                <div className={styles.ctaGroup}>
                                    <div className={styles.ctaGroupHeader}>
                                        <Link2 size={12} />
                                        <span>Call to action</span>
                                    </div>
                                    <div className={styles.formField}>
                                        <label className={styles.fieldLabel}>Button URL</label>
                                        <input className={`${styles.input} ${styles.urlInput}`} placeholder="https://..." value={rewardSlide.buttonUrl || ''} onChange={(e) => updateRewardSlide({ buttonUrl: e.target.value })} />
                                    </div>
                                    <div className={styles.formField}>
                                        <label className={styles.fieldLabel}>Button label</label>
                                        <input className={styles.input} placeholder="Claim Your Reward" value={rewardSlide.buttonLabel || ''} onChange={(e) => updateRewardSlide({ buttonLabel: e.target.value })} />
                                    </div>
                                </div>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>Image</label>
                                    <input type="file" accept="image/*" ref={rewardImageRef} onChange={handleRewardFileSelect} className={styles.hiddenFileInput} />
                                    {rewardSlide.imageUrl ? (
                                        <div className={styles.uploadedImage} onClick={() => rewardImageRef.current?.click()}>
                                            <img src={rewardSlide.imageUrl} alt="Reward" />
                                            <div className={styles.imageOverlay}><ImageIcon size={18} /><span>Change image</span></div>
                                        </div>
                                    ) : (
                                        <button className={styles.uploadBtn} onClick={() => rewardImageRef.current?.click()}><ImageIcon size={15} /> Upload Image</button>
                                    )}
                                </div>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>Headline</label>
                                    <input className={styles.input} placeholder="Here's your exclusive link 🎉" value={rewardSlide.headline || ''} onChange={(e) => updateRewardSlide({ headline: e.target.value })} />
                                </div>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>Description <span className={styles.limitNote}>(max 80 chars)</span></label>
                                    <textarea className={`${styles.input} ${styles.messageArea}`} rows={2} maxLength={80} placeholder="Optional description..." value={rewardSlide.description || ''} onChange={(e) => updateRewardSlide({ description: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reward: Multi-CTA */}
                    {formConfig.linkDmType === 'multi_cta' && (
                        <div className={styles.section} style={{ paddingTop: 0 }}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Message</label>
                                <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="🎉 Thanks for following! Here are your links:" rows={3} value={rewardConfig.message || ''} onChange={(e) => updateFormConfig({ linkDmConfig: { ...rewardConfig, message: e.target.value } })} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>CTA Buttons <span className={styles.limitNote}>(max 3)</span></label>
                                <div className={styles.ctaList}>
                                    {rewardButtons.map((btn, idx) => (
                                        <div key={btn.id} className={styles.ctaRow}>
                                            <span className={styles.ctaNum}>{idx + 1}</span>
                                            <input className={styles.input} placeholder="Button label" value={btn.label} maxLength={20} style={{ flex: '0 0 140px' }} onChange={(e) => updateRewardButton(btn.id, 'label', e.target.value)} />
                                            <input className={`${styles.input} ${styles.ctaUrl}`} placeholder="https://..." value={btn.url} onChange={(e) => updateRewardButton(btn.id, 'url', e.target.value)} />
                                            {rewardButtons.length > 1 && <button className={styles.removeChipBtn} onClick={() => removeRewardButton(btn.id)}><Trash2 size={12} /></button>}
                                        </div>
                                    ))}
                                    {rewardButtons.length < 3 && <button className={styles.addChipBtn} onClick={addRewardButton}><Plus size={13} /> Add button</button>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reward branding — same toggle as the gate, but bound
                        to linkDmConfig so the reward DM honors it on send. */}
                    <label
                        className={styles.checkboxLabel}
                        style={{ marginTop: 5, cursor: 'pointer' }}
                    >
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={(rewardConfig.appendBranding ?? true) !== false}
                            onChange={(e) => updateFormConfig({
                                linkDmConfig: { ...rewardConfig, appendBranding: e.target.checked },
                            })}
                        />
                        <span style={{ fontSize: 12 }}>
                            Append &ldquo;Sent with AutoDM&rdquo; branding to the reward DM
                            <span className={styles.fieldHint} style={{ display: 'block', marginTop: 2 }}>
                                Adds a footer line with our link to the reward message recipients see after they follow.
                            </span>
                        </span>
                    </label>
                </div>
            )}

            {/* ── Advanced options — collapsed by default ──────────────────────────
                 Auto-opens when A/B is enabled so variant pills stay reachable.
                 Locked open (non-collapsible) while A/B is active to prevent
                 the variant switcher from being hidden mid-setup.
            ─────────────────────────────────────────────────────────────────── */}
            <div className={styles.advancedSection}>
                <button
                    className={`${styles.advancedHeader} ${isAB ? styles.advancedHeaderLocked : ''}`}
                    onClick={() => { if (!isAB) setShowAdvanced((v) => !v); }}
                    type="button"
                    title={isAB ? 'Close A/B testing first to collapse this section' : undefined}
                >
                    <span className={styles.advancedHeaderLabel}>
                        <FlaskConical size={13} />
                        Advanced options
                        {isAB && <span className={styles.abActivePill}>A/B on</span>}
                    </span>
                    <ChevronDown
                        size={14}
                        className={`${styles.advancedChevron} ${(showAdvanced || isAB) ? styles.advancedChevronOpen : ''}`}
                    />
                </button>

                {(showAdvanced || isAB) && (
                    <div className={styles.advancedBody}>

                        {/* A/B Test toggle */}
                        <div className={styles.abCard}>
                            <div className={styles.abCardHeader}>
                                <div className={styles.abCardLeft}>
                                    <div className={`${styles.abCardIcon} ${isAB ? styles.abCardIconOn : ''}`}>
                                        <FlaskConical size={14} />
                                    </div>
                                    <div>
                                        <span className={styles.checkText} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            A/B Message Testing
                                            {!isPro && <span className={styles.proBadge}>Pro</span>}
                                        </span>
                                        <p className={styles.abCardDesc}>
                                            Send two different messages and see which gets more clicks.
                                            {isAB && winnerVariant && (
                                                <span className={styles.winnerHint}> 🏆 Winner: Variant {winnerVariant}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                {isPro ? (
                                    <div
                                        className={`${styles.toggle} ${isAB ? styles.toggleOn : ''}`}
                                        onClick={handleToggleAB}
                                        role="switch"
                                        aria-checked={isAB}
                                    >
                                        <div className={styles.toggleThumb} />
                                    </div>
                                ) : (
                                    <a href="/pricing" className={styles.abProLink}>Upgrade</a>
                                )}
                            </div>

                            {/* Variant A/B pills */}
                            {isAB && (
                                <div className={styles.variantPills}>
                                    {(['A', 'B']).map((v) => (
                                        <button
                                            key={v}
                                            className={`${styles.variantPill} ${activeAbVariant === v ? styles.variantPillActive : ''} ${winnerVariant === v ? styles.variantPillWinner : ''}`}
                                            onClick={() => onAbVariantChange?.(v)}
                                        >
                                            {winnerVariant === v && '🏆 '}
                                            Variant {v}
                                            {winnerVariant === v && <span className={styles.winnerBadge}>Winner</span>}
                                        </button>
                                    ))}
                                    <span className={styles.variantHint}>Editing Variant {activeAbVariant}</span>
                                </div>
                            )}
                        </div>

                        {/* Send DMs to previous comments */}
                        <div className={styles.comingSoonRow}>
                            <div className={styles.comingSoonLeft}>
                                <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    disabled={!isPro}
                                    checked={isPro && !!config.sendToPreviousComments}
                                    onChange={(e) => isPro && onChange({ ...config, sendToPreviousComments: e.target.checked })}
                                    style={{ cursor: isPro ? 'pointer' : 'not-allowed' }}
                                />
                                <div>
                                    <span className={styles.comingSoonLabel}>
                                        Send DMs to previous comments
                                        {!isPro && <span className={styles.proBadge}>Pro</span>}
                                    </span>
                                    <p className={styles.comingSoonDesc}>When you save this automation, AutoDM will fetch existing comments on this post and DM anyone who matches the trigger. Processed via your queue.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* ── Load template — collapsed when no templates yet.
                Save Template lives in the Settings tab now (the natural
                end-of-flow moment to capture the whole config). Load
                stays here because picking a starting point belongs at
                the start of the wizard. */}
            {templates.length > 0 && (
                <div className={styles.advancedSection}>
                    <button
                        className={styles.advancedHeader}
                        onClick={() => setShowTemplates((v) => !v)}
                        type="button"
                    >
                        <span className={styles.advancedHeaderLabel}>
                            <BookmarkPlus size={13} />
                            Load template
                            <span className={styles.templateCount}>{templates.length}</span>
                        </span>
                        <ChevronDown
                            size={14}
                            className={`${styles.advancedChevron} ${showTemplates ? styles.advancedChevronOpen : ''}`}
                        />
                    </button>

                    {showTemplates && (
                        <div className={styles.advancedBody}>
                            <div className={styles.templateBar}>
                                <div className={styles.templateSelect}>
                                    <Select
                                        value=""
                                        size="sm"
                                        placeholder={templateDeleteMode ? 'Pick template to delete…' : 'Load from template…'}
                                        aria-label={templateDeleteMode ? 'Delete a template' : 'Load from template'}
                                        onChange={async (id) => {
                                            const t = templates.find((t) => t.id === id);
                                            if (!t) return;
                                            if (templateDeleteMode) {
                                                const ok = await confirm({
                                                    title: `Delete "${t.name}"?`,
                                                    message: 'This template will be permanently removed.',
                                                    confirmText: 'Delete',
                                                });
                                                if (ok) onDeleteTemplate?.(t.id);
                                                setTemplateDeleteMode(false);
                                            } else {
                                                onLoadTemplate?.(t);
                                            }
                                        }}
                                        options={templates.map((t) => ({
                                            value: t.id,
                                            label: t.name,
                                            icon: templateDeleteMode
                                                ? <Trash2 size={13} />
                                                : <FileDown size={13} />,
                                        }))}
                                    />
                                    {onDeleteTemplate && (
                                        <button
                                            className={`${styles.deleteTemplateBtn} ${templateDeleteMode ? styles.deleteTemplateBtnActive : ''}`}
                                            title={templateDeleteMode ? 'Cancel delete' : 'Delete a template'}
                                            onClick={() => setTemplateDeleteMode((v) => !v)}
                                            type="button"
                                        >
                                            {templateDeleteMode ? <X size={13} /> : <Trash2 size={13} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
