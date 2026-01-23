import React, { useState, useEffect } from 'react';
import { X, Mail, Clock, Plus, Trash2, Send, Save, BellRing } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface EmailSettings {
    recipients: string[];
    reportTime: string; // HH:mm
    isEnabled: boolean;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [settings, setSettings] = useState<EmailSettings>({
        recipients: [],
        reportTime: '09:00',
        isEnabled: false,
    });
    const [newEmail, setNewEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            const docRef = doc(db, 'settings', 'email');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data() as EmailSettings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'email'), settings);
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const addRecipient = () => {
        if (newEmail && !settings.recipients.includes(newEmail)) {
            setSettings({ ...settings, recipients: [...settings.recipients, newEmail] });
            setNewEmail('');
        }
    };

    const removeRecipient = (email: string) => {
        setSettings({
            ...settings,
            recipients: settings.recipients.filter((r) => r !== email),
        });
    };

    const testReport = async () => {
        if (settings.recipients.length === 0) {
            alert('Please add at least one recipient.');
            return;
        }
        setIsTesting(true);
        try {
            const response = await fetch('/api/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isTest: true }),
            });

            // Try to parse as JSON, but handle HTML error pages gracefully
            const contentType = response.headers.get('content-type');
            let data: any = null;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            }

            if (response.ok) {
                alert('Test report sent successfully!');
            } else {
                if (data) {
                    alert(`Failed to send test: ${data.error || data.message || 'Unknown error'}`);
                } else {
                    const text = await response.text();
                    console.error('Server returned an error (likely HTML):', text);
                    alert(`Server Error: Received an HTML response instead of JSON. This usually means the API route crashed or doesn't exist. Check server console.`);
                }
            }
        } catch (error) {
            console.error('Error testing report:', error);
            alert('Connection failed. Make sure the development server is running.');
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[var(--surface)] w-full max-w-md rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-[var(--border-muted)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--primary)]/10 rounded-xl">
                            <BellRing className="w-5 h-5 text-[var(--primary)]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text)]">Email Reports</h2>
                            <p className="text-xs text-[var(--text-muted)]">Automated daily task summaries</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--surface-hover)] rounded-xl transition-colors text-[var(--text-muted)]"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Toggle */}
                    <div className="flex items-center justify-between p-4 bg-[var(--primary)]/5 rounded-2xl border border-[var(--primary)]/10">
                        <div>
                            <p className="font-semibold text-sm text-[var(--text)]">Enable Daily Reports</p>
                            <p className="text-xs text-[var(--text-muted)]">Send automated emails everyday</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, isEnabled: !settings.isEnabled })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.isEnabled ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Time Picker */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                            <Clock className="w-3 h-3" /> Report Time
                        </label>
                        <input
                            type="time"
                            value={settings.reportTime}
                            onChange={(e) => setSettings({ ...settings, reportTime: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-[var(--border)] bg-[var(--card)]/50 text-sm focus:border-[var(--primary)]/50 focus:outline-none transition-all"
                        />
                        <p className="text-[10px] text-[var(--text-subtle)] px-1">
                            Note: Reports are triggered via Vercel Cron. Current setup is for 9:00 AM Bangladesh Time (BST).
                        </p>
                    </div>

                    {/* Recipients */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                            <Mail className="w-3 h-3" /> Recipients
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="email@example.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
                                className="flex-1 h-11 px-4 rounded-xl border border-[var(--border)] bg-[var(--card)]/50 text-sm focus:border-[var(--primary)]/50 focus:outline-none transition-all"
                            />
                            <button
                                onClick={addRecipient}
                                className="px-4 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary-hover)] transition-all flex items-center justify-center"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                            {settings.recipients.map((email) => (
                                <div
                                    key={email}
                                    className="flex items-center justify-between p-2.5 px-3 bg-[var(--surface-hover)] rounded-xl border border-[var(--border-muted)]"
                                >
                                    <span className="text-sm text-[var(--text)]">{email}</span>
                                    <button
                                        onClick={() => removeRecipient(email)}
                                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {settings.recipients.length === 0 && (
                                <p className="text-xs text-center text-[var(--text-subtle)] py-4">No recipients added yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-[var(--card)]/30 border-t border-[var(--border-muted)] flex gap-3">
                    <button
                        onClick={testReport}
                        disabled={isTesting}
                        className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] transition-all disabled:opacity-50"
                    >
                        {isTesting ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                        Test Now
                    </button>
                    <button
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-sm font-semibold text-white hover:bg-[var(--primary-hover)] transition-all shadow-lg shadow-[var(--primary)]/20 disabled:opacity-50"
                    >
                        {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Config
                    </button>
                </div>
            </div>
        </div>
    );
}
