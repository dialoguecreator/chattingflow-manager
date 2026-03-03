'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const TIMEZONES = [
    { value: 'UTC', label: 'UTC', desc: 'Coordinated Universal Time' },
    { value: 'Europe/Belgrade', label: 'CET (Belgrade)', desc: 'UTC+1 · Central European Time' },
    { value: 'Europe/London', label: 'GMT (London)', desc: 'UTC+0 · Greenwich Mean Time' },
    { value: 'Europe/Berlin', label: 'CET (Berlin)', desc: 'UTC+1 · Central European Time' },
    { value: 'Europe/Paris', label: 'CET (Paris)', desc: 'UTC+1 · Central European Time' },
    { value: 'Europe/Bucharest', label: 'EET (Bucharest)', desc: 'UTC+2 · Eastern European Time' },
    { value: 'Europe/Istanbul', label: 'TRT (Istanbul)', desc: 'UTC+3 · Turkey Time' },
    { value: 'Europe/Moscow', label: 'MSK (Moscow)', desc: 'UTC+3 · Moscow Standard Time' },
    { value: 'America/New_York', label: 'EST (New York)', desc: 'UTC-5 · Eastern Standard Time' },
    { value: 'America/Chicago', label: 'CST (Chicago)', desc: 'UTC-6 · Central Standard Time' },
    { value: 'America/Denver', label: 'MST (Denver)', desc: 'UTC-7 · Mountain Standard Time' },
    { value: 'America/Los_Angeles', label: 'PST (Los Angeles)', desc: 'UTC-8 · Pacific Standard Time' },
    { value: 'Asia/Dubai', label: 'GST (Dubai)', desc: 'UTC+4 · Gulf Standard Time' },
    { value: 'Asia/Kolkata', label: 'IST (Kolkata)', desc: 'UTC+5:30 · India Standard Time' },
    { value: 'Asia/Tokyo', label: 'JST (Tokyo)', desc: 'UTC+9 · Japan Standard Time' },
    { value: 'Australia/Sydney', label: 'AEST (Sydney)', desc: 'UTC+10 · Australian Eastern Time' },
];

function getCurrentTimeInTz(tz: string): string {
    try {
        return new Date().toLocaleTimeString('en-US', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
    } catch {
        return '--:--:--';
    }
}

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [timezone, setTimezone] = useState('UTC');
    const [savedTimezone, setSavedTimezone] = useState('UTC');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [currentTime, setCurrentTime] = useState('');

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
                if (d.settings?.timezone) {
                    setTimezone(d.settings.timezone);
                    setSavedTimezone(d.settings.timezone);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Live clock
    useEffect(() => {
        setCurrentTime(getCurrentTimeInTz(timezone));
        const interval = setInterval(() => {
            setCurrentTime(getCurrentTimeInTz(timezone));
        }, 1000);
        return () => clearInterval(interval);
    }, [timezone]);

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
                setSavedTimezone(timezone);
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

    const hasChanges = timezone !== savedTimezone;
    const selectedTz = TIMEZONES.find(tz => tz.value === timezone);

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Settings</h1>
            </header>
            <div className="main-body">
                {/* Timezone Setting */}
                <div className="card" style={{ maxWidth: 640 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 'var(--radius-md)',
                                    background: 'var(--accent-gradient)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', fontSize: 18,
                                    boxShadow: 'var(--accent-glow)',
                                }}>🌍</div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                    Timezone
                                </h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, paddingLeft: 46 }}>
                                Used when manually adding shifts and displaying dates.
                            </p>
                        </div>

                        {/* Live clock preview */}
                        <div style={{
                            background: 'var(--bg-glass)', border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)', padding: '10px 16px', textAlign: 'center',
                            minWidth: 140,
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 4 }}>
                                Current Time
                            </div>
                            <div style={{
                                fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
                                background: 'var(--accent-gradient)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                {currentTime}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <p className="text-muted">Loading...</p>
                    ) : (
                        <>
                            {/* Timezone grid selector */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: 8, marginBottom: 20, maxHeight: 280, overflowY: 'auto',
                                padding: '2px',
                            }}>
                                {TIMEZONES.map(tz => {
                                    const isSelected = timezone === tz.value;
                                    return (
                                        <button
                                            key={tz.value}
                                            onClick={() => setTimezone(tz.value)}
                                            style={{
                                                background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-glass)',
                                                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                                                borderRadius: 'var(--radius-md)',
                                                padding: '12px 14px',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 150ms ease',
                                                outline: isSelected ? '1px solid var(--accent-primary)' : 'none',
                                            }}
                                            onMouseEnter={e => {
                                                if (!isSelected) {
                                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)';
                                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isSelected) {
                                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-primary)';
                                                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                                }
                                            }}
                                        >
                                            <div style={{
                                                fontSize: 13, fontWeight: 600,
                                                color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                marginBottom: 2,
                                            }}>
                                                {tz.label}
                                            </div>
                                            <div style={{
                                                fontSize: 11, color: 'var(--text-muted)',
                                            }}>
                                                {tz.desc}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Action bar */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px 0 0',
                                borderTop: '1px solid var(--border-primary)',
                            }}>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    {hasChanges ? (
                                        <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                                            ⚠️ Unsaved changes
                                        </span>
                                    ) : selectedTz ? (
                                        <span>Active: <strong style={{ color: 'var(--text-primary)' }}>{selectedTz.label}</strong></span>
                                    ) : null}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {saved && (
                                        <span style={{
                                            color: 'var(--success)', fontSize: 13, fontWeight: 600,
                                            animation: 'fadeIn 200ms ease',
                                        }}>
                                            ✅ Saved
                                        </span>
                                    )}
                                    <button
                                        className="btn btn-primary"
                                        onClick={saveTimezone}
                                        disabled={saving || !hasChanges}
                                        style={{
                                            opacity: hasChanges ? 1 : 0.5,
                                            cursor: hasChanges ? 'pointer' : 'not-allowed',
                                        }}
                                    >
                                        {saving ? '⏳ Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
