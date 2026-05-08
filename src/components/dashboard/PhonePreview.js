'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Upload, Camera } from 'lucide-react';
import styles from './PhonePreview.module.css';

export default function PhonePreview({ config, onImageUpload, activeSlideIndex = 0, onSlideChange, userPlan = 'free' }) {
    // Trial users have the same Pro feature set per lib/plans.js — keep
    // this in sync with isProOrTrial() so trial users see custom branding
    // in the preview just like real Pro users.
    const isPro = userPlan === 'pro' || userPlan === 'business' || userPlan === 'trial';
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

    // Build the brand label text the recipient sees in subtitles. Mirrors
    // sendButtonTemplateDM / sendMultiCtaDM logic: Pro custom string overrides
    // the default when set; otherwise default 'Sent with AutoDM'. Used for
    // button-card and multi-cta subtitles.
    const brandLabelFor = (scope) => {
        const custom = isPro ? (scope?.branding || '').trim() : '';
        return custom || 'Sent with AutoDM';
    };

    // Compute subtitle for a button-card slide. Branding controlled by the
    // unified top-level appendBranding flag (config or linkDmConfig).
    const getSubtitle = (slide, scope = config) => {
        const desc = (slide?.description || '').trim();
        const shouldAppend = scope?.appendBranding !== false;
        if (shouldAppend) {
            const label = brandLabelFor(scope);
            return desc ? `${desc} • ${label}` : label;
        }
        return desc || null;
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
                    {headline && <p className={styles.cardTitle}>{headline}</p>}
                    {getSubtitle(currentSlide) && <span className={styles.cardSubtitle}>{getSubtitle(currentSlide)}</span>}
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

    // Demo substitution — show what the recipient will see, not the raw
    // template. Uses a sample handle so users can spot how their copy reads.
    const SAMPLE_USERNAME = 'sarah';
    const previewSubstitute = (text = '') => text
        .replace(/\{first_name\}/g, SAMPLE_USERNAME)
        .replace(/\{username\}/g, SAMPLE_USERNAME);

    // Default branding suffix shown to recipients. Must mirror
    // defaultBrandingSuffix() in lib/send-dm.js so the preview never lies.
    const FREE_BRANDING_SUFFIX = `— Sent with AutoDM · autodm.pro`;

    // Apply the unified branding rule to a plain-text message body. Mirrors
    // applyBranding() in lib/send-dm.js exactly:
    //   - scope.appendBranding === false → no suffix
    //   - Pro + scope.branding set       → `— <custom>`
    //   - otherwise                       → default suffix
    //
    // Always evaluates regardless of whether `raw` is filled — the preview
    // must reflect the toggle state at all times, including when the user
    // is staring at the placeholder before typing.
    const applyBrandingToBody = (body, _raw, scope) => {
        if (scope?.appendBranding === false) return body;
        if (isPro && scope?.branding?.trim()) return `${body}\n\n— ${scope.branding.trim()}`;
        return `${body}\n\n${FREE_BRANDING_SUFFIX}`;
    };

    const messagePreviewBody = (rawMsg) => {
        const body = previewSubstitute(rawMsg || 'Your message will appear here...');
        return applyBrandingToBody(body, rawMsg, config);
    };

    const renderMessageTemplate = () => (
        <div className={styles.messagePreview}>
            <div className={styles.messageBubble}>
                <p>{messagePreviewBody(config.message)}</p>
            </div>
        </div>
    );

    const renderQuickReply = () => (
        <div className={styles.messagePreview}>
            <div className={styles.messageBubble}>
                <p>{messagePreviewBody(config.message)}</p>
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

    const renderMultiCta = () => {
        // Match the Meta wire format: title is the generic_template title
        // (capped at 80) and subtitle is the branding line. Substitute
        // placeholders so the preview shows what the recipient actually sees.
        const titleRaw = previewSubstitute(config.message || 'Your message here...');
        const title = titleRaw.length > 80 ? titleRaw.slice(0, 80) : titleRaw;
        const subtitle = config.appendBranding === false
            ? null
            : brandLabelFor(config);

        return (
            <div className={styles.buttonPreview}>
                <div className={styles.cardContainer}>
                    <div className={styles.cardInfo} style={{ paddingBottom: 0 }}>
                        <p className={styles.cardMessage}>{title}</p>
                        {subtitle && <span className={styles.cardSubtitle}>{subtitle}</span>}
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
    };

    const renderFollowGate = () => {
        const isFollowedState = false; // always show the gate state in preview
        // Gate message follows the same branding rule as message_template.
        const gateRaw  = config.gateMessage || 'Hey! 👋 To get the link, please follow our page first, then reply YES here 👇';
        const gateBody = applyBrandingToBody(previewSubstitute(gateRaw), config.gateMessage, config);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Gate message — substitute placeholders so the preview matches send-time output */}
                <div className={styles.messageBubble}>
                    <p>{gateBody}</p>
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
                    {config.linkDmType === 'button_template' ? (() => {
                        const rSlides = config.linkDmConfig?.slides || [{}];
                        const rSlide  = rSlides[0] || {};
                        const rSubtitle = getSubtitle(rSlide, config.linkDmConfig || {});
                        return (
                            <div className={styles.buttonPreview}>
                                <div className={styles.cardContainer}>
                                    {rSlide.imageUrl && <div style={{ width: '100%', height: 80, overflow: 'hidden', borderRadius: '6px 6px 0 0' }}><img src={rSlide.imageUrl} alt="reward" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                                    <div className={styles.cardInfo}>
                                        <p className={styles.cardTitle}>{rSlide.headline || "Here's your link!"}</p>
                                        {rSubtitle && <span className={styles.cardSubtitle}>{rSubtitle}</span>}
                                    </div>
                                    <div className={styles.cardButton}>{rSlide.buttonLabel || 'Get the link'}</div>
                                    {rSlides.length > 1 && (
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '4px 0' }}>
                                            {rSlides.map((_, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === 0 ? '#7C3AED' : 'rgba(255,255,255,0.3)' }} />)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })() : config.linkDmType === 'multi_cta' ? (
                        <div className={styles.buttonPreview}>
                            <div className={styles.cardContainer}>
                                <div className={styles.cardInfo}>
                                    <p className={styles.cardMessage}>{previewSubstitute(config.linkDmConfig?.message || config.linkMessage || '🎉 Thanks for following!')}</p>
                                    {(() => {
                                        const sub = config.linkDmConfig?.appendBranding === false
                                            ? null
                                            : brandLabelFor(config.linkDmConfig || {});
                                        return sub ? <span className={styles.cardSubtitle}>{sub}</span> : null;
                                    })()}
                                </div>
                                <div className={styles.ctaButtons}>
                                    {(config.linkDmConfig?.buttons || [{ label: 'Get the link' }]).filter(b => b.label).slice(0, 3).map((b, i) => (
                                        <div key={i} className={styles.ctaButton}>{b.label}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (() => {
                        // Reward = plain text. Use the unified helper bound
                        // to linkDmConfig so the preview matches send-time.
                        const raw  = config.linkMessage || '🎉 Thanks for following! Here is your link: https://...';
                        const body = applyBrandingToBody(previewSubstitute(raw), raw, config.linkDmConfig || {});
                        return (
                            <div className={styles.messageBubble}>
                                <p>{body}</p>
                            </div>
                        );
                    })()}
                </div>
            </div>
        );
    };

    const renderEmailCollector = () => {
        // Two-step flow: ask DM (top) + the captured-email confirmation
        // (bottom, faded). Ask + confirm both follow the unified branding
        // rule so the preview matches what recipients actually see.
        const SAMPLE_EMAIL = 'sarah@example.com';
        const askRaw = config.emailAskMessage ||
            'Hey {first_name}! 👋 Could you share your email address? 📧';
        const askBody = applyBrandingToBody(previewSubstitute(askRaw), askRaw, config);
        const confirmRaw = config.emailConfirmMessage ||
            "Thanks {first_name}! 🎉 We've got your email ({email}) and will be in touch soon.";
        const confirmBody = applyBrandingToBody(
            previewSubstitute(confirmRaw).replace(/\{email\}/g, SAMPLE_EMAIL),
            confirmRaw,
            config,
        );
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className={styles.messageBubble}>
                    <p>{askBody}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', opacity: 0.4 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>after they reply with email</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
                </div>
                <div style={{ opacity: 0.6 }}>
                    <div className={styles.messageBubble}>
                        <p>{confirmBody}</p>
                    </div>
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
            case 'email_collector':  return renderEmailCollector();
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
