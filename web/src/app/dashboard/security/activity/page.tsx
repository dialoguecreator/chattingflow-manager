'use client';

import { useState, useEffect } from 'react';

interface Device {
    email: string;
    role: string | null;
    ipAddress: string;
    userAgent: string;
    successCount: number;
    lastSeen: string;
    firstSeen: string;
}
interface Attempt {
    id: number;
    email: string;
    success: boolean;
    reason: string | null;
    ipAddress: string;
    userAgent: string;
    createdAt: string;
    role: string | null;
}

// Turn a raw user-agent into something readable at a glance.
function deviceLabel(ua: string): string {
    if (!ua || ua === 'unknown') return 'Unknown device';
    const os = /Windows/.test(ua) ? 'Windows'
        : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
        : /Android/.test(ua) ? 'Android'
        : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
        : /Linux/.test(ua) ? 'Linux' : 'Other OS';
    const browser = /Edg\//.test(ua) ? 'Edge'
        : /Chrome\//.test(ua) ? 'Chrome'
        : /Firefox\//.test(ua) ? 'Firefox'
        : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return `${browser} on ${os}`;
}

export default function LoginActivityPage() {
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [devices, setDevices] = useState<Device[]>([]);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [tab, setTab] = useState<'devices' | 'attempts'>('devices');

    useEffect(() => { load(); }, []);

    const load = async () => {
        const res = await fetch('/api/security/logins');
        if (res.status === 403 || res.status === 401) { setForbidden(true); setLoading(false); return; }
        if (res.ok) {
            const d = await res.json();
            setDevices(d.devices);
            setAttempts(d.recentAttempts);
        }
        setLoading(false);
    };

    const fmt = (s: string) => new Date(s).toLocaleString();

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">🛰️ Login Activity</h1>
            </header>
            <div className="main-body">
                {loading ? <div className="card">Loading…</div> : forbidden ? (
                    <div className="card">You don&apos;t have permission to view this page.</div>
                ) : (
                    <>
                        <div className="card" style={{ marginBottom: 16, borderColor: '#f59e0b' }}>
                            <p style={{ margin: 0, fontSize: 13 }}>
                                ⓘ This only shows activity recorded <strong>after</strong> login logging was turned on.
                                Logins from before that point were never stored and cannot be shown.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <button className={`btn btn-sm ${tab === 'devices' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('devices')}>
                                Devices &amp; IPs ({devices.length})
                            </button>
                            <button className={`btn btn-sm ${tab === 'attempts' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('attempts')}>
                                All attempts ({attempts.length})
                            </button>
                        </div>

                        {tab === 'devices' && (
                            devices.length === 0 ? (
                                <div className="card">No successful logins recorded yet.</div>
                            ) : (
                                <div className="card" style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                                <th style={{ padding: '8px' }}>Account</th>
                                                <th style={{ padding: '8px' }}>Role</th>
                                                <th style={{ padding: '8px' }}>Device</th>
                                                <th style={{ padding: '8px' }}>IP address</th>
                                                <th style={{ padding: '8px' }}>Logins</th>
                                                <th style={{ padding: '8px' }}>First seen</th>
                                                <th style={{ padding: '8px' }}>Last seen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {devices.map((d, i) => (
                                                <tr key={i} style={{ borderTop: '1px solid var(--border-primary)' }}>
                                                    <td style={{ padding: '8px' }}><strong>{d.email}</strong></td>
                                                    <td style={{ padding: '8px' }}>{d.role || '—'}</td>
                                                    <td style={{ padding: '8px' }} title={d.userAgent}>{deviceLabel(d.userAgent)}</td>
                                                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{d.ipAddress}</td>
                                                    <td style={{ padding: '8px' }}>{d.successCount}</td>
                                                    <td style={{ padding: '8px' }}>{fmt(d.firstSeen)}</td>
                                                    <td style={{ padding: '8px' }}>{fmt(d.lastSeen)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}

                        {tab === 'attempts' && (
                            attempts.length === 0 ? (
                                <div className="card">No login attempts recorded yet.</div>
                            ) : (
                                <div className="card" style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                                                <th style={{ padding: '8px' }}>When</th>
                                                <th style={{ padding: '8px' }}>Account</th>
                                                <th style={{ padding: '8px' }}>Result</th>
                                                <th style={{ padding: '8px' }}>Reason</th>
                                                <th style={{ padding: '8px' }}>IP address</th>
                                                <th style={{ padding: '8px' }}>Device</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attempts.map((a) => (
                                                <tr key={a.id} style={{ borderTop: '1px solid var(--border-primary)' }}>
                                                    <td style={{ padding: '8px' }}>{fmt(a.createdAt)}</td>
                                                    <td style={{ padding: '8px' }}>{a.email}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        {a.success
                                                            ? <span style={{ color: '#22c55e' }}>✓ Success</span>
                                                            : <span style={{ color: '#ef4444' }}>✗ Failed</span>}
                                                    </td>
                                                    <td style={{ padding: '8px', fontSize: 12, color: 'var(--text-secondary)' }}>{a.reason || '—'}</td>
                                                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{a.ipAddress}</td>
                                                    <td style={{ padding: '8px' }} title={a.userAgent}>{deviceLabel(a.userAgent)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>
        </>
    );
}
