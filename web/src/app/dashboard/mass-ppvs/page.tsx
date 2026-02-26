'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function MassPPVsPage() {
    const { status } = useSession();
    const router = useRouter();
    const [ppvs, setPPVs] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ sentById: '', modelId: '', price: '', buyerCount: '', description: '' });
    const [editingPPV, setEditingPPV] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ price: '', buyerCount: '', description: '' });
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
    useEffect(() => { loadData(); }, []);

    const loadData = () => {
        Promise.all([
            fetch('/api/mass-ppvs').then(r => r.json()),
            fetch('/api/models').then(r => r.json()),
            fetch('/api/staff').then(r => r.json()),
        ]).then(([ppvData, modelData, staffData]) => {
            setPPVs(ppvData.massPPVs || []);
            setModels(modelData.models || []);
            setStaffList(staffData.staff || []);
            setLoading(false);
        });
    };

    const addMassPPV = async () => {
        await fetch('/api/mass-ppvs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setShowAdd(false);
        setForm({ sentById: '', modelId: '', price: '', buyerCount: '', description: '' });
        loadData();
    };

    const openEdit = (p: any) => {
        setEditingPPV(p);
        setEditForm({
            price: p.price?.toString() || '',
            buyerCount: p.buyerCount?.toString() || '',
            description: p.description || '',
        });
    };

    const saveEdit = async () => {
        if (!editingPPV) return;
        await fetch(`/api/mass-ppvs/${editingPPV.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editForm),
        });
        setEditingPPV(null);
        loadData();
    };

    const deletePPV = async (id: number) => {
        await fetch(`/api/mass-ppvs/${id}`, { method: 'DELETE' });
        setConfirmDelete(null);
        loadData();
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Mass PPVs</h1>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Mass PPV</button>
            </header>
            <div className="main-body">
                <div className="card" style={{ marginBottom: 16 }}>
                    <p className="text-sm text-muted">
                        💡 Commission: <strong>6% net = 4.8% gross</strong> (net × 0.8 = gross). Commission is auto-calculated and added to the sender's payout.
                    </p>
                </div>
                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : ppvs.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Sent By</th>
                                        <th>Model</th>
                                        <th>Price</th>
                                        <th>Buyers</th>
                                        <th>Total Sales</th>
                                        <th>Commission</th>
                                        <th>Description</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ppvs.map((p: any) => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>{p.sentBy?.firstName} {p.sentBy?.lastName}</td>
                                            <td><span className="badge badge-primary">{p.model?.name}</span></td>
                                            <td>${p.price?.toFixed(2)}</td>
                                            <td>{p.buyerCount}</td>
                                            <td style={{ color: 'var(--success)', fontWeight: 700 }}>${p.totalSales?.toFixed(2)}</td>
                                            <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>${p.commissionAmount?.toFixed(2)}</td>
                                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '—'}</td>
                                            <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)}>✏️</button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(p.id)}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📨</div>
                            <div className="empty-state-text">No mass PPVs recorded yet.</div>
                        </div>
                    )}
                </div>

                {/* Add Mass PPV Modal */}
                {showAdd && (
                    <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <h3 className="modal-title">Record Mass PPV</h3>
                            <div className="form-group">
                                <label className="form-label">Sent By</label>
                                <select className="form-select" value={form.sentById} onChange={e => setForm({ ...form, sentById: e.target.value })}>
                                    <option value="">Select person...</option>
                                    {staffList.map((s: any) => <option key={s.user?.id || s.id} value={s.userId}>{s.user?.firstName} {s.user?.lastName} — {s.position}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Model</label>
                                <select className="form-select" value={form.modelId} onChange={e => setForm({ ...form, modelId: e.target.value })}>
                                    <option value="">Select model...</option>
                                    {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">PPV Price ($)</label>
                                <input className="form-input" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Number of Buyers</label>
                                <input className="form-input" type="number" value={form.buyerCount} onChange={e => setForm({ ...form, buyerCount: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="PPV content description..." />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={addMassPPV}>Add Mass PPV</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Mass PPV Modal */}
                {editingPPV && (
                    <div className="modal-overlay" onClick={() => setEditingPPV(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <h3 className="modal-title">Edit Mass PPV</h3>
                            <div className="form-group">
                                <label className="form-label">PPV Price ($)</label>
                                <input className="form-input" type="number" step="0.01" value={editForm.price} onChange={e => setEditForm({ ...editForm, price: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Number of Buyers</label>
                                <input className="form-input" type="number" value={editForm.buyerCount} onChange={e => setEditForm({ ...editForm, buyerCount: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="PPV content description..." />
                            </div>
                            {parseFloat(editForm.price) > 0 && parseInt(editForm.buyerCount) > 0 && (
                                <div style={{
                                    background: 'rgba(139, 92, 246, 0.08)', borderRadius: 'var(--radius-md)',
                                    padding: '12px 16px', marginBottom: 16, border: '1px solid rgba(139, 92, 246, 0.2)',
                                }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Preview</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                                        Total Sales: <strong style={{ color: 'var(--success)' }}>${(parseFloat(editForm.price) * parseInt(editForm.buyerCount)).toFixed(2)}</strong>
                                        {' · '}Commission: <strong style={{ color: 'var(--accent-primary)' }}>${(parseFloat(editForm.price) * parseInt(editForm.buyerCount) * 0.048).toFixed(2)}</strong>
                                    </div>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setEditingPPV(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveEdit}>💾 Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirm Modal */}
                {confirmDelete !== null && (
                    <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                            <h3 className="modal-title">Delete Mass PPV</h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
                                Are you sure you want to delete this mass PPV record? This action cannot be undone.
                            </p>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="btn btn-danger" onClick={() => deletePPV(confirmDelete)}>🗑️ Delete</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
