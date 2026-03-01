'use client';

import styles from './PhonePreview.module.css';

export default function PhonePreview({ config }) {
    const renderContent = () => {
        switch (config.type) {
            case 'button_template':
                return (
                    <div className={styles.buttonPreview}>
                        {/* Image area */}
                        <div className={styles.previewImage}>
                            {config.slides[0]?.imageUrl ? (
                                <img src={config.slides[0].imageUrl} alt="" />
                            ) : (
                                <div className={styles.imagePlaceholder}>
                                    <span>Image Preview</span>
                                </div>
                            )}
                        </div>
                        {/* Buttons */}
                        <div className={styles.previewButtons}>
                            {config.slides[0]?.buttons.map((btn, i) => (
                                <div key={i} className={styles.previewBtn}>
                                    {btn.label || `Button ${i + 1}`}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'message_template':
                return (
                    <div className={styles.messagePreview}>
                        <div className={styles.messageBubble}>
                            <p>{config.message || 'Your message will appear here...'}</p>
                        </div>
                        {config.branding && (
                            <span className={styles.branding}>{config.branding}</span>
                        )}
                    </div>
                );

            case 'post_reels':
                return (
                    <div className={styles.postPreview}>
                        <div className={styles.postCard}>
                            <div className={styles.postThumb}></div>
                            <p className={styles.postCaption}>Selected post will appear here</p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className={styles.phone}>
            <div className={styles.phoneBezel}>
                {/* Notch */}
                <div className={styles.notch}></div>

                {/* Screen */}
                <div className={styles.screen}>
                    {/* Header */}
                    <div className={styles.chatHeader}>
                        <div className={styles.chatAvatar}></div>
                        <span className={styles.chatName}>AutoDM</span>
                    </div>

                    {/* Content */}
                    <div className={styles.chatBody}>
                        {renderContent()}
                    </div>

                    {/* Message bar */}
                    <div className={styles.chatBar}>
                        <span>Message...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
