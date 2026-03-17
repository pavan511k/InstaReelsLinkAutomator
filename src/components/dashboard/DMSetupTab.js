'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import {
    Plus, Trash2, Image as ImageIcon, BookmarkPlus, FileDown, Loader2,
    Link2, ExternalLink, MessageSquare, MousePointerClick, Zap, FlaskConical,
} from 'lucide-react';
import styles from './DMSetupTab.module.css';
import settingsStyles from './SettingsContent.module.css';

const EMPTY_SLIDE = {
    imageUrl: '', headline: '', buttonLabel: '',
    buttonUrl: '', buttons: [{ type: 'url', label: '', value: '' }],
};

const DEFAULT_VARIANT_CONFIG = {
    type: 'button_template',
    slides: [{ ...EMPTY_SLIDE }],
    message: '',
    quickReplies: [{ id: '1', title: '' }],
    buttons: [{ id: '1', label: '', url: '' }],
};

const DM_TYPES = [
    { value: 'button_template',  label: 'Button Template', icon: '🖼️', desc: 'Image card with a CTA button',       pro: false },
    { value: 'message_template', label: 'Message',         icon: '💬', desc: 'Plain text DM with variables',       pro: false },
    { value: 'quick_reply',      label: 'Quick Reply',     icon: '⚡', desc: 'Message with tappable reply chips',  pro: false },
    { value: 'multi_cta',        label: 'Multi-CTA',       icon: '🔗', desc: 'Text + up to 3 URL buttons',        pro: false },
    { value: 'follow_up',        label: 'Follow Gate',     icon: '🔒', desc: 'Send link only after they follow',   pro: true  },
];

