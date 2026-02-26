'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function fmt(n: number) { return n.toFixed(2); }

export default function ModelsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingModel, setEditingModel] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ name: '', commission: '' });
    const [revenueData, setRevenueData] = useState<any>({});
    const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
    const [confirmArchive, setConfirmArchive] = useState<any | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const userRole = (session?.user as any)?.role || '';

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && userRole !== 'ADMIN') router.push('/dashboard');
    }, [status, userRole, router]);

    useEffect(() => { loadData(); }, []);

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/models').then(r => r.json()),
            fetch('/api/revenue').then(r => r.json()).catch(() => ({ models: [] })),
        ]).then(([mData, rData]) => {
            setModels(mData.models || []);
            const revMap: any = {};
            (rData.models || []).forEach((m: any) => { revMap[m.modelId] = m; });
            setRevenueData(revMap);
            setLoading(false);
        });
    };

    const openEdit = (model: any) => {
        setEditingModel(model);
        setEditForm({
            name: model.name || '',
            commission: model.commission?.toString() || '0',
        });
    };

    const saveEdit = async () => {
        if (!editingModel) return;
        try {
            const res = await fetch(`/api/models/${editingModel.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editForm.name, commission: editForm.commission }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed'}`);
                return;
            }
            setEditingModel(null);
            loadData();
        } catch { alert('Network error'); }
    };

    const archiveModel = async (id: number) => {
        await fetch(`/api/models/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ARCHIVED' }),
        });
        setConfirmArchive(null);
        loadData();
    };

    const reactivateModel = async (id: number) => {
        await fetch(`/api/models/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACTIVE' }),
        });
        loadData();
    };

    const deleteModel = async (id: number) => {
        const res = await fetch(`/api/models/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            alert(`Error: ${data.error || 'Failed to delete'}`);
        }
        setConfirmDelete(null);
        loadData();
    };

    if (userRole !== 'ADMIN') return null;

    const activeModels = models.filter(m => m.status === 'ACTIVE');
    const archivedModels = models.filter(m => m.status === 'ARCHIVED');

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Models & Commission</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="text-sm text-muted">{activeModels.length} active</span>
                    {archivedModels.length > 0 && (
                        <button className="btn btn-sm btn-secondary" onClick={() => setShowArchived(!showArchived)}>
                            {showArchived ? 'Hide' : 'Show'} Archived ({archivedModels.length})
                        </button>
                    )}
                </div>
            </header>
            <div className="main-body">
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
                        Manage net commission percentages for each model. Commission = percentage of total sales that the agency earns.
                    </p>
                </div>

                {/* Active Models */}
                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : activeModels.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Model</th>
                                        <th>Net Commission</th>
                                        <th>Total Sales (All-Time)</th>
                                        <th>Commission Earnings</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeModels.map((m: any) => {
                                        const rev = revenueData[m.id];
                                        const totalSales = rev?.totalSales || 0;
                                        const comm = m.commission || 0;
                                        const commissionEarnings = totalSales * (comm / 100);
                                        return (
                                            <tr key={m.id}>
                                                <td>
                                                    <span className="badge badge-primary" style={{ fontSize: 14 }}>{m.name}</span>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontSize: 18, fontWeight: 700,
                                                        color: comm > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                    }}>
                                                        {comm > 0 ? `${comm}%` : 'Not set'}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--success)', fontWeight: 600 }}>${fmt(totalSales)}</td>
                                                <td style={{ fontWeight: 700, color: commissionEarnings > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                                    {comm > 0 ? `$${fmt(commissionEarnings)}` : '—'}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(m)}>✏️ Edit</button>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => setConfirmArchive(m)} style={{ opacity: 0.8 }}>📦 Archive</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(m)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                                        <td></td>
                                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                                            ${fmt(activeModels.reduce((s, m) => s + (revenueData[m.id]?.totalSales || 0), 0))}
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                                            ${fmt(activeModels.reduce((s, m) => {
                                                const rev = revenueData[m.id];
                                                return s + ((rev?.totalSales || 0) * ((m.commission || 0) / 100));
                                            }, 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">🏷️</div>
                            <div className="empty-state-text">No active models. Models are created from Discord with /addmodel.</div>
                        </div>
                    )}
                </div>

                {/* Archived Models */}
                {showArchived && archivedModels.length > 0 && (
                    <div className="card" style={{ marginTop: 16 }}>
                        <h3 style={{ margin: '0 0 12px', fontWeight: 600, color: 'var(--text-primary)' }}>📦 Archived Models</h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Model</th>
                                        <th>Commission</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {archivedModels.map((m: any) => (
                                        <tr key={m.id} style={{ opacity: 0.7 }}>
                                            <td><span className="badge badge-primary" style={{ fontSize: 14 }}>{m.name}</span></td>
                                            <td>{(m.commission || 0) > 0 ? `${m.commission}%` : 'Not set'}</td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                                                    background: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af',
                                                }}>ARCHIVED</span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-sm btn-primary" onClick={() => reactivateModel(m.id)}>♻️ Reactivate</button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(m)}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Edit Model Modal */}
                {editingModel && (
                    <div className="modal-overlay" onClick={() => setEditingModel(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                            <h3 className="modal-title">Edit Model — {editingModel.name}</h3>
                            <div className="form-group">
                                <label className="form-label">Model Name</label>
                                <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Net Commission (%)</label>
                                <input className="form-input" type="number" step="0.1" min="0" max="100"
                                    value={editForm.commission} onChange={e => setEditForm({ ...editForm, commission: e.target.value })} placeholder="e.g. 22" />
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                    Percentage of total sales that the agency earns from this model.
                                </p>
                            </div>
                            {revenueData[editingModel.id] && parseFloat(editForm.commission) > 0 && (
                                <div style={{
                                    background: 'rgba(139, 92, 246, 0.08)', borderRadius: 'var(--radius-md)',
                                    padding: '12px 16px', marginBottom: 16, border: '1px solid rgba(139, 92, 246, 0.2)',
                                }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Preview (All-Time)</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                                        Total Sales: <strong style={{ color: 'var(--success)' }}>${fmt(revenueData[editingModel.id].totalSales)}</strong>
                                        {' × '}<strong>{editForm.commission}%</strong>{' = '}
                                        <strong style={{ color: 'var(--accent-primary)' }}>
                                            ${fmt(revenueData[editingModel.id].totalSales * (parseFloat(editForm.commission) / 100))}
                                        </strong>
                                    </div>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setEditingModel(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveEdit}>💾 Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Archive Confirm Modal */}
                {confirmArchive && (
                    <div className="modal-overlay" onClick={() => setConfirmArchive(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                            <h3 className="modal-title">📦 Archive Model</h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 8px' }}>
                                Are you sure you want to archive <strong style={{ color: 'var(--text-primary)' }}>{confirmArchive.name}</strong>?
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px' }}>
                                The model will be hidden from active lists but all data (invoices, shifts, revenue) will be preserved. You can reactivate it later.
                            </p>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setConfirmArchive(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={() => archiveModel(confirmArchive.id)}>📦 Archive</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirm Modal */}
                {confirmDelete && (
                    <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                            <h3 className="modal-title">🗑️ Delete Model</h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 8px' }}>
                                Are you sure you want to <strong style={{ color: 'var(--danger)' }}>permanently delete</strong> <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.name}</strong>?
                            </p>
                            <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 24px' }}>
                                ⚠️ This will fail if the model has related invoices or shifts. Archive instead if you want to keep the data.
                            </p>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="btn btn-danger" onClick={() => deleteModel(confirmDelete.id)}>🗑️ Delete Forever</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
