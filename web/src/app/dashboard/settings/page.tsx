'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const TIMEZONES = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'Europe/Belgrade', label: 'Europe/Belgrade (CET, UTC+1)' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, UTC+1)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET, UTC+1)' },
    { value: 'Europe/Bucharest', label: 'Europe/Bucharest (EET, UTC+2)' },
    { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT, UTC+3)' },
    { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK, UTC+3)' },
    { value: 'America/New_York', label: 'America/New_York (EST, UTC-5)' },
    { value: 'America/Chicago', label: 'America/Chicago (CST, UTC-6)' },
    { value: 'America/Denver', label: 'America/Denver (MST, UTC-7)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST, UTC-8)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10)' },
];

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [timezone, setTimezone] = useState('UTC');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const userRole = (session?.user as any)?.role || '';
    const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER';

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && !isAdminOrManager) router.push('/dashboard');
    }, [status, isAdminOrManager, router]);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(d => {
                if (d.settings?.timezone) setTimezone(d.settings.timezone);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const saveTimezone = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'timezone', value: timezone }),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to save');
            }
        } catch {
            alert('Network error');
        }
        setSaving(false);
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Settings</h1>
            </header>
            <div className="main-body">
                <div className="card" style={{ maxWidth: 600 }}>
                    <h3 style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        🌍 Timezone
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 20px' }}>
                        Set the timezone used when manually adding shifts and displaying dates across the CRM.
                    </p>

                    {loading ? (
                        <p className="text-muted">Loading...</p>
                    ) : (
                        <>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                    CRM Timezone
                                </label>
                                <select
                                    className="form-input"
                                    value={timezone}
                                    onChange={e => setTimezone(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
                                >
                                    {TIMEZONES.map(tz => (
                                        <option key={tz.value} value={tz.value}>
                                            {tz.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={saveTimezone}
                                    disabled={saving}
                                >
                                    {saving ? '⏳ Saving...' : '💾 Save Timezone'}
                                </button>
                                {saved && (
                                    <span style={{ color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>
                                        ✅ Saved!
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