export default function DMSetupTab({
    config, onChange, templates = [],
    onSaveTemplate, onLoadTemplate, onDeleteTemplate,
    userPlan = 'free',
    activeSlideIndex = 0, onSlideChange,
    activeAbVariant = 'A', onAbVariantChange,
}) {
    const isPro = userPlan === 'pro' || userPlan === 'business';
    const fileInputRefs = useRef({});
    const [_localSlide, _setLocalSlide] = useState(0);
    const setActiveSlideIndex = onSlideChange || _setLocalSlide;
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateName, setTemplateName]           = useState('');
    const [isFetchingUrl, setIsFetchingUrl]         = useState(false);
    const [fetchError, setFetchError]               = useState('');

    // ─── A/B routing ─────────────────────────────────────────────
    const isAB = !!config.abEnabled;

    // The "effective config" for the form — either the active variant or the whole config
    const formConfig = useMemo(() => {
        if (!isAB) return config;
        const key = activeAbVariant === 'A' ? 'variantA' : 'variantB';
        return config[key] || { ...DEFAULT_VARIANT_CONFIG };
    }, [isAB, activeAbVariant, config]);

    // The "effective onChange" — updates the right slot
    const updateFormConfig = useCallback((updates) => {
        if (!isAB) {
            onChange({ ...config, ...updates });
            return;
        }
        const key = activeAbVariant === 'A' ? 'variantA' : 'variantB';
        onChange({ ...config, [key]: { ...(config[key] || {}), ...updates } });
    }, [isAB, activeAbVariant, config, onChange]);

    // Toggle A/B on/off
    const handleToggleAB = () => {
        if (!isAB) {
            // Turn on: snapshot current config into variantA, start blank variantB
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
            // Turn off: restore variantA as main config
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
    const addSlide = () => {
        const newSlides = [...(formConfig.slides || []), { ...EMPTY_SLIDE }];
        updateFormConfig({ slides: newSlides });
        setActiveSlideIndex(newSlides.length - 1);
    };
    const removeSlide = (index) => {
        if ((formConfig.slides || []).length <= 1) return;
        const newSlides = (formConfig.slides || []).filter((_, i) => i !== index);
        updateFormConfig({ slides: newSlides });
        setActiveSlideIndex(Math.min(activeSlideIndex, newSlides.length - 1));
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
    const quickReplies = formConfig.quickReplies || [{ id: '1', title: '' }];
    const updateQuickReplies = (r) => updateFormConfig({ quickReplies: r });
    const addQuickReply = () => {
        if (quickReplies.length >= 5) return;
        updateQuickReplies([...quickReplies, { id: Date.now().toString(), title: '' }]);
    };
    const removeQuickReply = (id) => updateQuickReplies(quickReplies.filter((q) => q.id !== id));
    const updateQuickReply = (id, title) => updateQuickReplies(quickReplies.map((q) => q.id === id ? { ...q, title } : q));

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
                if (data.title && !currentSlide.headline) updates.headline = data.title;
                if (data.image && !currentSlide.imageUrl) updates.imageUrl = data.image;
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
        if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) { alert('Please select JPEG, PNG, WebP or GIF'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('Image must be < 5 MB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => updateCurrentSlide({ imageUrl: ev.target.result });
        reader.readAsDataURL(file);
    };
    const triggerFileInput = () => fileInputRefs.current[`${activeAbVariant}-${activeSlideIndex}`]?.click();

    // ─── Templates ───────────────────────────────────────────────
    const handleSaveTemplateConfirm = () => {
        if (templateName.trim()) onSaveTemplate?.(templateName.trim());
        setShowTemplateModal(false); setTemplateName('');
    };

    const addVariable = (v) => updateFormConfig({ message: (formConfig.message || '') + ` {${v}}` });

    const winnerVariant = config.abWinner;

    return (
        <>
        <div className={styles.tab}>

            {/* ── Template bar ── */}
            {(templates.length > 0 || onSaveTemplate) && (
                <div className={styles.templateBar}>
                    {templates.length > 0 && (
                        <div className={styles.templateSelect}>
                            <FileDown size={14} />
                            <select className={styles.templateDropdown} defaultValue=""
                                onChange={(e) => {
                                    const t = templates.find((t) => t.id === e.target.value);
                                    if (t) onLoadTemplate?.(t);
                                    e.target.value = '';
                                }}
                            >
                                <option value="" disabled>Load from template...</option>
                                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {onDeleteTemplate && (
                                <button className={styles.deleteTemplateBtn} title="Delete a template"
                                    onClick={() => {
                                        const name = prompt('Template name to delete:');
                                        if (!name) return;
                                        const t = templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
                                        if (t && confirm(`Delete "${t.name}"?`)) onDeleteTemplate(t.id);
                                        else if (!t) alert('Template not found.');
                                    }}
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    )}
                    {onSaveTemplate && (
                        isPro ? (
                            <button className={styles.saveTemplateBtn} onClick={() => { setTemplateName(''); setShowTemplateModal(true); }}>
                                <BookmarkPlus size={13} /> Save as Template
                            </button>
                        ) : (
                            <a href="/pricing" className={styles.saveTemplateBtnLocked} title="Upgrade to Pro to save templates">
                                <BookmarkPlus size={13} />
                                Save as Template
                                <span className={styles.saveTemplateProTag}>Pro</span>
                            </a>
                        )
                    )}
                </div>
            )}

            {/* ── A/B Test toggle ── */}
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

                {/* Variant A/B pills — shown when A/B is on */}
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
                        <span className={styles.variantHint}>
                            Editing Variant {activeAbVariant}
                        </span>
                    </div>
                )}
            </div>

            {/* ── DM Type selector ── */}
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                    {isAB ? `Variant ${activeAbVariant} — what do you want to send?` : 'What do you want to send?'}
                </label>
                <select
                    className={styles.select}
                    value={formConfig.type || 'button_template'}
                    onChange={(e) => {
                        const selected = DM_TYPES.find((t) => t.value === e.target.value);
                        if (selected?.pro && !isPro) { window.location.href = '/pricing'; return; }
                        updateFormConfig({ type: e.target.value });
                    }}
                >
                    {DM_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.icon} {type.label}{type.pro ? ' (Pro)' : ''}
                        </option>
                    ))}
                </select>
                {(() => {
                    const selected = DM_TYPES.find((t) => t.value === formConfig.type);
                    if (!selected) return null;
                    const locked = selected.pro && !isPro;
                    return (
                        <div className={styles.typeHint}>
                            <span>{selected.icon}</span>
                            <span>{selected.desc}{locked ? ' — ' : ''}</span>
                            {locked && <a href="/pricing" className={styles.typeHintLink}>Upgrade to Pro to unlock</a>}
                        </div>
                    );
                })()}
            </div>

            {/* ══════════ Button Template ══════════ */}
            {formConfig.type === 'button_template' && (
                <div className={styles.section}>
                    <div className={styles.carouselPills}>
                        <span className={styles.carouselLabel}>Carousel Slides</span>
                        <div className={styles.pillRow}>
                            {slides.map((_, i) => (
                                <button key={i} className={`${styles.pill} ${i === activeSlideIndex ? styles.pillActive : ''}`} onClick={() => setActiveSlideIndex(i)}>{i + 1}</button>
                            ))}
                            <button className={styles.pillAdd} onClick={addSlide} title="Add slide"><Plus size={14} /></button>
                            {slides.length > 1 && <button className={styles.pillDelete} onClick={() => removeSlide(activeSlideIndex)} title="Remove slide"><Trash2 size={13} /></button>}
                        </div>
                    </div>
                    <div className={styles.slideForm}>
                        <div className={styles.formField}>
                            <label className={styles.fieldLabel}><Link2 size={13} /> Button Destination</label>
                            <div className={styles.urlInputRow}>
                                <input className={`${styles.input} ${styles.urlInput}`} placeholder="https://amazon.in/product..." value={currentSlide.buttonUrl || ''} onChange={(e) => handleUrlChange(e.target.value)} onBlur={handleUrlBlur} onKeyDown={handleUrlKeyDown} />
                                {isFetchingUrl && <div className={styles.fetchSpinner}><Loader2 size={15} className={styles.spinning} /></div>}
                            </div>
                            {fetchError && <span className={styles.fetchError}>{fetchError}</span>}
                        </div>
                        <div className={styles.formField}>
                            <label className={styles.fieldLabel}>Button Name</label>
                            <input className={styles.input} placeholder="Shop Now" value={currentSlide.buttonLabel || ''} onChange={(e) => updateCurrentSlide({ buttonLabel: e.target.value })} />
                        </div>
                        <div className={styles.formField}>
                            <label className={styles.fieldLabel}>Headline</label>
                            <input className={styles.input} placeholder="Product name or headline..." value={currentSlide.headline || ''} onChange={(e) => updateCurrentSlide({ headline: e.target.value })} />
                            {isFetchingUrl && <span className={styles.fetchHint}>Fetching from URL...</span>}
                        </div>
                        <div className={styles.formField}>
                            <label className={styles.fieldLabel}>Image</label>
                            <input type="file" accept="image/*" ref={(el) => (fileInputRefs.current[`${activeAbVariant}-${activeSlideIndex}`] = el)} onChange={handleFileSelect} className={styles.hiddenFileInput} />
                            {currentSlide.imageUrl ? (
                                <div className={styles.uploadedImage} onClick={triggerFileInput}>
                                    <img src={currentSlide.imageUrl} alt={`Slide ${activeSlideIndex + 1}`} />
                                    <div className={styles.imageOverlay}><ImageIcon size={18} /><span>Change image</span></div>
                                </div>
                            ) : (
                                <button className={styles.uploadBtn} onClick={triggerFileInput}><ImageIcon size={15} /> Upload Image</button>
                            )}
                        </div>
                        <div className={styles.formField}>
                            <label className={styles.fieldLabel}>Description</label>
                            <div className={styles.lockedField}><span>Sent with AutoDM</span><ExternalLink size={12} /></div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ Message Template ══════════ */}
            {formConfig.type === 'message_template' && (
                <div className={styles.section}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Message</label>
                        <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="Type your message here..." rows={5} value={formConfig.message || ''} onChange={(e) => updateFormConfig({ message: e.target.value })} />
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => addVariable('first_name')}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => addVariable('username')}>{'{username}'}</button>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Branding</label>
                        <input className={styles.input} value={formConfig.branding || 'Sent with AutoDM'} onChange={(e) => updateFormConfig({ branding: e.target.value })} />
                    </div>
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
                        <label className={styles.formLabel}>Opening Message</label>
                        <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="E.g., Which product are you interested in? 👇" rows={3} value={formConfig.message || ''} onChange={(e) => updateFormConfig({ message: e.target.value })} />
                    </div>
                    <div className={styles.variableBar}>
                        <span className={styles.varLabel}>Add variable:</span>
                        <button className={styles.varBtn} onClick={() => addVariable('first_name')}>{'{first_name}'}</button>
                        <button className={styles.varBtn} onClick={() => addVariable('username')}>{'{username}'}</button>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Quick Reply Options <span className={styles.limitNote}>(max 5)</span></label>
                        <div className={styles.chipList}>
                            {quickReplies.map((qr) => (
                                <div key={qr.id} className={styles.chipRow}>
                                    <input className={`${styles.input} ${styles.chipInput}`} placeholder="E.g., Send me the link" value={qr.title} maxLength={20} onChange={(e) => updateQuickReply(qr.id, e.target.value)} />
                                    <span className={styles.charCount}>{qr.title.length}/20</span>
                                    {quickReplies.length > 1 && <button className={styles.removeChipBtn} onClick={() => removeQuickReply(qr.id)}><Trash2 size={12} /></button>}
                                </div>
                            ))}
                            {quickReplies.length < 5 && <button className={styles.addChipBtn} onClick={addQuickReply}><Plus size={13} /> Add option</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ Multi-CTA ══════════ */}
            {formConfig.type === 'multi_cta' && (
                <div className={styles.section}>
                    <div className={styles.infoBox}>
                        <MousePointerClick size={13} />
                        <span>Send a text message with up to 3 URL buttons. No image required — fastest to set up.</span>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Message</label>
                        <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="E.g., Here are 3 things you can grab:" rows={3} value={formConfig.message || ''} onChange={(e) => updateFormConfig({ message: e.target.value })} />
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
                                    <input className={`${styles.input} ${styles.ctaUrl}`} placeholder="https://..." value={btn.url} onChange={(e) => updateCtaButton(btn.id, 'url', e.target.value)} />
                                    {ctaButtons.length > 1 && <button className={styles.removeChipBtn} onClick={() => removeCtaButton(btn.id)}><Trash2 size={12} /></button>}
                                </div>
                            ))}
                            {ctaButtons.length < 3 && <button className={styles.addChipBtn} onClick={addCtaButton}><Plus size={13} /> Add button</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ Follow Gate ══════════ */}
            {formConfig.type === 'follow_up' && (
                <div className={styles.section}>
                    <div className={styles.infoBox} style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(167,139,250,0.2)', color: 'rgba(196,181,253,0.9)' }}>
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
                        <select className={styles.select} value={formConfig.maxRetries || 3} onChange={(e) => updateFormConfig({ maxRetries: Number(e.target.value) })}>
                            <option value={1}>1 attempt</option>
                            <option value={2}>2 attempts</option>
                            <option value={3}>3 attempts (recommended)</option>
                            <option value={5}>5 attempts</option>
                        </select>
                    </div>
                    <div className={styles.stepHeader}>
                        <span className={styles.stepBadge}>4</span>
                        <span className={styles.stepTitle}>Reward Link</span>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Reward type</label>
                        <select className={styles.select} value={formConfig.linkDmType || 'message_template'} onChange={(e) => updateFormConfig({ linkDmType: e.target.value })}>
                            <option value="message_template">Text message</option>
                            <option value="button_template">Button card (with image)</option>
                            <option value="multi_cta">Multi-CTA (text + buttons)</option>
                        </select>
                    </div>
                    {(!formConfig.linkDmType || formConfig.linkDmType === 'message_template') && (
                        <div className={styles.formGroup}>
                            <textarea className={`${styles.input} ${styles.messageArea}`} placeholder="🎉 Thanks for following! Here's your link: https://..." rows={3} value={formConfig.linkMessage || ''} onChange={(e) => updateFormConfig({ linkMessage: e.target.value, linkDmConfig: { message: e.target.value } })} />
                        </div>
                    )}
                </div>
            )}

            {/* ── Common controls ── */}
            <div className={styles.commonControls}>
                <div className={styles.comingSoonRow}>
                    <div className={styles.comingSoonLeft}>
                        <input type="checkbox" className={styles.checkbox} disabled style={{ cursor: 'not-allowed' }} />
                        <div>
                            <span className={styles.comingSoonLabel}>Send DMs to previous comments<span className={styles.proBadge}>Pro</span></span>
                            <p className={styles.comingSoonDesc}>Automatically DM everyone who already commented on this post. Coming soon.</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        {/* ── Save template modal ── */}
        {showTemplateModal && (
            <div className={settingsStyles.modalOverlay} onClick={() => setShowTemplateModal(false)}>
                <div className={settingsStyles.modal} onClick={(e) => e.stopPropagation()}>
                    <div className={settingsStyles.modalIcon}><BookmarkPlus size={28} /></div>
                    <h3 className={settingsStyles.modalTitle}>Save as Template</h3>
                    <p className={settingsStyles.modalDesc}>Give this DM setup a name so you can reuse it for future posts.</p>
                    <div className={settingsStyles.formGroup}>
                        <label className={settingsStyles.formLabel}>Template Name</label>
                        <input className={settingsStyles.formInput} placeholder="E.g., Product launch DM" value={templateName} onChange={(e) => setTemplateName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplateConfirm()} autoFocus />
                    </div>
                    <div className={settingsStyles.modalActions}>
                        <button className={settingsStyles.cancelBtn} onClick={() => setShowTemplateModal(false)}>Cancel</button>
                        <button className={settingsStyles.refreshBtn} onClick={handleSaveTemplateConfirm} disabled={!templateName.trim()} style={{ opacity: templateName.trim() ? 1 : 0.45 }}>
                            <BookmarkPlus size={13} /> Save Template
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
