'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import DMSetupTab from './DMSetupTab';
import TriggerSetupTab from './TriggerSetupTab';
import SettingsTab from './SettingsTab';
import PhonePreview from './PhonePreview';
import styles from './SetupDMModal.module.css';

const TABS = [
    { key: 'dm-setup', label: 'DM Setup' },
    { key: 'trigger-setup', label: 'Trigger Setup' },
    { key: 'settings', label: 'Settings' },
];

export default function SetupDMModal({ onClose, postId, postCaption }) {
    const [activeTab, setActiveTab] = useState('dm-setup');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [saveMessage, setSaveMessage] = useState('');
    const [dmConfig, setDmConfig] = useState({
        type: 'button_template',
        slides: [{ imageUrl: '', buttons: [{ type: 'url', label: '', value: '' }] }],
        message: '',
        variables: [],
        branding: 'Sent with AutoDM',
    });
    const [triggerConfig, setTriggerConfig] = useState({
        type: 'keywords',
        keywords: [],
        excludeKeywords: false,
        sendOncePerUser: true,
        excludeMentions: false,
    });
    const [settingsConfig, setSettingsConfig] = useState({
        delayMessage: false,
        disableUniversalTriggers: false,
        commentAutoReply: false,
        flowAutomation: false,
    });

    useEffect(() => {
        const fetchConfig = async () => {
            if (!postId) {
                setIsLoadingConfig(false);
                return;
            }

            try {
                const res = await fetch(`/api/automations?postId=${postId}`);
                const data = await res.json();

                if (data.automations && data.automations.length > 0) {
                    const existing = data.automations[0];
                    setDmConfig(existing.dm_config || dmConfig);
                    setTriggerConfig(existing.trigger_config || triggerConfig);
                    setSettingsConfig(existing.settings_config || settingsConfig);
                }
            } catch (err) {
                console.error('Failed to load existing automation:', err);
            } finally {
                setIsLoadingConfig(false);
            }
        };

        fetchConfig();
    }, [postId]);

    const handleImageUploadFromPreview = (slideIndex, dataUrl) => {
        const newSlides = [...dmConfig.slides];
        newSlides[slideIndex] = { ...newSlides[slideIndex], imageUrl: dataUrl };
        setDmConfig({ ...dmConfig, slides: newSlides });
    };

    const renderTab = () => {
        switch (activeTab) {
            case 'dm-setup':
                return <DMSetupTab config={dmConfig} onChange={setDmConfig} />;
            case 'trigger-setup':
                return <TriggerSetupTab config={triggerConfig} onChange={setTriggerConfig} />;
            case 'settings':
                return <SettingsTab config={settingsConfig} onChange={setSettingsConfig} />;
            default:
                return null;
        }
    };

    const validateConfig = () => {
        if (dmConfig.type === 'button_template') {
            const hasButton = dmConfig.slides.some((s) =>
                s.buttons.some((b) => b.label.trim() && b.value.trim())
            );
            if (!hasButton) return 'Please add at least one button with a label and URL.';
        }

        if (dmConfig.type === 'message_template') {
            if (!dmConfig.message.trim()) return 'Please enter a message.';
        }

        if (triggerConfig.keywords.length === 0) {
            return 'Please add at least one trigger keyword in the Trigger Setup tab.';
        }

        return null;
    };

    const handleSave = async () => {
        const error = validateConfig();
        if (error) {
            setSaveMessage(`⚠️ ${error}`);
            return;
        }

        setIsSaving(true);
        setSaveMessage('Uploading images...');

        try {
            // 1. Initialize Supabase client for storage uploads
            const { createClient } = await import('@/lib/supabase-client');
            const supabase = createClient();

            // Get current user for auth context
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be logged in to save');

            // 2. Upload any new images in the slides
            const finalSlides = [...dmConfig.slides];

            for (let i = 0; i < finalSlides.length; i++) {
                const slide = finalSlides[i];

                // If it's a data URL (new upload), we need to upload it to Supabase
                if (slide.imageUrl && slide.imageUrl.startsWith('data:image')) {
                    setSaveMessage(`Uploading image for slide ${i + 1}...`);

                    // Convert base64 to Blob
                    const response = await fetch(slide.imageUrl);
                    const blob = await response.blob();

                    // Create unique filename: user_id/post_id_slideIndex_timestamp.ext
                    const ext = blob.type.split('/')[1] || 'jpg';
                    const filename = `${user.id}/${postId}_${i}_${Date.now()}.${ext}`;

                    // Upload to dm_images bucket
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('dm_images')
                        .upload(filename, blob, { upsert: true });

                    if (uploadError) {
                        throw new Error(`Failed to upload slide ${i + 1} image: ${uploadError.message}`);
                    }

                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('dm_images')
                        .getPublicUrl(filename);

                    // Replace data URL with public Supabase URL
                    finalSlides[i] = { ...slide, imageUrl: publicUrl };
                }
            }

            setSaveMessage('Saving automation...');

            // 3. Save the automation to DB
            const res = await fetch('/api/automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId,
                    dmConfig: {
                        ...dmConfig,
                        slides: finalSlides, // Use the slides with uploaded public URLs
                    },
                    triggerConfig,
                    settingsConfig,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSaveMessage('✅ Automation saved successfully!');
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 1000);
            } else {
                setSaveMessage(`❌ ${data.error || 'Failed to save'}`);
            }
        } catch (err) {
            setSaveMessage(`❌ Save failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <div>
                        <h2 className={styles.modalTitle}>Setup DM Automation</h2>
                        {postCaption && (
                            <p className={styles.postCaption}>{postCaption}</p>
                        )}
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body: Split layout */}
                {isLoadingConfig ? (
                    <div className={styles.loadingConfig}>
                        <Loader2 className={styles.spinner} size={32} />
                        <p>Loading automation settings...</p>
                    </div>
                ) : (
                    <div className={styles.body}>
                        <div className={styles.formPanel}>
                            {renderTab()}

                            {/* Save bar */}
                            <div className={styles.saveBar}>
                                {saveMessage && (
                                    <span className={styles.saveMessage}>{saveMessage}</span>
                                )}
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={14} className={styles.spinner} />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save & Activate'
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className={styles.previewPanel}>
                            <PhonePreview
                                config={dmConfig}
                                onImageUpload={handleImageUploadFromPreview}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
