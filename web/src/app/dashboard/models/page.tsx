'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function fmt(n: number) { return n.toFixed(2); }

const CLIENT_PERIODS = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '14d', label: 'Last 14 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom' },
];

function getPeriodDates(period: string, customFrom?: string, customTo?: string) {
    if (period === 'custom' && customFrom && customTo) {
        return { startDate: customFrom, endDate: customTo };
    }
    const now = new Date();
    const ms: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '14d': 14 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const diff = ms[period] || ms['7d'];
    const from = new Date(now.getTime() - diff);
    return { startDate: from.toISOString(), endDate: now.toISOString() };
}

function getWeekPeriod(date: Date = new Date()) {
    // Week = Monday 00:00 to Sunday 23:59
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
}

export default function ModelsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingModel, setEditingModel] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ name: '', commission: '', clientName: '' });
    const [revenueData, setRevenueData] = useState<any>({});
    const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
    const [confirmArchive, setConfirmArchive] = useState<any | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [showAddModel, setShowAddModel] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [addError, setAddError] = useState('');

    // Client section state
    const [clientPeriod, setClientPeriod] = useState('7d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [clientSummary, setClientSummary] = useState<any[]>([]);
    const [clientPayments, setClientPayments] = useState<Record<string, boolean>>({});
    const [clientSummaryLoading, setClientSummaryLoading] = useState(false);

    // Inline client name editing
    const [editingClientId, setEditingClientId] = useState<number | null>(null);
    const [editingClientValue, setEditingClientValue] = useState('');

    // Payment records (ledger)
    const [paymentRecords, setPaymentRecords] = useState<any[]>([]);
    const [paymentRecordsLoading, setPaymentRecordsLoading] = useState(false);
    const [showAddPayment, setShowAddPayment] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        clientName: '', amount: '', periodFrom: '', periodTo: '', receivedAt: '', note: '',
    });
    const [paymentFormError, setPaymentFormError] = useState('');

    const userRole = (session?.user as any)?.role || '';

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && userRole !== 'ADMIN') router.push('/dashboard');
    }, [status, userRole, router]);

    useEffect(() => { loadData(); loadPaymentRecords(); }, []);

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

    // Load client summary
    const loadClientSummary = useCallback(() => {
        if (clientPeriod === 'custom' && (!customFrom || !customTo)) return;

        setClientSummaryLoading(true);
        const { startDate, endDate } = getPeriodDates(clientPeriod, customFrom, customTo);

        Promise.all([
            fetch(`/api/clients/summary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`).then(r => r.json()),
            fetch(`/api/clients/payments?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`).then(r => r.json()),
        ]).then(([summaryData, paymentsData]) => {
            setClientSummary(summaryData.clients || []);

            // Build payments lookup
            const payMap: Record<string, boolean> = {};
            (paymentsData.payments || []).forEach((p: any) => {
                payMap[p.clientName] = p.paid;
            });
            setClientPayments(payMap);
            setClientSummaryLoading(false);
        }).catch(() => setClientSummaryLoading(false));
    }, [clientPeriod, customFrom, customTo]);

    useEffect(() => { loadClientSummary(); }, [loadClientSummary]);

    // Load payment records
    const loadPaymentRecords = () => {
        setPaymentRecordsLoading(true);
        fetch('/api/clients/records')
            .then(r => r.json())
            .then(d => {
                setPaymentRecords(d.records || []);
                setPaymentRecordsLoading(false);
            })
            .catch(() => setPaymentRecordsLoading(false));
    };

    const addPaymentRecord = async () => {
        setPaymentFormError('');
        if (!paymentForm.clientName || !paymentForm.amount || !paymentForm.periodFrom || !paymentForm.periodTo) {
            setPaymentFormError('Client, amount, and period are required');
            return;
        }
        try {
            const res = await fetch('/api/clients/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(paymentForm),
            });
            if (!res.ok) {
                const data = await res.json();
                setPaymentFormError(data.error || 'Failed');
                return;
            }
            setShowAddPayment(false);
            setPaymentForm({ clientName: '', amount: '', periodFrom: '', periodTo: '', receivedAt: '', note: '' });
            loadPaymentRecords();
        } catch { setPaymentFormError('Network error'); }
    };

    const deletePaymentRecord = async (id: number) => {
        if (!confirm('Delete this payment record?')) return;
        await fetch('/api/clients/records', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        loadPaymentRecords();
    };

    // Group payment records by month
    const groupedRecords = (() => {
        const groups: Record<string, any[]> = {};
        for (const rec of paymentRecords) {
            const d = new Date(rec.receivedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push({ ...rec, monthLabel: label });
        }
        return Object.entries(groups)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([key, recs]) => ({ key, label: recs[0].monthLabel, records: recs }));
    })();

    // Get unique client names for the payment form dropdown
    const clientNames = [...new Set(models.filter(m => m.clientName).map(m => m.clientName))];

    const openEdit = (model: any) => {
        setEditingModel(model);
        setEditForm({
            name: model.name || '',
            commission: model.commission?.toString() || '0',
            clientName: model.clientName || '',
        });
    };

    const saveEdit = async () => {
        if (!editingModel) return;
        try {
            const res = await fetch(`/api/models/${editingModel.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editForm.name, commission: editForm.commission, clientName: editForm.clientName }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(`Error: ${data.error || 'Failed'}`);
                return;
            }
            setEditingModel(null);
            loadData();
            setTimeout(loadClientSummary, 300);
        } catch { alert('Network error'); }
    };

    const saveInlineClient = async (modelId: number) => {
        try {
            await fetch(`/api/models/${modelId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName: editingClientValue }),
            });
            setEditingClientId(null);
            loadData();
            setTimeout(loadClientSummary, 300);
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

    const addModel = async () => {
        setAddError('');
        if (!newModelName.trim()) { setAddError('Name is required'); return; }
        try {
            const res = await fetch('/api/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newModelName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) { setAddError(data.error || 'Failed'); return; }
            setShowAddModel(false);
            setNewModelName('');
            loadData();
        } catch { setAddError('Network error'); }
    };

    const togglePayment = async (clientName: string, paid: boolean) => {
        const { startDate, endDate } = getPeriodDates(clientPeriod, customFrom, customTo);
        const client = clientSummary.find(c => c.clientName === clientName);
        const amount = client?.totalCommission || 0;

        try {
            await fetch('/api/clients/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName,
                    periodStart: startDate,
                    periodEnd: endDate,
                    paid,
                    amount,
                }),
            });
            setClientPayments(prev => ({ ...prev, [clientName]: paid }));
        } catch { alert('Network error'); }
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
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowAddModel(true); setAddError(''); setNewModelName(''); }}>+ Add Model</button>
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
                                        <th>Client</th>
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
                                                    {editingClientId === m.id ? (
                                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                            <input
                                                                className="form-input"
                                                                style={{ padding: '4px 8px', fontSize: 13, width: 120 }}
                                                                value={editingClientValue}
                                                                onChange={e => setEditingClientValue(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') saveInlineClient(m.id);
                                                                    if (e.key === 'Escape') setEditingClientId(null);
                                                                }}
                                                                autoFocus
                                                                placeholder="Client name..."
                                                            />
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                style={{ padding: '2px 8px', fontSize: 12 }}
                                                                onClick={() => saveInlineClient(m.id)}
                                                            >✓</button>
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                style={{ padding: '2px 8px', fontSize: 12 }}
                                                                onClick={() => setEditingClientId(null)}
                                                            >✕</button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            style={{
                                                                cursor: 'pointer',
                                                                color: m.clientName ? 'var(--text-primary)' : 'var(--text-muted)',
                                                                fontStyle: m.clientName ? 'normal' : 'italic',
                                                                fontSize: 13,
                                                                borderBottom: '1px dashed var(--border-primary)',
                                                                paddingBottom: 1,
                                                            }}
                                                            onClick={() => {
                                                                setEditingClientId(m.id);
                                                                setEditingClientValue(m.clientName || '');
                                                            }}
                                                            title="Click to edit client"
                                                        >
                                                            {m.clientName || '— set client'}
                                                        </span>
                                                    )}
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

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CLIENT SUMMARY SECTION */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div className="card" style={{ marginTop: 32 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div>
                            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>
                                👥 Client Summary & Payments
                            </h2>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                                Grouped models by client with revenue totals and payment tracking.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>📅</span>
                            {CLIENT_PERIODS.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setClientPeriod(p.value)}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        border: clientPeriod === p.value
                                            ? '1px solid var(--accent-primary)'
                                            : '1px solid var(--border-primary)',
                                        background: clientPeriod === p.value
                                            ? 'rgba(139, 92, 246, 0.15)'
                                            : 'var(--bg-secondary)',
                                        color: clientPeriod === p.value
                                            ? 'var(--accent-primary)'
                                            : 'var(--text-secondary)',
                                        fontSize: 12,
                                        fontWeight: clientPeriod === p.value ? 600 : 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom date range */}
                    {clientPeriod === 'custom' && (
                        <div style={{
                            display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16,
                            padding: '12px 16px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)',
                        }}>
                            <div>
                                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>From</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    style={{ fontSize: 13, padding: '6px 10px' }}
                                    value={customFrom}
                                    onChange={e => setCustomFrom(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>To</label>
                                <input
                                    type="datetime-local"
                                    className="form-input"
                                    style={{ fontSize: 13, padding: '6px 10px' }}
                                    value={customTo}
                                    onChange={e => setCustomTo(e.target.value)}
                                />
                            </div>
                            <button
                                className="btn btn-sm btn-primary"
                                style={{ marginTop: 18 }}
                                onClick={loadClientSummary}
                                disabled={!customFrom || !customTo}
                            >
                                Apply
                            </button>
                        </div>
                    )}

                    {clientSummaryLoading ? (
                        <p className="text-muted">Loading client data...</p>
                    ) : clientSummary.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>Paid</th>
                                        <th>Client</th>
                                        <th>Models</th>
                                        <th>Total Revenue</th>
                                        <th>Total Commission (Payout)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientSummary.map((client: any) => (
                                        <tr key={client.clientName}>
                                            <td>
                                                <label style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', position: 'relative',
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={clientPayments[client.clientName] || false}
                                                        onChange={e => togglePayment(client.clientName, e.target.checked)}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{
                                                        width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                                                        border: clientPayments[client.clientName]
                                                            ? '2px solid var(--success)'
                                                            : '2px solid var(--border-primary)',
                                                        background: clientPayments[client.clientName]
                                                            ? 'rgba(34, 197, 94, 0.15)'
                                                            : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 14, transition: 'all 0.15s ease',
                                                    }}>
                                                        {clientPayments[client.clientName] ? '✓' : ''}
                                                    </span>
                                                </label>
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 600, fontSize: 15,
                                                    color: clientPayments[client.clientName]
                                                        ? 'var(--success)'
                                                        : 'var(--text-primary)',
                                                }}>
                                                    {client.clientName}
                                                </span>
                                                {clientPayments[client.clientName] && (
                                                    <span style={{
                                                        marginLeft: 8, fontSize: 11, padding: '2px 8px',
                                                        borderRadius: 'var(--radius-sm)', fontWeight: 600,
                                                        background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)',
                                                    }}>PAID</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {client.models.map((m: any) => (
                                                        <span
                                                            key={m.id}
                                                            className="badge badge-primary"
                                                            style={{ fontSize: 11, padding: '2px 8px' }}
                                                        >
                                                            {m.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                                                ${fmt(client.totalRevenue)}
                                            </td>
                                            <td style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-primary)' }}>
                                                ${fmt(client.totalCommission)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                        <td></td>
                                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                            {clientSummary.reduce((s: number, c: any) => s + c.models.length, 0)} models
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                                            ${fmt(clientSummary.reduce((s: number, c: any) => s + c.totalRevenue, 0))}
                                        </td>
                                        <td style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-primary)' }}>
                                            ${fmt(clientSummary.reduce((s: number, c: any) => s + c.totalCommission, 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">👥</div>
                            <div className="empty-state-text">
                                No clients assigned yet. Set a client name on models above to see them grouped here.
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* PAYMENT RECORDS LEDGER */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div className="card" style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>
                                💰 Payment Records
                            </h2>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                                Log all payments received from clients. Grouped by month.
                            </p>
                        </div>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => { setShowAddPayment(true); setPaymentFormError(''); }}
                        >
                            + Add Payment
                        </button>
                    </div>

                    {paymentRecordsLoading ? (
                        <p className="text-muted">Loading records...</p>
                    ) : groupedRecords.length > 0 ? (
                        groupedRecords.map(group => (
                            <div key={group.key} style={{ marginBottom: 24 }}>
                                <h4 style={{
                                    margin: '0 0 10px', fontWeight: 600, fontSize: 15,
                                    color: 'var(--accent-primary)',
                                    borderBottom: '1px solid var(--border-primary)',
                                    paddingBottom: 6,
                                }}>
                                    📅 {group.label}
                                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                                        ({group.records.length} payment{group.records.length > 1 ? 's' : ''})
                                        {' — '}
                                        Total: <strong style={{ color: 'var(--success)' }}>
                                            ${fmt(group.records.reduce((s: number, r: any) => s + r.amount, 0))}
                                        </strong>
                                    </span>
                                </h4>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Client</th>
                                                <th>Amount Received</th>
                                                <th>Earning Period</th>
                                                <th>Received On</th>
                                                <th>Note</th>
                                                <th style={{ width: 40 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.records.map((rec: any) => (
                                                <tr key={rec.id}>
                                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {rec.clientName}
                                                    </td>
                                                    <td style={{ color: 'var(--success)', fontWeight: 700, fontSize: 15 }}>
                                                        ${fmt(rec.amount)}
                                                    </td>
                                                    <td style={{ fontSize: 13 }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>
                                                            {new Date(rec.periodFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            {' → '}
                                                            {new Date(rec.periodTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                        {new Date(rec.receivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                                            {new Date(rec.receivedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {rec.note || '—'}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            style={{ padding: '2px 8px', fontSize: 11 }}
                                                            onClick={() => deletePaymentRecord(rec.id)}
                                                        >🗑️</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">💰</div>
                            <div className="empty-state-text">
                                No payments recorded yet. Click "Add Payment" to log a client payment.
                            </div>
                        </div>
                    )}
                </div>

                {/* Add Payment Modal */}
                {showAddPayment && (
                    <div className="modal-overlay" onClick={() => setShowAddPayment(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                            <h3 className="modal-title">💰 Record Payment</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>
                                Log a payment received from a client.
                            </p>
                            {paymentFormError && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>
                                    {paymentFormError}
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Client</label>
                                {clientNames.length > 0 ? (
                                    <select
                                        className="form-input"
                                        value={paymentForm.clientName}
                                        onChange={e => setPaymentForm({ ...paymentForm, clientName: e.target.value })}
                                    >
                                        <option value="">Select client...</option>
                                        {clientNames.map(cn => (
                                            <option key={cn} value={cn}>{cn}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="form-input"
                                        value={paymentForm.clientName}
                                        onChange={e => setPaymentForm({ ...paymentForm, clientName: e.target.value })}
                                        placeholder="Client name"
                                    />
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Amount Received ($)</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={paymentForm.amount}
                                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    placeholder="e.g. 5000.00"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Earning Period From</label>
                                    <input
                                        className="form-input"
                                        type="datetime-local"
                                        value={paymentForm.periodFrom}
                                        onChange={e => setPaymentForm({ ...paymentForm, periodFrom: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Earning Period To</label>
                                    <input
                                        className="form-input"
                                        type="datetime-local"
                                        value={paymentForm.periodTo}
                                        onChange={e => setPaymentForm({ ...paymentForm, periodTo: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date Received</label>
                                <input
                                    className="form-input"
                                    type="datetime-local"
                                    value={paymentForm.receivedAt}
                                    onChange={e => setPaymentForm({ ...paymentForm, receivedAt: e.target.value })}
                                />
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                    Leave empty for current date/time.
                                </p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Note (optional)</label>
                                <input
                                    className="form-input"
                                    value={paymentForm.note}
                                    onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                                    placeholder="e.g. Wire transfer, PayPal, etc."
                                />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowAddPayment(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={addPaymentRecord}>💰 Save Payment</button>
                            </div>
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
                                <label className="form-label">Client Name</label>
                                <input
                                    className="form-input"
                                    value={editForm.clientName}
                                    onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                                    placeholder="e.g. John's Agency"
                                />
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                    The client/partner who holds this model. Models with the same client name will be grouped in the Client Summary.
                                </p>
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

            {/* Add Model Modal */}
            {showAddModel && (
                <div className="modal-overlay" onClick={() => setShowAddModel(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <h3 className="modal-title">➕ Add Model</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 16px' }}>
                            Create a model manually. This will not create Discord channels.
                        </p>
                        {addError && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>
                                {addError}
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Model Name</label>
                            <input className="form-input" value={newModelName} onChange={e => setNewModelName(e.target.value)} placeholder="e.g. Luna" autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') addModel(); }} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowAddModel(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={addModel}>➕ Create Model</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
