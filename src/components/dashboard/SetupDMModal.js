'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CalendarClock } from 'lucide-react';
import DMSetupTab from './DMSetupTab';
import TriggerSetupTab from './TriggerSetupTab';
import SettingsTab from './SettingsTab';
import PhonePreview from './PhonePreview';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SetupDMModal.module.css';
import lightStyles from './SetupDMModal.light.module.css';

const TABS = [
    { key: 'dm-setup', label: 'DM Setup' },
    { key: 'trigger-setup', label: 'Trigger Setup' },
    { key: 'settings', label: 'Settings' },
];

export default function SetupDMModal({ onClose, postId, postCaption }) {
    const styles = useStyles(darkStyles, lightStyles);
    const [activeTab, setActiveTab] = useState('dm-setup');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [saveMessage, setSaveMessage] = useState('');
    const [templates, setTemplates] = useState([]);
    const [userPlan, setUserPlan] = useState('free');
    const [activeSlideIndex,  setActiveSlideIndex]  = useState(0);
    const [activeAbVariant,   setActiveAbVariant]   = useState('A');
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
    const DEFAULT_REPLY_MESSAGE = 'Hey! Check your DM ❤️ Didn\'t receive the link? Follow and comment again.';

    const [settingsConfig, setSettingsConfig] = useState({
        delayMessage: false,
        disableUniversalTriggers: false,
        commentAutoReply: true,
        replyMessage: DEFAULT_REPLY_MESSAGE,
        flowAutomation: false,
    });

    useEffect(() => {
        const fetchData = async () => {
            let hasExistingAutomation = false;

            // Fetch existing automation config
            if (postId) {
                try {
                    const res = await fetch(`/api/automations?postId=${postId}`);
                    const data = await res.json();

                    if (data.automations && data.automations.length > 0) {
                        const existing = data.automations[0];
                        if (existing.dm_config) setDmConfig(existing.dm_config);
                        if (existing.trigger_config) setTriggerConfig(existing.trigger_config);
                        if (existing.settings_config) setSettingsConfig(existing.settings_config);
                        hasExistingAutomation = true;
                    }
                } catch (err) {
                    console.error('Failed to load existing automation:', err);
                }
            }

            // If no existing automation, pre-fill from account default config (#10)
            if (!hasExistingAutomation) {
                try {
                    const { createClient } = await import('@/lib/supabase-client');
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: accounts } = await supabase
                            .from('connected_accounts')
                            .select('default_config')
                            .eq('user_id', user.id)
                            .eq('is_active', true)
                            .limit(1);

                        const defaults = accounts?.[0]?.default_config;
                        if (defaults) {
                            if (defaults.defaultMessage) {
                                setDmConfig((prev) => ({ ...prev, message: defaults.defaultMessage }));
                            }
                            if (defaults.defaultButtonName) {
                                setDmConfig((prev) => ({
                                    ...prev,
                                    slides: prev.slides.map((s) => ({
                                        ...s,
                                        // populate both flat format (current) and legacy buttons[] format
                                        buttonLabel: s.buttonLabel || defaults.defaultButtonName,
                                        buttons: (s.buttons || []).map((b) => ({
                                            ...b,
                                            label: b.label || defaults.defaultButtonName,
                                        })),
                                    })),
                                }));
                            }
                            if (defaults.keywords?.length > 0) {
                                setTriggerConfig((prev) => ({
                                    ...prev,
                                    keywords: [...new Set([...prev.keywords, ...defaults.keywords])],
                                }));
                            }
                        }
                    }
                } catch {
                    // Non-critical — defaults just won't be pre-filled
                }
            }

            // Fetch saved templates
            try {
                const res = await fetch('/api/templates');
                const data = await res.json();
                setTemplates(data.templates || []);
            } catch {
                // Templates table may not exist yet
            }

            // Fetch user plan from user_plans (single source of truth)
            // Uses /api/usage which already returns the effective plan string
            try {
                const planRes = await fetch('/api/usage');
                if (planRes.ok) {
                    const planData = await planRes.json();
                    // plan is the effectivePlan string: 'free' | 'trial' | 'pro' | 'business'
                    setUserPlan(planData.plan || 'free');
                }
            } catch {
                // Plan fetch failed — default to free
            }

            setIsLoadingConfig(false);
        };

        fetchData();
    }, [postId]);

    const handleImageUploadFromPreview = (slideIndex, dataUrl) => {
        if (dmConfig.abEnabled) {
            const key = activeAbVariant === 'A' ? 'variantA' : 'variantB';
            const variantConfig = dmConfig[key] || {};
            const newSlides = [...(variantConfig.slides || [])];
            newSlides[slideIndex] = { ...newSlides[slideIndex], imageUrl: dataUrl };
            setDmConfig({ ...dmConfig, [key]: { ...variantConfig, slides: newSlides } });
        } else {
            const newSlides = [...(dmConfig.slides || [])];
            newSlides[slideIndex] = { ...newSlides[slideIndex], imageUrl: dataUrl };
            setDmConfig({ ...dmConfig, slides: newSlides });
        }
    };

    const handleSaveTemplate = async (name) => {
        try {
            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    dmConfig,
                    triggerConfig,
                    settingsConfig,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setSaveMessage('✅ Template saved!');
                setTemplates((prev) => [data.template, ...prev]);
                setTimeout(() => setSaveMessage(''), 3000);
            } else {
                setSaveMessage(`❌ ${data.error || 'Failed to save template'}`);
            }
        } catch (err) {
            setSaveMessage(`❌ Template save failed: ${err.message}`);
        }
    };

    const handleLoadTemplate = (template) => {
        if (template.dm_config) setDmConfig(template.dm_config);
        if (template.trigger_config) setTriggerConfig(template.trigger_config);
        if (template.settings_config) setSettingsConfig(template.settings_config);
        setActiveSlideIndex(0); // reset to first slide when loading a template
        setSaveMessage(`✅ Loaded template: ${template.name}`);
        setTimeout(() => setSaveMessage(''), 3000);
    };

    const handleDeleteTemplate = async (templateId) => {
        try {
            const res = await fetch(`/api/templates?id=${templateId}`, { method: 'DELETE' });
            if (res.ok) {
                setTemplates((prev) => prev.filter((t) => t.id !== templateId));
                setSaveMessage('✅ Template deleted');
                setTimeout(() => setSaveMessage(''), 3000);
            } else {
                const data = await res.json();
                setSaveMessage(`❌ ${data.error || 'Failed to delete template'}`);
            }
        } catch (err) {
            setSaveMessage(`❌ Delete failed: ${err.message}`);
        }
    };

    const renderTab = () => {
        switch (activeTab) {
            case 'dm-setup':
                return (
                    <DMSetupTab
                        config={dmConfig}
                        onChange={setDmConfig}
                        templates={templates}
                        onSaveTemplate={handleSaveTemplate}
                        onLoadTemplate={handleLoadTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        userPlan={userPlan}
                        activeSlideIndex={activeSlideIndex}
                        onSlideChange={setActiveSlideIndex}
                        activeAbVariant={activeAbVariant}
                        onAbVariantChange={setActiveAbVariant}
                    />
                );
            case 'trigger-setup':
                return <TriggerSetupTab config={triggerConfig} onChange={setTriggerConfig} />;
            case 'settings':
                return <SettingsTab config={settingsConfig} onChange={setSettingsConfig} userPlan={userPlan} />;
            default:
                return null;
        }
    };

    const validateVariant = (cfg, label) => {
        switch (cfg?.type) {
            case 'button_template': {
                const hasButton = (cfg.slides || []).some((s) =>
                    (s.buttonLabel?.trim() && s.buttonUrl?.trim()) ||
                    (s.buttons || []).some((b) => b.label?.trim() && b.value?.trim())
                );
                if (!hasButton) return `${label}: Add at least one button with a label and URL.`;
                break;
            }
            case 'message_template':
                if (!cfg.message?.trim()) return `${label}: Enter a message.`;
                break;
            case 'quick_reply': {
                if (!cfg.message?.trim()) return `${label}: Enter an opening message.`;
                const hasReplies = (cfg.quickReplies || []).some((qr) => qr.title?.trim());
                if (!hasReplies) return `${label}: Add at least one quick reply option.`;
                break;
            }
            case 'multi_cta': {
                const hasButton = (cfg.buttons || []).some((b) => b.label?.trim() && b.url?.trim());
                if (!hasButton) return `${label}: Add at least one button with a label and URL.`;
                break;
            }
            case 'follow_up':
                if (!cfg.gateMessage?.trim()) return `${label}: Enter the gate message.`;
                break;
            default:
                if (!cfg?.type) return `${label}: Select a DM type.`;
        }
        return null;
    };

    const validateConfig = () => {
        if (dmConfig.abEnabled) {
            if (!dmConfig.variantA || !dmConfig.variantB) {
                return 'Configure both Variant A and Variant B in DM Setup.';
            }
            const errA = validateVariant(dmConfig.variantA, 'Variant A');
            if (errA) return errA;
            const errB = validateVariant(dmConfig.variantB, 'Variant B');
            if (errB) return errB;
        } else {
            const err = validateVariant(dmConfig, 'DM Setup');
            if (err) return err;
            if (dmConfig.type === 'follow_up') {
                const hasReward = dmConfig.linkMessage?.trim() ||
                    (dmConfig.linkDmConfig?.buttons || []).some((b) => b.label?.trim() && b.url?.trim()) ||
                    (dmConfig.linkDmConfig?.slides || []).some((s) => s.buttonUrl?.trim());
                if (!hasReward) return 'Add a reward link in DM Setup (Step 4).';
            }
        }

        const triggerType = triggerConfig.type || 'keywords';
        if (triggerType === 'keywords' && (!triggerConfig.keywords || triggerConfig.keywords.length === 0)) {
            return 'Add at least one trigger keyword in Trigger Setup.';
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

            // 2. Upload any data-URL images (both main and A/B variants)
            const uploadSlides = async (slides, prefix) => {
                const final = [...slides];
                for (let i = 0; i < final.length; i++) {
                    const slide = final[i];
                    if (slide.imageUrl && slide.imageUrl.startsWith('data:image')) {
                        setSaveMessage(`Uploading image for ${prefix} slide ${i + 1}...`);
                        const response = await fetch(slide.imageUrl);
                        const blob     = await response.blob();
                        const ext      = blob.type.split('/')[1] || 'jpg';
                        const filename = `${user.id}/${postId}_${prefix}_${i}_${Date.now()}.${ext}`;
                        const { error: uploadError } = await supabase.storage
                            .from('dm_images')
                            .upload(filename, blob, { upsert: true });
                        if (uploadError) throw new Error(`Failed to upload ${prefix} slide ${i + 1} image: ${uploadError.message}`);
                        const { data: { publicUrl } } = supabase.storage.from('dm_images').getPublicUrl(filename);
                        final[i] = { ...slide, imageUrl: publicUrl };
                    }
                }
                return final;
            };

            let finalDmConfig = { ...dmConfig };

            if (dmConfig.abEnabled) {
                // Upload images for both variants independently
                if (dmConfig.variantA?.slides) {
                    const uploadedA = await uploadSlides(dmConfig.variantA.slides, 'varA');
                    finalDmConfig = { ...finalDmConfig, variantA: { ...dmConfig.variantA, slides: uploadedA } };
                }
                if (dmConfig.variantB?.slides) {
                    const uploadedB = await uploadSlides(dmConfig.variantB.slides, 'varB');
                    finalDmConfig = { ...finalDmConfig, variantB: { ...dmConfig.variantB, slides: uploadedB } };
                }
            } else {
                const finalSlides = await uploadSlides(dmConfig.slides || [], 'slide');
                finalDmConfig = { ...finalDmConfig, slides: finalSlides };
            }

            setSaveMessage('Saving automation...');

            // 3. Save the automation to DB
            const res = await fetch('/api/automations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId,
                    dmConfig: finalDmConfig,
                    triggerConfig,
                    settingsConfig,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                const isScheduled = data.scheduled && data.scheduledStartAt;
                const successMsg = isScheduled
                    ? `✅ Campaign scheduled for ${new Date(data.scheduledStartAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}!`
                    : '✅ Automation saved successfully!';
                setSaveMessage(successMsg);
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 1500);
            } else {
                setSaveMessage(`❌ ${data.error || 'Failed to save'}`);
            }
        } catch (err) {
            setSaveMessage(`❌ Save failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
      <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div>
                        <h2 className={styles.modalTitle}>Configure AutoDM</h2>
                        {postCaption && (
                            <p className={styles.postCaption}>{postCaption}</p>
                        )}
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
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
                        {/* Left column: scrollable form + always-pinned save bar */}
                        <div className={styles.leftCol}>
                            <div className={styles.formPanel}>
                                {renderTab()}
                            </div>
                            {/* Save bar is OUTSIDE the scrollable formPanel — always visible */}
                            <div className={styles.saveBar}>
                                {saveMessage && (
                                    <span className={styles.saveMessage}>{saveMessage}</span>
                                )}
                                {(() => {
                                    const isScheduled = settingsConfig.scheduledStartEnabled &&
                                        settingsConfig.scheduledStartAt &&
                                        new Date(settingsConfig.scheduledStartAt) > new Date();
                                    return (
                                        <button
                                            className={`${styles.saveBtn} ${isScheduled ? styles.saveBtnScheduled : ''}`}
                                            onClick={handleSave}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? (
                                                <><Loader2 size={14} className={styles.spinner} /> Saving…</>
                                            ) : isScheduled ? (
                                                <><CalendarClock size={14} /> Schedule Campaign</>
                                            ) : (
                                                'Save & Activate'
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                        {/* Right column: phone preview */}
                        <div className={styles.previewPanel}>
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <PhonePreview
                                    config={dmConfig.abEnabled
                                        ? ((activeAbVariant === 'A' ? dmConfig.variantA : dmConfig.variantB) || {})
                                        : dmConfig
                                    }
                                    onImageUpload={handleImageUploadFromPreview}
                                    activeSlideIndex={activeSlideIndex}
                                    onSlideChange={setActiveSlideIndex}
                                    userPlan={userPlan}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
      document.body
    );
}
