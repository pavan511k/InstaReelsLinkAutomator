'use client';

import { Plus, Upload, Link as LinkIcon, Trash2 } from 'lucide-react';
import styles from './DMSetupTab.module.css';

export default function DMSetupTab({ config, onChange }) {
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

    const addButton = (slideIndex) => {
        if (config.slides[slideIndex].buttons.length >= 3) return;
        const newSlides = [...config.slides];
        newSlides[slideIndex].buttons.push({ type: 'url', label: '', value: '' });
        updateConfig({ slides: newSlides });
    };

    const addVariable = (variable) => {
        const newMessage = config.message + ` {${variable}}`;
        updateConfig({ message: newMessage });
    };

    return (
        <div className={styles.tab}>
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
                    <option value="post_reels">Instagram Posts & Reels</option>
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
                                <div className={styles.uploadZone}>
                                    <Upload size={24} />
                                    <p>Drag & drop image or click to upload</p>
                                    <span>Recommended: 1080x1080px</span>
                                </div>

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

            {/* Instagram Posts & Reels */}
            {config.type === 'post_reels' && (
                <div className={styles.section}>
                    <div className="form-group">
                        <label className="form-label">Search Instagram Posts & Reels</label>
                        <input
                            className="form-input"
                            placeholder="Search posts by caption..."
                        />
                    </div>
                    <div className={styles.postList}>
                        <div className={styles.postItem}>
                            <div className={styles.postThumb}></div>
                            <div className={styles.postInfo}>
                                <p>Check out our latest reel! Comment &quot;LINK&quot;...</p>
                                <span>2 hours ago</span>
                            </div>
                        </div>
                        <div className={styles.postItem}>
                            <div className={styles.postThumb}></div>
                            <div className={styles.postInfo}>
                                <p>New product launch 🚀 Comment &quot;SHOP&quot;...</p>
                                <span>1 day ago</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Common controls */}
            <div className={styles.commonControls}>
                <label className={styles.checkboxLabel}>
                    <input type="checkbox" className={styles.checkbox} disabled />
                    Save as template <span className="badge badge-warning">Pro</span>
                </label>
                <label className={styles.checkboxLabel}>
                    <input type="checkbox" className={styles.checkbox} disabled />
                    Send DMs to previous comments <span className="badge badge-warning">Pro</span>
                </label>
            </div>
        </div>
    );
}
