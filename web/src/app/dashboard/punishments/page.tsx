'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function PunishmentsPage() {
    const { status } = useSession();
    const router = useRouter();
    const [punishments, setPunishments] = useState<any[]>([]);
    const [chatters, setChatters] = useState<any[]>([]);
    const [periods, setPeriods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ userId: '', amount: '', reason: '', payoutPeriodId: '' });

    useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
    useEffect(() => { loadData(); }, []);

    const loadData = () => {
        Promise.all([
            fetch('/api/punishments').then(r => r.json()),
            fetch('/api/chatters').then(r => r.json()),
            fetch('/api/payouts').then(r => r.json()),
        ]).then(([pData, cData, perData]) => {
            setPunishments(pData.punishments || []);
            setChatters(cData.chatters || []);
            setPeriods(perData.periods || []);
            setLoading(false);
        });
    };

    const fmtDate = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const addPunishment = async () => {
        await fetch('/api/punishments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setShowAdd(false);
        setForm({ userId: '', amount: '', reason: '', payoutPeriodId: '' });
        loadData();
    };

    const toggleRevoke = async (id: number, revoked: boolean) => {
        await fetch(`/api/punishments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revoked: !revoked }),
        });
        setPunishments(prev => prev.map(p => p.id === id ? { ...p, revoked: !revoked } : p));
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Punishments</h1>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Punishment</button>
            </header>
            <div className="main-body">
                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : punishments.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Chatter</th><th>Amount</th><th>Reason</th><th>Period</th><th>Date</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {punishments.map((p: any) => (
                                        <tr key={p.id} style={p.revoked ? { textDecoration: 'line-through', opacity: 0.45 } : {}}>
                                            <td style={{ fontWeight: 600 }}>{p.user?.firstName} {p.user?.lastName}</td>
                                            <td style={{ color: 'var(--danger)', fontWeight: 700 }}>-${p.amount?.toFixed(2)}</td>
                                            <td>{p.reason}</td>
                                            <td>
                                                {p.payoutPeriod ? (
                                                    <span className="badge badge-info">
                                                        #{p.payoutPeriod.id} ({fmtDate(p.payoutPeriod.startDate)} – {fmtDate(p.payoutPeriod.endDate)})
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-warning">No period</span>
                                                )}
                                            </td>
                                            <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <button
                                                    className={`btn btn-sm ${p.revoked ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => toggleRevoke(p.id, p.revoked)}
                                                >
                                                    {p.revoked ? '↩️ Restore' : '🚫 Revoke'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">⚖️</div>
                            <div className="empty-state-text">No punishments recorded.</div>
                        </div>
                    )}
                </div>

                {showAdd && (
                    <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <h3 className="modal-title">Add Punishment</h3>
                            <div className="form-group">
                                <label className="form-label">Chatter</label>
                                <select className="form-select" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })}>
                                    <option value="">Select chatter...</option>
                                    {chatters.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Payout Period</label>
                                <select className="form-select" value={form.payoutPeriodId} onChange={e => setForm({ ...form, payoutPeriodId: e.target.value })}>
                                    <option value="">Auto (active period)</option>
                                    {periods.map((p: any) => (
                                        <option key={p.id} value={p.id}>
                                            #{p.id} — {fmtDate(p.startDate)} → {fmtDate(p.endDate)} {p.status === 'ACTIVE' ? '(Active)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Amount ($)</label>
                                <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Reason</label>
                                <textarea className="form-textarea" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button className="btn btn-danger" onClick={addPunishment}>Add Punishment</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
