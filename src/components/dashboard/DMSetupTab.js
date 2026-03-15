'use client';

import { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, Image as ImageIcon, BookmarkPlus, FileDown, Loader2, Link2, ExternalLink } from 'lucide-react';
import styles from './DMSetupTab.module.css';
import settingsStyles from './SettingsContent.module.css';

const EMPTY_SLIDE = { imageUrl: '', headline: '', buttonLabel: 'Shop Now', buttonUrl: '', buttons: [{ type: 'url', label: 'Shop Now', value: '' }] };

export default function DMSetupTab({ config, onChange, templates = [], onSaveTemplate, onLoadTemplate, onDeleteTemplate }) {
    const fileInputRefs = useRef({});
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [showTemplateNameModal, setShowTemplateNameModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const updateConfig = (updates) => {
        onChange({ ...config, ...updates });
    };

    // ─── Slide Management ────────────────────────────────────────

    const addSlide = () => {
        const newSlides = [...config.slides, { ...EMPTY_SLIDE, buttons: [{ type: 'url', label: 'Shop Now', value: '' }] }];
        updateConfig({ slides: newSlides });
        setActiveSlideIndex(newSlides.length - 1);
    };

    const removeSlide = (index) => {
        if (config.slides.length <= 1) return;
        const newSlides = config.slides.filter((_, i) => i !== index);
        updateConfig({ slides: newSlides });
        setActiveSlideIndex(Math.min(activeSlideIndex, newSlides.length - 1));
    };

    const currentSlide = config.slides[activeSlideIndex] || config.slides[0] || EMPTY_SLIDE;

    const updateCurrentSlide = useCallback((updates) => {
        const newSlides = [...config.slides];
        newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], ...updates };

        // Sync the flat fields into the buttons array for backward compatibility
        if (updates.buttonLabel !== undefined || updates.buttonUrl !== undefined) {
            const label = updates.buttonLabel ?? newSlides[activeSlideIndex].buttonLabel ?? '';
            const value = updates.buttonUrl ?? newSlides[activeSlideIndex].buttonUrl ?? '';
            newSlides[activeSlideIndex].buttons = [{ type: 'url', label, value }];
        }

        updateConfig({ slides: newSlides });
    }, [config.slides, activeSlideIndex, updateConfig]);

    // ─── URL Fetch ───────────────────────────────────────────────

    const handleUrlChange = (url) => {
        updateCurrentSlide({ buttonUrl: url });
        setFetchError('');
    };

    const fetchUrlMetadata = async (url) => {
        if (!url || isFetchingUrl) return;

        // Basic URL check
        try {
            new URL(url);
        } catch {
            setFetchError('Enter a valid URL');
            return;
        }

        setIsFetchingUrl(true);
        setFetchError('');

        try {
            const res = await fetch('/api/url-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();

            if (res.ok) {
                const updates = {};
                if (data.title && !currentSlide.headline) {
                    updates.headline = data.title;
                }
                if (data.image && !currentSlide.imageUrl) {
                    updates.imageUrl = data.image;
                }
                if (Object.keys(updates).length > 0) {
                    updateCurrentSlide(updates);
                }
            } else {
                setFetchError(data.error || 'Could not fetch URL info');
            }
        } catch (err) {
            setFetchError(`Fetch failed: ${err.message}`);
        } finally {
            setIsFetchingUrl(false);
        }
    };

    const handleUrlBlur = () => {
        const url = currentSlide.buttonUrl?.trim();
        if (url && !currentSlide.headline && !currentSlide.imageUrl) {
            fetchUrlMetadata(url);
        }
    };

    const handleUrlKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchUrlMetadata(currentSlide.buttonUrl?.trim());
        }
    };

    // ─── Image Upload ────────────────────────────────────────────

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be smaller than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            updateCurrentSlide({ imageUrl: event.target.result });
        };
        reader.readAsDataURL(file);
    };

    const triggerFileInput = () => {
        const input = fileInputRefs.current[activeSlideIndex];
        if (input) input.click();
    };

    // ─── Templates ───────────────────────────────────────────────

    const handleSaveAsTemplate = () => {
        setTemplateName('');
        setShowTemplateNameModal(true);
    };

    const handleSaveTemplateConfirm = () => {
        if (templateName.trim()) {
            onSaveTemplate?.(templateName.trim());
        }
        setShowTemplateNameModal(false);
        setTemplateName('');
    };

    // ─── Variables ───────────────────────────────────────────────

    const addVariable = (variable) => {
        const newMessage = config.message + ` {${variable}}`;
        updateConfig({ message: newMessage });
    };

    return (
        <>
            <div className={styles.tab}>
                {/* Template Controls */}
                {(templates.length > 0 || onSaveTemplate) && (
                    <div className={styles.templateBar}>
                        {templates.length > 0 && (
                            <div className={styles.templateSelect}>
                                <FileDown size={14} />
                                <select
                                    className={styles.templateDropdown}
                                    defaultValue=""
                                    onChange={(e) => {
                                        const template = templates.find((t) => t.id === e.target.value);
                                        if (template) onLoadTemplate?.(template);
                                        e.target.value = '';
                                    }}
                                >
                                    <option value="" disabled>Load from template...</option>
                                    {templates.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                {onDeleteTemplate && (
                                    <button
                                        className={styles.deleteTemplateBtn}
                                        onClick={() => {
                                            const name = prompt('Enter the template name to delete:');
                                            if (!name) return;
                                            const template = templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
                                            if (template) {
                                                if (confirm(`Delete template "${template.name}"?`)) {
                                                    onDeleteTemplate(template.id);
                                                }
                                            } else {
                                                alert('Template not found. Check the name and try again.');
                                            }
                                        }}
                                        title="Delete a saved template"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                        {onSaveTemplate && (
                            <button
                                className={styles.saveTemplateBtn}
                                onClick={handleSaveAsTemplate}
                                title="Save current setup as a reusable template"
                            >
                                <BookmarkPlus size={14} />
                                Save as Template
                            </button>
                        )}
                    </div>
                )}

                {/* DM Type Selector */}
                <div className="form-group">
                    <label className="form-label">DM Type</label>
                    <select
                        className="form-input"
                        value={config.type}
                        onChange={(e) => updateConfig({ type: e.target.value })}
                    >
                        <option value="button_template">Button Template</option>
                        <option value="message_template">Message Template</option>
                    </select>
                </div>

                {/* ══════════ Button Template — Carousel Slides ══════════ */}
                {config.type === 'button_template' && (
                    <div className={styles.section}>
                        {/* Carousel Slider Pills */}
                        <div className={styles.carouselPills}>
                            <span className={styles.carouselLabel}>Carousel Slider</span>
                            <div className={styles.pillRow}>
                                {config.slides.map((_, index) => (
                                    <button
                                        key={index}
                                        className={`${styles.pill} ${index === activeSlideIndex ? styles.pillActive : ''}`}
                                        onClick={() => setActiveSlideIndex(index)}
                                    >
                                        {index + 1}
                                    </button>
                                ))}
                                <button
                                    className={styles.pillAdd}
                                    onClick={addSlide}
                                    title="Add new slide"
                                >
                                    <Plus size={14} />
                                </button>
                                {config.slides.length > 1 && (
                                    <button
                                        className={styles.pillDelete}
                                        onClick={() => removeSlide(activeSlideIndex)}
                                        title="Delete current slide"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Active Slide Form */}
                        <div className={styles.slideForm}>
                            {/* Button URL */}
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>
                                    <Link2 size={14} />
                                    Button Destination
                                </label>
                                <div className={styles.urlInputRow}>
                                    <input
                                        className={`form-input ${styles.urlInput}`}
                                        placeholder="https://amazon.in/product..."
                                        value={currentSlide.buttonUrl || ''}
                                        onChange={(e) => handleUrlChange(e.target.value)}
                                        onBlur={handleUrlBlur}
                                        onKeyDown={handleUrlKeyDown}
                                    />
                                    {isFetchingUrl && (
                                        <div className={styles.fetchSpinner}>
                                            <Loader2 size={16} className={styles.spinning} />
                                        </div>
                                    )}
                                </div>
                                {fetchError && (
                                    <span className={styles.fetchError}>{fetchError}</span>
                                )}
                            </div>

                            {/* Button Name */}
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Button Name</label>
                                <input
                                    className="form-input"
                                    placeholder="Shop Now"
                                    value={currentSlide.buttonLabel || ''}
                                    onChange={(e) => updateCurrentSlide({ buttonLabel: e.target.value })}
                                />
                            </div>

                            {/* Headline */}
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Headline</label>
                                <input
                                    className="form-input"
                                    placeholder="Product name or headline..."
                                    value={currentSlide.headline || ''}
                                    onChange={(e) => updateCurrentSlide({ headline: e.target.value })}
                                />
                                {isFetchingUrl && (
                                    <span className={styles.fetchHint}>Fetching from URL...</span>
                                )}
                            </div>

                            {/* Image */}
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={(el) => (fileInputRefs.current[activeSlideIndex] = el)}
                                    onChange={handleFileSelect}
                                    className={styles.hiddenFileInput}
                                />

                                {currentSlide.imageUrl ? (
                                    <div className={styles.uploadedImage} onClick={triggerFileInput}>
                                        <img src={currentSlide.imageUrl} alt={`Slide ${activeSlideIndex + 1}`} />
                                        <div className={styles.imageOverlay}>
                                            <ImageIcon size={20} />
                                            <span>Change image</span>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className={styles.uploadBtn}
                                        onClick={triggerFileInput}
                                    >
                                        <ImageIcon size={16} />
                                        Upload Image
                                    </button>
                                )}
                            </div>

                            {/* Description (locked) */}
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Description</label>
                                <div className={styles.lockedField}>
                                    <span>Sent with AutoDM</span>
                                    <ExternalLink size={12} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════ Message Template ══════════ */}
                {config.type === 'message_template' && (
                    <div className={styles.section}>
                        <div className="form-group">
                            <label className="form-label">Message</label>
                            <textarea
                                className={`form-input ${styles.messageArea}`}
                                placeholder="Type your message here..."
                                rows={5}
                                value={config.message}
                                onChange={(e) => updateConfig({ message: e.target.value })}
                            />
                        </div>

                        <div className={styles.variableBar}>
                            <span className={styles.varLabel}>Add Variable:</span>
                            <button className={styles.varBtn} onClick={() => addVariable('first_name')}>
                                {'{first_name}'}
                            </button>
                            <button className={styles.varBtn} onClick={() => addVariable('username')}>
                                {'{username}'}
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Branding</label>
                            <input
                                className="form-input"
                                value={config.branding}
                                onChange={(e) => updateConfig({ branding: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {/* Common controls */}
                <div className={styles.commonControls}>
                    <label className={styles.checkboxLabel}>
                        <input type="checkbox" className={styles.checkbox} disabled />
                        Send DMs to previous comments <span className="badge badge-warning">Pro</span>
                    </label>
                </div>
            </div>

            {/* Save as Template Name Modal */}
            {showTemplateNameModal && (
                <div className={settingsStyles.modalOverlay} onClick={() => setShowTemplateNameModal(false)}>
                    <div className={settingsStyles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={settingsStyles.modalIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>
                            <BookmarkPlus size={32} />
                        </div>
                        <h3 className={settingsStyles.modalTitle}>Save as Template</h3>
                        <p className={settingsStyles.modalDesc}>
                            Give this DM setup a name so you can reuse it for future posts.
                        </p>
                        <div className={settingsStyles.formGroup}>
                            <label className={settingsStyles.formLabel}>Template Name</label>
                            <input
                                className={settingsStyles.formInput}
                                placeholder="E.g., Product launch DM"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplateConfirm()}
                                autoFocus
                            />
                        </div>
                        <div className={settingsStyles.modalActions}>
                            <button
                                className={settingsStyles.cancelBtn}
                                onClick={() => setShowTemplateNameModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={settingsStyles.refreshBtn}
                                onClick={handleSaveTemplateConfirm}
                                disabled={!templateName.trim()}
                                style={{ opacity: templateName.trim() ? 1 : 0.5 }}
                            >
                                <BookmarkPlus size={14} />
                                Save Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
