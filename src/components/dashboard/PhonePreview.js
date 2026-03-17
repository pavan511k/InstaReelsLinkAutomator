'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Upload, Camera } from 'lucide-react';
import styles from './PhonePreview.module.css';

export default function PhonePreview({ config, onImageUpload, activeSlideIndex = 0, onSlideChange }) {
    // Internal fallback state — only used if no external activeSlideIndex is provided
    const [_localSlide, _setLocalSlide] = useState(0);
    const activeSlide    = onSlideChange ? activeSlideIndex : _localSlide;
    const setActiveSlide = onSlideChange ? onSlideChange    : _setLocalSlide;

    const carouselRef            = useRef(null);
    const fileInputRef            = useRef(null);
    // Flag: true while WE are programmatically scrolling the carousel.
    // handleScroll must ignore events during this window to prevent
    // the feedback loop: pill click → scrollTo → onScroll → setActiveSlide(wrong) → loop.
    const isProgrammaticScroll   = useRef(false);
    const programmaticScrollTimer = useRef(null);

    const slides = config.slides || [];
    const totalSlides = slides.length;

    // Programmatic scroll helper — sets the flag, scrolls, then clears after animation settles
    const programmaticScrollTo = (index) => {
        if (!carouselRef.current) return;
        // Cancel any previous timer
        if (programmaticScrollTimer.current) clearTimeout(programmaticScrollTimer.current);
        isProgrammaticScroll.current = true;
        const slideWidth = carouselRef.current.offsetWidth;
        carouselRef.current.scrollTo({ left: slideWidth * index, behavior: 'smooth' });
        // 'smooth' scroll typically completes in ~300ms; 450ms gives comfortable headroom
        programmaticScrollTimer.current = setTimeout(() => {
            isProgrammaticScroll.current = false;
        }, 450);
    };

    // Sync the phone carousel whenever the shared activeSlide index changes
    useEffect(() => {
        programmaticScrollTo(activeSlide);
    }, [activeSlide]);

    const scrollToSlide = (index) => {
        const clamped = Math.max(0, Math.min(index, totalSlides - 1));
        setActiveSlide(clamped);
        // scrollTo is handled by the useEffect above via programmaticScrollTo
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
        // Ignore scroll events we triggered ourselves — they happen during smooth scroll
        // animation and would cause the pill to snap back to the old slide index.
        if (isProgrammaticScroll.current) return;
        if (!carouselRef.current) return;
        const slideWidth = carouselRef.current.offsetWidth;
        const scrollLeft = carouselRef.current.scrollLeft;
        const newIndex   = Math.round(scrollLeft / slideWidth);
        if (newIndex !== activeSlide && newIndex >= 0 && newIndex < totalSlides) {
            setActiveSlide(newIndex);
        }
    };

    const currentSlide = slides[activeSlide] || {};
    const headline = currentSlide.headline || '';
    const buttonLabel = currentSlide.buttonLabel || currentSlide.buttons?.[0]?.label || '';

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

            {/* Card Container */}
            <div className={styles.cardContainer}>
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
                                        <Camera size={24} />
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

                {/* Card Info — below image */}
                <div className={styles.cardInfo}>
                    {headline && (
                        <p className={styles.cardTitle}>{headline}</p>
                    )}
                    <span className={styles.cardSubtitle}>Sent with AutoDM</span>
                </div>

                {/* Single Button */}
                {buttonLabel && (
                    <div className={styles.cardButton}>
                        {buttonLabel}
                    </div>
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

    const renderQuickReply = () => (
        <div className={styles.messagePreview}>
            <div className={styles.messageBubble}>
                <p>{config.message || 'Your message will appear here...'}</p>
            </div>
            <div className={styles.quickReplies}>
                {(config.quickReplies || [{ title: 'Reply option 1' }])
                    .filter((qr) => qr.title?.trim())
                    .slice(0, 5)
                    .map((qr, i) => (
                        <span key={i} className={styles.quickReplyChip}>{qr.title}</span>
                    ))}
            </div>
        </div>
    );

    const renderMultiCta = () => (
        <div className={styles.buttonPreview}>
            <div className={styles.cardContainer}>
                <div className={styles.cardInfo} style={{ paddingBottom: 0 }}>
                    <p className={styles.cardTitle}>{config.message || 'Your message here...'}</p>
                    <span className={styles.cardSubtitle}>Sent with AutoDM</span>
                </div>
                <div className={styles.ctaButtons}>
                    {(config.buttons || [{ label: 'Button 1', url: '' }])
                        .filter((b) => b.label?.trim())
                        .slice(0, 3)
                        .map((b, i) => (
                            <div key={i} className={styles.ctaButton}>
                                {b.label}
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );

    const renderFollowGate = () => {
        const isFollowedState = false; // always show the gate state in preview
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Gate message */}
                <div className={styles.messageBubble}>
                    <p>{config.gateMessage || 'Hey! 👋 To get the link, please follow our page first, then reply YES here 👇'}</p>
                </div>
                {/* YES / NO quick reply chips */}
                <div className={styles.quickReplies}>
                    <span className={styles.quickReplyChip} style={{ borderColor: '#10B981', color: '#10B981' }}>✅ Yes, I followed!</span>
                    <span className={styles.quickReplyChip} style={{ borderColor: '#EF4444', color: '#EF4444' }}>❌ No, not yet</span>
                </div>
                {/* Arrow divider showing the flow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', opacity: 0.35 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>after follow verified</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
                </div>
                {/* Reward preview (faded) */}
                <div style={{ opacity: 0.55 }}>
                    {config.linkDmType === 'button_template' ? (
                        <div className={styles.buttonPreview}>
                            <div className={styles.cardContainer}>
                                <div className={styles.cardInfo}>
                                    <p className={styles.cardTitle}>{config.linkDmConfig?.slides?.[0]?.headline || "Here's your link!"}</p>
                                    <span className={styles.cardSubtitle}>Sent with AutoDM</span>
                                </div>
                                <div className={styles.cardButton}>{config.linkDmConfig?.slides?.[0]?.buttonLabel || 'Get the link'}</div>
                            </div>
                        </div>
                    ) : config.linkDmType === 'multi_cta' ? (
                        <div className={styles.buttonPreview}>
                            <div className={styles.cardContainer}>
                                <div className={styles.cardInfo}>
                                    <p className={styles.cardTitle}>{config.linkMessage || '🎉 Thanks for following!'}</p>
                                    <span className={styles.cardSubtitle}>Sent with AutoDM</span>
                                </div>
                                <div className={styles.ctaButtons}>
                                    {(config.linkDmConfig?.buttons || [{ label: 'Get the link' }]).filter(b => b.label).slice(0, 3).map((b, i) => (
                                        <div key={i} className={styles.ctaButton}>{b.label}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.messageBubble}>
                            <p>{config.linkMessage || '🎉 Thanks for following! Here is your link: https://...'}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (config.type) {
            case 'button_template':  return renderButtonTemplate();
            case 'message_template': return renderMessageTemplate();
            case 'quick_reply':      return renderQuickReply();
            case 'multi_cta':        return renderMultiCta();
            case 'follow_up':        return renderFollowGate();
            default:                 return null;
        }
    };

    return (
        <div className={styles.phone}>
            <div className={styles.phoneBezel}>
                <div className={styles.dynamicIsland}></div>
                <div className={styles.screen}>
                    <div className={styles.chatHeader}>
                        <div className={styles.chatAvatar}></div>
                        <div className={styles.chatHeaderInfo}>
                            <span className={styles.chatName}>AutoDM</span>
                            <span className={styles.chatOnline}>Active now</span>
                        </div>
                    </div>
                    <div className={styles.chatBody}>
                        {renderContent()}
                    </div>
                    <div className={styles.chatBar}>
                        <div className={styles.chatBarCamera}>
                            <Camera size={18} />
                        </div>
                        <span>Message...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
