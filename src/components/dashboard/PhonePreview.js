'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import styles from './PhonePreview.module.css';

export default function PhonePreview({ config, onImageUpload }) {
    const [activeSlide, setActiveSlide] = useState(0);
    const carouselRef = useRef(null);
    const fileInputRef = useRef(null);

    const slides = config.slides || [];
    const totalSlides = slides.length;

    const scrollToSlide = (index) => {
        const clamped = Math.max(0, Math.min(index, totalSlides - 1));
        setActiveSlide(clamped);
        if (carouselRef.current) {
            const slideWidth = carouselRef.current.offsetWidth;
            carouselRef.current.scrollTo({ left: slideWidth * clamped, behavior: 'smooth' });
        }
    };

    const handleImageClick = (slideIndex) => {
        fileInputRef.current?.setAttribute('data-slide-index', slideIndex);
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const slideIndex = parseInt(e.target.getAttribute('data-slide-index') || '0', 10);

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) return;
        if (file.size > 5 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (onImageUpload) onImageUpload(slideIndex, event.target.result);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleScroll = () => {
        if (!carouselRef.current) return;
        const slideWidth = carouselRef.current.offsetWidth;
        const scrollLeft = carouselRef.current.scrollLeft;
        const newIndex = Math.round(scrollLeft / slideWidth);
        if (newIndex !== activeSlide) setActiveSlide(newIndex);
    };

    const renderButtonTemplate = () => (
        <div className={styles.buttonPreview}>
            {/* Hidden file input */}
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className={styles.hiddenInput}
            />

            {/* Carousel */}
            <div className={styles.carouselContainer}>
                <div
                    className={styles.carouselTrack}
                    ref={carouselRef}
                    onScroll={handleScroll}
                >
                    {slides.map((slide, i) => (
                        <div
                            key={i}
                            className={styles.carouselSlide}
                            onClick={() => handleImageClick(i)}
                        >
                            {slide.imageUrl ? (
                                <img src={slide.imageUrl} alt={`Slide ${i + 1}`} className={styles.slideImage} />
                            ) : (
                                <div className={styles.imagePlaceholder}>
                                    <Upload size={20} />
                                    <span>Tap to upload</span>
                                </div>
                            )}
                            {slide.imageUrl && (
                                <div className={styles.uploadOverlay}>
                                    <Upload size={16} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Navigation arrows */}
                {totalSlides > 1 && (
                    <>
                        {activeSlide > 0 && (
                            <button
                                className={`${styles.carouselNav} ${styles.carouselNavLeft}`}
                                onClick={() => scrollToSlide(activeSlide - 1)}
                            >
                                <ChevronLeft size={14} />
                            </button>
                        )}
                        {activeSlide < totalSlides - 1 && (
                            <button
                                className={`${styles.carouselNav} ${styles.carouselNavRight}`}
                                onClick={() => scrollToSlide(activeSlide + 1)}
                            >
                                <ChevronRight size={14} />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Dots */}
            {totalSlides > 1 && (
                <div className={styles.dotsContainer}>
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            className={`${styles.dot} ${i === activeSlide ? styles.dotActive : ''}`}
                            onClick={() => scrollToSlide(i)}
                        />
                    ))}
                </div>
            )}

            {/* Buttons from active slide */}
            <div className={styles.previewButtons}>
                {slides[activeSlide]?.buttons.map((btn, i) => (
                    <div key={i} className={styles.previewBtn}>
                        {btn.label || `Button ${i + 1}`}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMessageTemplate = () => (
        <div className={styles.messagePreview}>
            <div className={styles.messageBubble}>
                <p>{config.message || 'Your message will appear here...'}</p>
            </div>
            {config.branding && (
                <span className={styles.branding}>{config.branding}</span>
            )}
        </div>
    );

    const renderContent = () => {
        switch (config.type) {
            case 'button_template':
                return renderButtonTemplate();
            case 'message_template':
                return renderMessageTemplate();
            default:
                return null;
        }
    };

    return (
        <div className={styles.phone}>
            <div className={styles.phoneBezel}>
                <div className={styles.notch}></div>
                <div className={styles.screen}>
                    <div className={styles.chatHeader}>
                        <div className={styles.chatAvatar}></div>
                        <span className={styles.chatName}>AutoDM</span>
                    </div>
                    <div className={styles.chatBody}>
                        {renderContent()}
                    </div>
                    <div className={styles.chatBar}>
                        <span>Message...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
