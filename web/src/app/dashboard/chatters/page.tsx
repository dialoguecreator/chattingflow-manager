'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ChattersPage() {
    const { status } = useSession();
    const router = useRouter();
    const [chatters, setChatters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<number | null>(null);
    const [editCommission, setEditCommission] = useState('5');
    const [confirmArchive, setConfirmArchive] = useState<any | null>(null);
    const [showFired, setShowFired] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => { loadChatters(); }, []);

    const loadChatters = () => {
        fetch('/api/chatters')
            .then(r => r.json())
            .then(d => { setChatters(d.chatters || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    const saveCommission = async (userId: number) => {
        const net = parseFloat(editCommission);
        await fetch(`/api/chatters/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commissionNet: net, commissionGross: net * 0.8 }),
        });
        setEditing(null);
        loadChatters();
    };

    const archiveChatter = async (userId: number) => {
        await fetch(`/api/chatters/${userId}`, { method: 'DELETE' });
        setConfirmArchive(null);
        loadChatters();
    };

    const reactivateChatter = async (userId: number) => {
        await fetch(`/api/chatters/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACTIVE' }),
        });
        loadChatters();
    };

    const activeChatters = chatters.filter(c => (c.status || 'ACTIVE') === 'ACTIVE');
    const firedChatters = chatters.filter(c => c.status === 'FIRED');

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Chatters</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="text-sm text-muted">{activeChatters.length} active</span>
                    {firedChatters.length > 0 && (
                        <button className="btn btn-sm btn-secondary" onClick={() => setShowFired(!showFired)}>
                            {showFired ? 'Hide' : 'Show'} Fired ({firedChatters.length})
                        </button>
                    )}
                </div>
            </header>
            <div className="main-body">
                <div className="card" style={{ marginBottom: 16 }}>
                    <p className="text-sm text-muted">
                        💡 Default commission: <strong>5% net = 4% gross</strong> (OnlyFans takes 20% fee, so net × 0.8 = gross)
                    </p>
                </div>
                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : activeChatters.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Username</th>
                                        <th>Discord</th>
                                        <th>Commission (Net)</th>
                                        <th>Commission (Gross)</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeChatters.map((c: any) => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.firstName} {c.lastName}</td>
                                            <td>{c.username}</td>
                                            <td><span className="badge badge-info">{c.discordUsername || '—'}</span></td>
                                            <td>
                                                {editing === c.id ? (
                                                    <input className="form-input" type="number" step="0.1" value={editCommission}
                                                        onChange={e => setEditCommission(e.target.value)} style={{ width: 80 }} />
                                                ) : (
                                                    <span>{parseFloat(Number(c.commissionNet).toFixed(2))}%</span>
                                                )}
                                            </td>
                                            <td>{parseFloat(Number(c.commissionGross).toFixed(2))}%</td>
                                            <td>
                                                {editing === c.id ? (
                                                    <div className="flex gap-2">
                                                        <button className="btn btn-sm btn-primary" onClick={() => saveCommission(c.id)}>Save</button>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(c.id); setEditCommission(String(c.commissionNet)); }}>
                                                            ✏️ Edit
                                                        </button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmArchive(c)}>🔥 Fire</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">💬</div>
                            <div className="empty-state-text">No chatters yet. Chatters are synced from Discord when they clock in.</div>
                        </div>
                    )}
                </div>

                {/* Fired Chatters */}
                {showFired && firedChatters.length > 0 && (
                    <div className="card" style={{ marginTop: 16 }}>
                        <h3 style={{ margin: '0 0 12px', fontWeight: 600, color: 'var(--text-primary)' }}>🔥 Fired Chatters</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Username</th>
                                        <th>Discord</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {firedChatters.map((c: any) => (
                                        <tr key={c.id} style={{ opacity: 0.7 }}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.firstName} {c.lastName}</td>
                                            <td>{c.username}</td>
                                            <td><span className="badge badge-info">{c.discordUsername || '—'}</span></td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                                                    background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)',
                                                }}>FIRED</span>
                                            </td>
                                            <td>
                                                <button className="btn btn-sm btn-primary" onClick={() => reactivateChatter(c.id)}>
                                                    ♻️ Reactivate
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Archive Confirm Modal */}
                {confirmArchive && (
                    <div className="modal-overlay" onClick={() => setConfirmArchive(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                            <h3 className="modal-title">🔥 Fire Chatter</h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 8px' }}>
                                Are you sure you want to fire <strong style={{ color: 'var(--text-primary)' }}>{confirmArchive.firstName} {confirmArchive.lastName}</strong>?
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
                                This will archive the chatter. Their invoices, shifts, and payout data will be preserved. You can reactivate them later.
                            </p>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setConfirmArchive(null)}>Cancel</button>
                                <button className="btn btn-danger" onClick={() => archiveChatter(confirmArchive.id)}>🔥 Fire</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
