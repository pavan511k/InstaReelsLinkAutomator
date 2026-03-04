'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, Link as LinkIcon, Trash2, Image as ImageIcon, BookmarkPlus, FileDown } from 'lucide-react';
import styles from './DMSetupTab.module.css';
import settingsStyles from './SettingsContent.module.css';

export default function DMSetupTab({ config, onChange, onImageUpload, templates = [], onSaveTemplate, onLoadTemplate }) {
    const fileInputRefs = useRef({});
    const [showTemplateNameModal, setShowTemplateNameModal] = useState(false);
    const [templateName, setTemplateName] = useState('');

    const updateConfig = (updates) => {
        onChange({ ...config, ...updates });
    };

    const addSlide = () => {
        const newSlides = [
            ...config.slides,
            { imageUrl: '', buttons: [{ type: 'url', label: '', value: '' }] },
        ];
        updateConfig({ slides: newSlides });
    };

    const removeSlide = (index) => {
        if (config.slides.length <= 1) return;
        const newSlides = config.slides.filter((_, i) => i !== index);
        updateConfig({ slides: newSlides });
    };

    const updateSlideButton = (slideIndex, btnIndex, field, value) => {
        const newSlides = [...config.slides];
        newSlides[slideIndex].buttons[btnIndex][field] = value;
        updateConfig({ slides: newSlides });
    };

    const removeButton = (slideIndex, btnIndex) => {
        const newSlides = [...config.slides];
        if (newSlides[slideIndex].buttons.length <= 1) return;
        newSlides[slideIndex].buttons.splice(btnIndex, 1);
        updateConfig({ slides: newSlides });
    };

    const addButton = (slideIndex) => {
        if (config.slides[slideIndex].buttons.length >= 3) return;
        const newSlides = [...config.slides];
        newSlides[slideIndex].buttons.push({ type: 'url', label: '', value: '' });
        updateConfig({ slides: newSlides });
    };

    const handleFileSelect = (slideIndex, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type and size
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            alert('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be smaller than 5MB');
            return;
        }

        // Read as data URL for preview
        const reader = new FileReader();
        reader.onload = (event) => {
            const newSlides = [...config.slides];
            newSlides[slideIndex].imageUrl = event.target.result;
            updateConfig({ slides: newSlides });
            if (onImageUpload) onImageUpload(slideIndex, file);
        };
        reader.readAsDataURL(file);
    };

    const triggerFileInput = (slideIndex) => {
        const input = fileInputRefs.current[slideIndex];
        if (input) input.click();
    };

    const addVariable = (variable) => {
        const newMessage = config.message + ` {${variable}}`;
        updateConfig({ message: newMessage });
    };

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

                {/* Trigger Type Selector */}
                <div className="form-group">
                    <label className="form-label">Trigger Type</label>
                    <select
                        className="form-input"
                        value={config.triggerType || 'keywords'}
                        onChange={(e) => updateConfig({ triggerType: e.target.value })}
                    >
                        <option value="keywords">Keywords</option>
                        <option value="all_comments">All Comments</option>
                        <option value="emojis_only">Emojis Only</option>
                        <option value="mentions_only">@Mentions Only</option>
                    </select>
                </div>

                {/* Keyword input — only when trigger is keywords */}
                {(config.triggerType === 'keywords' || !config.triggerType) && (
                    <div className="form-group">
                        <label className="form-label">Keyword Triggers</label>
                        <div className={styles.keywordInput}>
                            <div className={styles.keywordTags}>
                                {(config.keywords || []).map((kw) => (
                                    <span key={kw} className="tag">
                                        {kw}
                                        <button
                                            className="tag-remove"
                                            onClick={() => updateConfig({ keywords: (config.keywords || []).filter((k) => k !== kw) })}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <input
                                className="form-input"
                                placeholder="Type keyword and press Enter..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.target.value.trim();
                                        if (val && !(config.keywords || []).includes(val)) {
                                            updateConfig({ keywords: [...(config.keywords || []), val] });
                                        }
                                        e.target.value = '';
                                    }
                                }}
                            />
                        </div>
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

                {/* Button Template */}
                {config.type === 'button_template' && (
                    <div className={styles.section}>
                        <div className={styles.slidesHeader}>
                            <h4 className={styles.sectionTitle}>Carousel Slides</h4>
                            <button className="btn btn-sm btn-secondary" onClick={addSlide}>
                                <Plus size={14} /> Add Slide
                            </button>
                        </div>

                        <div className={styles.slidesList}>
                            {config.slides.map((slide, slideIndex) => (
                                <div key={slideIndex} className={styles.slide}>
                                    <div className={styles.slideHeader}>
                                        <span className={styles.slideNum}>Slide {slideIndex + 1}</span>
                                        {config.slides.length > 1 && (
                                            <button
                                                className={styles.removeSlide}
                                                onClick={() => removeSlide(slideIndex)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Image upload zone */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={(el) => (fileInputRefs.current[slideIndex] = el)}
                                        onChange={(e) => handleFileSelect(slideIndex, e)}
                                        className={styles.hiddenFileInput}
                                    />

                                    {slide.imageUrl ? (
                                        <div className={styles.uploadedImage} onClick={() => triggerFileInput(slideIndex)}>
                                            <img src={slide.imageUrl} alt={`Slide ${slideIndex + 1}`} />
                                            <div className={styles.imageOverlay}>
                                                <ImageIcon size={20} />
                                                <span>Change image</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={styles.uploadZone}
                                            onClick={() => triggerFileInput(slideIndex)}
                                        >
                                            <Upload size={24} />
                                            <p>Click to upload image</p>
                                            <span>JPEG, PNG, WebP · Max 5MB</span>
                                        </div>
                                    )}

                                    {/* Buttons */}
                                    <div className={styles.buttonsSection}>
                                        <h5 className={styles.subTitle}>Button Destinations (max 3)</h5>
                                        {slide.buttons.map((btn, btnIndex) => (
                                            <div key={btnIndex} className={styles.buttonRow}>
                                                <select
                                                    className={`form-input ${styles.typeSelect}`}
                                                    value={btn.type}
                                                    onChange={(e) => updateSlideButton(slideIndex, btnIndex, 'type', e.target.value)}
                                                >
                                                    <option value="url">URL</option>
                                                    <option value="phone">Phone</option>
                                                </select>
                                                <input
                                                    className="form-input"
                                                    placeholder="Button label"
                                                    value={btn.label}
                                                    onChange={(e) => updateSlideButton(slideIndex, btnIndex, 'label', e.target.value)}
                                                />
                                                <input
                                                    className="form-input"
                                                    placeholder={btn.type === 'url' ? 'https://...' : '+1234567890'}
                                                    value={btn.value}
                                                    onChange={(e) => updateSlideButton(slideIndex, btnIndex, 'value', e.target.value)}
                                                />
                                                {slide.buttons.length > 1 && (
                                                    <button
                                                        className={styles.removeBtnSmall}
                                                        onClick={() => removeButton(slideIndex, btnIndex)}
                                                        title="Remove button"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {slide.buttons.length < 3 && (
                                            <button
                                                className={styles.addBtn}
                                                onClick={() => addButton(slideIndex)}
                                            >
                                                <LinkIcon size={14} /> Add Button
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Message Template */}
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
            {
                showTemplateNameModal && (
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
                )
            }
        </>
    );
}
