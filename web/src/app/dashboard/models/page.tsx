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
    const [editCommission, setEditCommission] = useState('');
    const [revenueData, setRevenueData] = useState<any>({});

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
            // Index revenue by model id
            const revMap: any = {};
            (rData.models || []).forEach((m: any) => { revMap[m.modelId] = m; });
            setRevenueData(revMap);
            setLoading(false);
        });
    };

    const openEdit = (model: any) => {
        setEditingModel(model);
        setEditCommission(model.commission?.toString() || '0');
    };

    const saveCommission = async () => {
        if (!editingModel) return;
        try {
            const res = await fetch(`/api/models/${editingModel.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commission: editCommission }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(`Error: ${data.error || 'Failed to save commission'}`);
                return;
            }
            setEditingModel(null);
            loadData();
        } catch (err) {
            alert('Network error saving commission');
        }
    };

    if (userRole !== 'ADMIN') return null;

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Models & Commission</h1>
            </header>
            <div className="main-body">
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
                        Manage net commission percentages for each model. Commission = percentage of total sales that the agency earns.
                        Revenue shown is from the current period (all-time if no period selected).
                    </p>
                </div>

                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : models.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Model</th>
                                        <th>Status</th>
                                        <th>Net Commission</th>
                                        <th>Total Sales (All-Time)</th>
                                        <th>Commission Earnings</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {models.map((m: any) => {
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
                                                        display: 'inline-block',
                                                        padding: '2px 10px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        background: m.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                        color: m.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)',
                                                    }}>
                                                        {m.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontSize: 18,
                                                        fontWeight: 700,
                                                        color: (m.commission || 0) > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                    }}>
                                                        {(m.commission || 0) > 0 ? `${m.commission}%` : 'Not set'}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                                                    ${fmt(totalSales)}
                                                </td>
                                                <td style={{
                                                    fontWeight: 700,
                                                    color: commissionEarnings > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                }}>
                                                    {comm > 0 ? `$${fmt(commissionEarnings)}` : '—'}
                                                </td>
                                                <td>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(m)}>
                                                        ✏️ Set Commission
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                                        <td></td>
                                        <td></td>
                                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                                            ${fmt(models.reduce((s, m) => s + (revenueData[m.id]?.totalSales || 0), 0))}
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                                            ${fmt(models.reduce((s, m) => {
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
                            <div className="empty-state-text">No models found. Models are created from Discord categories.</div>
                        </div>
                    )}
                </div>

                {/* Edit Commission Modal */}
                {editingModel && (
                    <div className="modal-overlay" onClick={() => setEditingModel(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                            <h3 className="modal-title">Set Commission — {editingModel.name}</h3>
                            <div className="form-group">
                                <label className="form-label">Net Commission (%)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={editCommission}
                                    onChange={e => setEditCommission(e.target.value)}
                                    placeholder="e.g. 22"
                                />
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                    This is the percentage of total sales that the agency earns from this model.
                                </p>
                            </div>

                            {/* Preview calculation */}
                            {revenueData[editingModel.id] && parseFloat(editCommission) > 0 && (
                                <div style={{
                                    background: 'rgba(139, 92, 246, 0.08)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '12px 16px',
                                    marginBottom: 16,
                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Preview (All-Time)</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                                        Total Sales: <strong style={{ color: 'var(--success)' }}>${fmt(revenueData[editingModel.id].totalSales)}</strong>
                                        {' × '}
                                        <strong>{editCommission}%</strong>
                                        {' = '}
                                        <strong style={{ color: 'var(--accent-primary)' }}>
                                            ${fmt(revenueData[editingModel.id].totalSales * (parseFloat(editCommission) / 100))}
                                        </strong>
                                    </div>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setEditingModel(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveCommission}>💾 Save Commission</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
