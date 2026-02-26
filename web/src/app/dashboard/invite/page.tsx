'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function InvitePage() {
    const { status } = useSession();
    const router = useRouter();
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatedLink, setGeneratedLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [inviteRole, setInviteRole] = useState('CHATTER');

    useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
    useEffect(() => { loadInvites(); }, []);

    const loadInvites = () => {
        fetch('/api/invite').then(r => r.json()).then(d => { setInvites(d.invites || []); setLoading(false); }).catch(() => setLoading(false));
    };

    const generateInvite = async () => {
        const res = await fetch('/api/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: inviteRole }),
        });
        const data = await res.json();
        const link = `${window.location.origin}/register?token=${data.token}`;
        setGeneratedLink(link);
        loadInvites();
    };

    const copyLink = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const togglePause = async (id: number, paused: boolean) => {
        await fetch(`/api/invite/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paused: !paused }),
        });
        loadInvites();
    };

    const deleteInvite = async (id: number) => {
        if (!confirm('Are you sure you want to delete this invite link?')) return;
        await fetch(`/api/invite/${id}`, { method: 'DELETE' });
        loadInvites();
    };

    const getStatus = (inv: any): { label: string; badge: string } => {
        if (inv.usedBy) return { label: 'Used', badge: 'badge-success' };
        if (inv.paused) return { label: 'Paused', badge: 'badge-danger' };
        return { label: 'Pending', badge: 'badge-warning' };
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Invite Member</h1>
            </header>
            <div className="main-body">
                <div className="card" style={{ marginBottom: 20 }}>
                    <h2 className="card-title" style={{ marginBottom: 16 }}>Generate Invite Link</h2>
                    <p className="text-sm text-muted" style={{ marginBottom: 20 }}>
                        Generate a one-time invite link. The recipient can use it to create an account and access the CRM.
                    </p>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                        <span className="text-sm" style={{ fontWeight: 600 }}>Role:</span>
                        <button
                            className={`btn btn-sm ${inviteRole === 'CHATTER' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setInviteRole('CHATTER')}
                        >💬 Chatter</button>
                        <button
                            className={`btn btn-sm ${inviteRole === 'STAFF' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setInviteRole('STAFF')}
                        >👔 Staff</button>
                    </div>
                    <button className="btn btn-primary" onClick={generateInvite}>🔗 Generate New Invite Link</button>

                    {generatedLink && (
                        <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)' }}>
                            <div className="text-sm text-muted" style={{ marginBottom: 8 }}>Share this link:</div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <input className="form-input" value={generatedLink} readOnly style={{ flex: 1 }} />
                                <button className="btn btn-secondary btn-sm" onClick={copyLink}>
                                    {copied ? '✅ Copied!' : '📋 Copy'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Previous Invites</h2>
                    </div>
                    {loading ? <p className="text-muted">Loading...</p> : invites.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Token</th><th>Role</th><th>Created</th><th>Status</th><th>Used By</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {invites.map((inv: any) => {
                                        const st = getStatus(inv);
                                        return (
                                            <tr key={inv.id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.token.slice(0, 16)}...</td>
                                                <td><span className={`badge ${inv.role === 'STAFF' ? 'badge-primary' : 'badge-warning'}`}>{inv.role || 'CHATTER'}</span></td>
                                                <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                                                <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                                                <td>{inv.usedBy || '—'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        {!inv.usedBy && (
                                                            <button
                                                                className={`btn btn-sm ${inv.paused ? 'btn-primary' : 'btn-secondary'}`}
                                                                onClick={() => togglePause(inv.id, inv.paused)}
                                                            >
                                                                {inv.paused ? '▶️ Resume' : '⏸️ Pause'}
                                                            </button>
                                                        )}
                                                        <button className="btn btn-sm btn-danger" onClick={() => deleteInvite(inv.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">🔗</div>
                            <div className="empty-state-text">No invites generated yet.</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
