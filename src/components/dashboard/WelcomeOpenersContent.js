'use client';

import { useState } from 'react';
import { MessageSquarePlus, Save, Trash2, Plus, X } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './SettingsContent.module.css';
import lightStyles from './SettingsContent.light.module.css';

export default function WelcomeOpenersContent({ connectedAccounts = [] }) {
    const styles = useStyles(darkStyles, lightStyles);
    const firstActiveAccount = connectedAccounts.find((a) => a.is_active) || null;

    const iceBreakerCfg = firstActiveAccount?.default_config?.iceBreakers || [];
    const [iceBreakers, setIceBreakers] = useState(
        iceBreakerCfg.length > 0 ? iceBreakerCfg : [{ title: '', responseMessage: '' }]
    );
    const [ibSaving, setIbSaving] = useState(false);
    const [ibMsg, setIbMsg]       = useState('');

    const handleSaveIceBreakers = async () => {
        if (!firstActiveAccount) return;
        setIbSaving(true); setIbMsg('');
        try {
            const filled = iceBreakers.filter((ib) => ib.title?.trim() && ib.responseMessage?.trim());
            const res = await fetch('/api/ice-breakers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: firstActiveAccount.id, iceBreakers: filled }),
            });
            const data = await res.json();
            if (res.ok) {
                const msg = data.metaPushSuccess
                    ? `✅ ${data.savedCount} welcome opener${data.savedCount !== 1 ? 's' : ''} saved and pushed to Instagram`
                    : `✅ Saved locally. Meta push failed: ${data.metaError || 'unknown error'}. Will retry automatically.`;
                setIbMsg(msg);
                setTimeout(() => setIbMsg(''), 5000);
            } else {
                setIbMsg(`❌ ${data.error}`);
            }
        } catch (e) { setIbMsg(`❌ ${e.message}`); }
        finally { setIbSaving(false); }
    };

    const handleClearIceBreakers = async () => {
        if (!firstActiveAccount || !confirm('Remove all welcome openers?')) return;
        await fetch(`/api/ice-breakers?accountId=${firstActiveAccount.id}`, { method: 'DELETE' });
        setIceBreakers([{ title: '', responseMessage: '' }]);
        setIbMsg('✅ Welcome openers cleared');
        setTimeout(() => setIbMsg(''), 3000);
    };

    if (!firstActiveAccount) {
        return (
            <div className={styles.settingsPage}>
                <div className={styles.header}>
                    <h1 className={styles.pageTitle}>Welcome Openers</h1>
                </div>
                <div className={styles.tabContent}>
                    <div className={styles.noAccountBanner}>
                        <div className={styles.noAccountIcon}><MessageSquarePlus size={28} /></div>
                        <h3 className={styles.noAccountTitle}>Connect your Instagram account first</h3>
                        <p className={styles.noAccountDesc}>
                            Welcome Openers requires a connected account.
                            Head to <strong>Settings → Permissions</strong> to connect.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.settingsPage}>
            <div className={styles.header}>
                <h1 className={styles.pageTitle}>Welcome Openers</h1>
            </div>
            <div className={styles.container} style={{ display: 'block' }}>
                <div className={styles.tabContent}>
                    <div className={styles.configSection}>
                        <h2 className={styles.sectionTitle}><MessageSquarePlus size={18} /> Welcome Openers</h2>
                        <p className={styles.sectionDesc}>
                            Display up to <strong>4 quick-reply buttons</strong> when a user first opens your Instagram inbox.
                            Each button sends an auto-reply DM with your configured message. Perfect for showcasing offers,
                            links, or FAQs.
                        </p>

                        <div className={styles.infoBoxPurple}>
                            💡 These buttons appear inside your DM inbox on Instagram. When a visitor taps one, AutoDM instantly
                            replies with the message you configure here. Requires a Facebook Page connection.
                        </div>

                        {iceBreakers.map((ib, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <input
                                        className={styles.formInput}
                                        placeholder={`Button ${i + 1} text (e.g. "What offers are available?")`}
                                        maxLength={80}
                                        value={ib.title}
                                        onChange={(e) => {
                                            const updated = [...iceBreakers];
                                            updated[i] = { ...updated[i], title: e.target.value };
                                            setIceBreakers(updated);
                                        }}
                                    />
                                    <textarea
                                        className={styles.formInput}
                                        placeholder={`Auto-reply message when tapped (e.g. "Here are our current offers!")`}
                                        rows={2}
                                        value={ib.responseMessage}
                                        onChange={(e) => {
                                            const updated = [...iceBreakers];
                                            updated[i] = { ...updated[i], responseMessage: e.target.value };
                                            setIceBreakers(updated);
                                        }}
                                    />
                                </div>
                                {iceBreakers.length > 1 && (
                                    <button className={styles.disconnectBtn}
                                        style={{ padding: '8px 10px', marginTop: 2 }}
                                        onClick={() => setIceBreakers(iceBreakers.filter((_, j) => j !== i))}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}

                        {iceBreakers.length < 4 && (
                            <button className={styles.refreshBtn} style={{ marginBottom: 20 }}
                                onClick={() => setIceBreakers([...iceBreakers, { title: '', responseMessage: '' }])}>
                                <Plus size={13} /> Add button
                            </button>
                        )}

                        <div className={styles.configSaveRow}>
                            <button className={styles.saveBtn} onClick={handleSaveIceBreakers} disabled={ibSaving || !firstActiveAccount}>
                                <Save size={14} /> {ibSaving ? 'Saving…' : 'Save & push to Instagram'}
                            </button>
                            <button className={styles.disconnectBtn} onClick={handleClearIceBreakers} disabled={!firstActiveAccount}>
                                <Trash2 size={13} /> Clear all
                            </button>
                        </div>
                        {ibMsg && <p className={styles.saveMsg} style={{ marginTop: 10 }}>{ibMsg}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
