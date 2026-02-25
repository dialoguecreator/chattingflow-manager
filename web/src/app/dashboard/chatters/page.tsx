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

    const deleteChatter = async (userId: number) => {
        if (!confirm('Are you sure? This will delete the chatter and ALL their data (invoices, shifts, etc).')) return;
        await fetch(`/api/chatters/${userId}`, { method: 'DELETE' });
        loadChatters();
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Chatters</h1>
                <span className="text-sm text-muted">{chatters.length} chatters</span>
            </header>
            <div className="main-body">
                <div className="card" style={{ marginBottom: 16 }}>
                    <p className="text-sm text-muted">
                        💡 Default commission: <strong>5% net = 4% gross</strong> (OnlyFans takes 20% fee, so net × 0.8 = gross)
                    </p>
                </div>
                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : chatters.length > 0 ? (
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
                                    {chatters.map((c: any) => (
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
                                                        <button className="btn btn-sm btn-danger" onClick={() => deleteChatter(c.id)}>🗑️</button>
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
            </div>
        </>
    );
}
