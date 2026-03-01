'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
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

export default function SetupDMModal({ onClose, postCaption }) {
    const [activeTab, setActiveTab] = useState('dm-setup');
    const [dmConfig, setDmConfig] = useState({
        type: 'button_template',
        slides: [{ imageUrl: '', buttons: [{ type: 'url', label: '', value: '' }] }],
        message: '',
        variables: [],
        branding: 'Sent with AutoDM',
        linkedPostId: null,
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

    const handleSave = () => {
        // Will save to Supabase when API integration is ready
        console.log('Saving automation:', { dmConfig, triggerConfig, settingsConfig });
        onClose();
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
                <div className={styles.body}>
                    <div className={styles.formPanel}>
                        {renderTab()}
                        <div className={styles.saveBar}>
                            <button className="btn btn-primary" onClick={handleSave}>
                                Save
                            </button>
                        </div>
                    </div>
                    <div className={styles.previewPanel}>
                        <PhonePreview config={dmConfig} />
                    </div>
                </div>
            </div>
        </div>
    );
}
