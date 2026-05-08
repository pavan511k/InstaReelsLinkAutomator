'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { X, Loader2, CalendarClock, Eye, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
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

export default function SetupDMModal({ onClose, postId, postCaption, platform = 'instagram' }) {
    const styles = useStyles(darkStyles, lightStyles);
    const [activeTab, setActiveTab] = useState('dm-setup');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    /* Upload progress drives the thin bar above the save row.
       total === 0 means "nothing to upload" — bar stays hidden.
       current advances as each data-URL slide finishes uploading.
       Save status text now lives in a single sonner loading toast
       (saveToastIdRef) instead of an inline saveMessage span — the
       toast updates in place as upload progresses, then converts to
       success/error once the API call resolves. */
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
    const saveToastIdRef = useRef(null);
    const [templates, setTemplates] = useState([]);
    const [userPlan, setUserPlan] = useState('free');
    const [activeSlideIndex,  setActiveSlideIndex]  = useState(0);
    const [activeAbVariant,   setActiveAbVariant]   = useState('A');
    const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
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
            // Kick off the three independent API calls in parallel — they
            // all run on /api/* and don't depend on each other. Previously
            // these were awaited serially, costing ~4× round-trips.
            const automationsP = postId
                ? fetch(`/api/automations?postId=${postId}`).then((r) => r.json()).catch(() => null)
                : Promise.resolve(null);
            const templatesP   = fetch('/api/templates').then((r) => r.json()).catch(() => null);
            const usageP       = fetch('/api/usage').then((r) => r.ok ? r.json() : null).catch(() => null);

            const [automationsData, templatesData, usageData] = await Promise.all([
                automationsP, templatesP, usageP,
            ]);

            let hasExistingAutomation = false;
            if (automationsData?.automations?.length > 0) {
                const existing = automationsData.automations[0];
                if (existing.dm_config)       setDmConfig(existing.dm_config);
                if (existing.trigger_config)  setTriggerConfig(existing.trigger_config);
                if (existing.settings_config) setSettingsConfig(existing.settings_config);
                hasExistingAutomation = true;
            }

            setTemplates(templatesData?.templates || []);
            setUserPlan(usageData?.plan || 'free');

            // Pre-fill from account default config only when there's no
            // existing automation — this branch is conditional, so we
            // run it after the parallel batch resolves.
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
                toast.success(`Template "${name}" saved`);
                setTemplates((prev) => [data.template, ...prev]);
            } else {
                toast.error(data.error || 'Failed to save template');
            }
        } catch (err) {
            toast.error(`Template save failed: ${err.message}`);
        }
    };

    const handleLoadTemplate = (template) => {
        /* Load only the DM portion. Previously this also called
           setTriggerConfig(template.trigger_config) and
           setSettingsConfig(template.settings_config), which clobbered
           the user's current trigger keywords and schedule whenever
           they picked a template. New model: a template is a starting
           point for the *message*; the user's trigger and settings for
           this specific automation are theirs alone.

           Save still bundles all three on POST (see handleSaveTemplate)
           so old templates remain valid storage; we just stop applying
           the bundled trigger/settings on load. */
        if (template.dm_config) setDmConfig(template.dm_config);
        setActiveSlideIndex(0); // reset to first slide when loading a template
        toast.success(`Loaded template: ${template.name}`);
    };

    const handleDeleteTemplate = async (templateId) => {
        try {
            const res = await fetch(`/api/templates?id=${templateId}`, { method: 'DELETE' });
            if (res.ok) {
                setTemplates((prev) => prev.filter((t) => t.id !== templateId));
                toast.success('Template deleted');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to delete template');
            }
        } catch (err) {
            toast.error(`Delete failed: ${err.message}`);
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
                        onLoadTemplate={handleLoadTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        userPlan={userPlan}
                        platform={platform}
                        activeSlideIndex={activeSlideIndex}
                        onSlideChange={setActiveSlideIndex}
                        activeAbVariant={activeAbVariant}
                        onAbVariantChange={setActiveAbVariant}
                    />
                );
            case 'trigger-setup':
                return (
                    <TriggerSetupTab
                        config={triggerConfig}
                        onChange={setTriggerConfig}
                        settings={settingsConfig}
                        onSettingsChange={setSettingsConfig}
                    />
                );
            case 'settings':
                return (
                    <SettingsTab
                        config={settingsConfig}
                        onChange={setSettingsConfig}
                        userPlan={userPlan}
                        onSaveTemplate={handleSaveTemplate}
                    />
                );
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
                const replies = (cfg.quickReplies || []).filter((qr) => qr.title?.trim());
                if (replies.length === 0) return `${label}: Add at least one quick reply option.`;
                // Each chip with a title must also have a response — otherwise
                // tapping the chip results in silent no-op for the recipient.
                const missingResponse = replies.find((qr) => !qr.responseMessage?.trim());
                if (missingResponse) {
                    return `${label}: Add a reply for chip "${missingResponse.title.trim()}".`;
                }
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
            case 'email_collector':
                if (!cfg.emailAskMessage?.trim()) return `${label}: Enter the email-ask message.`;
                if (!cfg.emailConfirmMessage?.trim()) return `${label}: Enter the confirmation message.`;
                break;
            default:
                if (!cfg?.type) return `${label}: Select a DM type.`;
        }
        return null;
    };

    /* Per-tab validators — each returns the first error found in its tab,
       or null when the tab is OK. Drive both:
         (a) the soft-wizard "Next →" button (disabled when current tab
             has an error), and
         (b) the small red dot on tab pills indicating which tab needs
             attention.
       validateConfig() composes them in tab order so save-time errors
       still bubble up the same way as before. */
    const validateDmTab = () => {
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
        return null;
    };

    const validateTriggerTab = () => {
        const triggerType = triggerConfig.type || 'keywords';
        if (triggerType === 'keywords' && (!triggerConfig.keywords || triggerConfig.keywords.length === 0)) {
            return 'Add at least one trigger keyword in Trigger Setup.';
        }
        return null;
    };

    const validateSettingsTab = () => {
        /* Date sanity — the datetime-local input's `min` only constrains
           the spinner; users can still paste / keyboard-type a past
           timestamp. */
        const now = Date.now();
        if (settingsConfig.scheduledStartEnabled && settingsConfig.scheduledStartAt) {
            if (new Date(settingsConfig.scheduledStartAt).getTime() <= now) {
                return 'Scheduled start time is in the past — pick a future time in Settings.';
            }
        }
        if (settingsConfig.expiresEnabled && settingsConfig.expiresAt) {
            const expiresAtMs = new Date(settingsConfig.expiresAt).getTime();
            if (expiresAtMs <= now) {
                return 'Expiry time is in the past — pick a future time in Settings.';
            }
            if (settingsConfig.scheduledStartEnabled && settingsConfig.scheduledStartAt
                && expiresAtMs <= new Date(settingsConfig.scheduledStartAt).getTime()) {
                return 'Expiry time must be after the scheduled start time.';
            }
        }
        return null;
    };

    const validateConfig = () =>
        validateDmTab() || validateTriggerTab() || validateSettingsTab();

    const tabErrors = {
        'dm-setup':       validateDmTab(),
        'trigger-setup':  validateTriggerTab(),
        'settings':       validateSettingsTab(),
    };

    const handleSave = async () => {
        const error = validateConfig();
        if (error) {
            toast.warning(error);
            return;
        }

        setIsSaving(true);

        /* Count data-URL slides upfront so the progress bar has an accurate
           denominator before the first upload begins. Without the pre-count,
           the bar would jump as each variant's count is discovered mid-flight. */
        const countDataUrlSlides = (slides) =>
            (slides || []).filter((s) => s.imageUrl && s.imageUrl.startsWith('data:image')).length;
        const totalUploads = dmConfig.abEnabled
            ? countDataUrlSlides(dmConfig.variantA?.slides) + countDataUrlSlides(dmConfig.variantB?.slides)
            : countDataUrlSlides(dmConfig.slides);

        setUploadProgress({ current: 0, total: totalUploads });
        // Single sonner toast that updates as work progresses. Same id is
        // reused on success/error below so the user only ever sees one
        // toast for this save.
        saveToastIdRef.current = toast.loading(
            totalUploads > 0 ? `Uploading 0 of ${totalUploads} images…` : 'Saving automation…'
        );

        try {
            // 1. Initialize Supabase client for storage uploads
            const { createClient } = await import('@/lib/supabase-client');
            const supabase = createClient();

            // Get current user for auth context
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be logged in to save');

            // 2. Upload any data-URL images (both main and A/B variants).
            //    Progress callback fires after each upload so the bar advances
            //    in sync with the network reality, not a guess.
            let completed = 0;
            const uploadSlides = async (slides, prefix) => {
                const final = [...slides];
                for (let i = 0; i < final.length; i++) {
                    const slide = final[i];
                    if (slide.imageUrl && slide.imageUrl.startsWith('data:image')) {
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
                        completed += 1;
                        setUploadProgress({ current: completed, total: totalUploads });
                        toast.loading(`Uploading ${completed} of ${totalUploads} images…`, {
                            id: saveToastIdRef.current,
                        });
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

            toast.loading('Saving automation…', { id: saveToastIdRef.current });

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
                    ? `Campaign scheduled for ${new Date(data.scheduledStartAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    : 'Automation saved successfully';
                // Replace the in-progress loading toast with the success
                // result by passing the same id.
                toast.success(successMsg, { id: saveToastIdRef.current });
                onClose();
                // Reload so the parent table reflects the new status.
                window.location.reload();
            } else {
                const errMsg = data.error || 'Failed to save';
                toast.error(errMsg, { id: saveToastIdRef.current });
            }
        } catch (err) {
            toast.error(`Save failed: ${err.message}`, { id: saveToastIdRef.current });
        } finally {
            setIsSaving(false);
            setUploadProgress({ current: 0, total: 0 });
            saveToastIdRef.current = null;
        }
    };

    return (
        <Modal
            open={true}
            onClose={onClose}
            size={null}
            ariaLabel="Configure AutoDM"
            showCloseButton={false}
            noPadding
            className={styles.modal}
        >
                {/* Header — kept inline so the existing modalHeader / modalTitle /
                    postCaption / closeBtn styling and the .modal::before glow
                    accent are preserved verbatim. Modal primitive provides
                    portal, escape, focus trap, and backdrop guard around it. */}
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

                {/* Tabs — pill shows a small red dot when its validator
                    detects a missing required field. Helps the user see
                    at a glance which tab needs attention without having
                    to click through them. */}
                <div className={styles.tabs}>
                    {TABS.map((tab) => {
                        const hasError = !!tabErrors[tab.key];
                        return (
                            <button
                                key={tab.key}
                                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                                title={hasError ? tabErrors[tab.key] : undefined}
                            >
                                {tab.label}
                                {hasError && (
                                    <span className={styles.tabDot} aria-label="Tab has missing required fields" />
                                )}
                            </button>
                        );
                    })}
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
                            {/* Upload progress bar — only renders while uploads are in-flight,
                                fades out once total === 0. Sits flush against the top edge of
                                the save bar so it reads as "the save is working", not a
                                separate UI element. */}
                            {uploadProgress.total > 0 && (
                                <div className={styles.uploadProgress}>
                                    <div
                                        className={styles.uploadProgressFill}
                                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                            {/* Save bar is OUTSIDE the scrollable formPanel — always visible.
                                Soft-wizard pattern: DM Setup and Trigger Setup tabs show a
                                "Next →" button that advances to the next tab. The Save /
                                Schedule button only appears on the Settings (last) tab so
                                users naturally walk through the steps. Tab nav stays clickable
                                for power users who want to jump around. */}
                            <div className={styles.saveBar}>
                                {/* Spacer keeps action buttons flush-right now
                                    that the inline saveMessage span was removed
                                    in favour of a sonner loading toast. */}
                                <div style={{ flex: 1 }} />
                                <button
                                    className={styles.previewToggleBtn}
                                    onClick={() => setMobilePreviewOpen(true)}
                                    type="button"
                                    aria-label="Show preview"
                                >
                                    <Eye size={14} /> Preview
                                </button>
                                {activeTab !== 'settings' ? (
                                    <button
                                        className={styles.nextBtn}
                                        type="button"
                                        onClick={() => {
                                            const currentErr = tabErrors[activeTab];
                                            if (currentErr) {
                                                toast.warning(currentErr);
                                                return;
                                            }
                                            const next = activeTab === 'dm-setup' ? 'trigger-setup' : 'settings';
                                            setActiveTab(next);
                                        }}
                                    >
                                        Next
                                        <ArrowRight size={14} strokeWidth={2.5} />
                                    </button>
                                ) : (
                                    (() => {
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
                                    })()
                                )}
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

                {/* Mobile preview sheet — full-screen overlay shown only on mobile when toggled */}
                {mobilePreviewOpen && (
                    <div className={styles.mobilePreviewSheet}>
                        <div className={styles.mobilePreviewHeader}>
                            <span className={styles.mobilePreviewTitle}>Preview</span>
                            <button
                                onClick={() => setMobilePreviewOpen(false)}
                                className={styles.closeBtn}
                                aria-label="Close preview"
                                type="button"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.mobilePreviewBody}>
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
                )}
        </Modal>
    );
}
