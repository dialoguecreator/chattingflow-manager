'use client';

import { useState, useEffect } from 'react';

export default function SecurityPage() {
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [backupRemaining, setBackupRemaining] = useState(0);

    const [qr, setQr] = useState('');
    const [secret, setSecret] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);

    const [disablePw, setDisablePw] = useState('');

    useEffect(() => { loadStatus(); }, []);

    const loadStatus = async () => {
        const res = await fetch('/api/2fa/status');
        if (res.ok) {
            const d = await res.json();
            setEnabled(d.enabled);
            setBackupRemaining(d.backupCodesRemaining);
        }
        setLoading(false);
    };

    const startSetup = async () => {
        setError(''); setBusy(true); setBackupCodes([]);
        const res = await fetch('/api/2fa/setup', { method: 'POST' });
        if (res.ok) {
            const d = await res.json();
            setQr(d.qrDataUrl);
            setSecret(d.secret);
        } else {
            setError('Could not start setup.');
        }
        setBusy(false);
    };

    const confirmEnable = async () => {
        setError(''); setBusy(true);
        const res = await fetch('/api/2fa/enable', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: code }),
        });
        const d = await res.json();
        if (res.ok) {
            setBackupCodes(d.backupCodes);
            setQr(''); setSecret(''); setCode('');
            loadStatus();
        } else {
            setError(d.error || 'Verification failed.');
        }
        setBusy(false);
    };

    const disable2fa = async () => {
        setError(''); setBusy(true);
        const res = await fetch('/api/2fa/disable', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: disablePw }),
        });
        const d = await res.json();
        if (res.ok) {
            setDisablePw('');
            loadStatus();
        } else {
            setError(d.error || 'Could not disable.');
        }
        setBusy(false);
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">🔐 Two-Factor Authentication</h1>
            </header>
            <div className="main-body">
                <p className="text-muted" style={{ marginBottom: 20, maxWidth: 640 }}>
                    Add a second step to your login so a stolen or shared password alone can&apos;t
                    get into your account.
                </p>

                {!loading && !enabled && (
                    <div className="card" style={{ marginBottom: 16, borderColor: '#ef4444' }}>
                        <strong style={{ color: '#ef4444' }}>⚠️ Two-factor authentication is required.</strong>
                        <p className="text-muted" style={{ margin: '6px 0 0' }}>
                            You must set up 2FA below before you can use the rest of the dashboard.
                        </p>
                    </div>
                )}

                {loading ? <div className="card">Loading…</div> : (
                    <>
                        <div className="card" style={{ marginBottom: 16 }}>
                            <h3 style={{ marginTop: 0 }}>
                                Status:{' '}
                                {enabled
                                    ? <span style={{ color: '#22c55e' }}>● Enabled</span>
                                    : <span style={{ color: '#f59e0b' }}>● Not enabled</span>}
                            </h3>
                            {enabled && <p className="text-muted">Backup codes remaining: <strong>{backupRemaining}</strong></p>}
                        </div>

                        {error && (
                            <div className="card" style={{ marginBottom: 16, borderColor: '#ef4444', color: '#ef4444' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        {backupCodes.length > 0 && (
                            <div className="card" style={{ marginBottom: 16, borderColor: '#22c55e' }}>
                                <h3 style={{ marginTop: 0 }}>✅ 2FA enabled — save your backup codes</h3>
                                <p className="text-muted">
                                    Each code works once if you lose your authenticator. Store them safely —
                                    they will <strong>not</strong> be shown again.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontFamily: 'monospace', fontSize: 15, marginTop: 12 }}>
                                    {backupCodes.map((c) => (
                                        <div key={c} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>{c}</div>
                                    ))}
                                </div>
                                {/* Full navigation so the session token refreshes and the mandatory-2FA gate clears. */}
                                <a href="/dashboard" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
                                    I&apos;ve saved my codes — continue
                                </a>
                            </div>
                        )}

                        {!enabled && (
                            <div className="card" style={{ marginBottom: 16 }}>
                                {!qr ? (
                                    <>
                                        <h3 style={{ marginTop: 0 }}>Set up 2FA</h3>
                                        <p className="text-muted">
                                            You&apos;ll need an authenticator app (Google Authenticator, Authy, 1Password, etc.).
                                        </p>
                                        <button className="btn btn-primary" onClick={startSetup} disabled={busy}>
                                            {busy ? 'Working…' : 'Begin setup'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <h3 style={{ marginTop: 0 }}>1. Scan this QR code</h3>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={qr} alt="2FA QR code" width={200} height={200} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
                                        <p className="text-muted" style={{ marginTop: 10, fontSize: 13 }}>
                                            Can&apos;t scan? Enter this key manually:{' '}
                                            <code style={{ fontFamily: 'monospace' }}>{secret}</code>
                                        </p>
                                        <h3>2. Enter the 6-digit code</h3>
                                        <div className="form-group" style={{ maxWidth: 240 }}>
                                            <input
                                                className="form-input"
                                                inputMode="numeric"
                                                placeholder="123456"
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                            />
                                        </div>
                                        <button className="btn btn-primary" onClick={confirmEnable} disabled={busy || code.length < 6}>
                                            {busy ? 'Verifying…' : 'Enable 2FA'}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {enabled && (
                            <div className="card" style={{ marginBottom: 16 }}>
                                <h3 style={{ marginTop: 0 }}>Disable 2FA</h3>
                                <p className="text-muted">Confirm your password to turn 2FA off.</p>
                                <div className="form-group" style={{ maxWidth: 320 }}>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Your password"
                                        value={disablePw}
                                        onChange={(e) => setDisablePw(e.target.value)}
                                    />
                                </div>
                                <button className="btn btn-secondary" onClick={disable2fa} disabled={busy || !disablePw}>
                                    {busy ? 'Working…' : 'Disable 2FA'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
