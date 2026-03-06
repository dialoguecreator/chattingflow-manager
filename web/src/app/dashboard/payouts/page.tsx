'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function fmt(n: number) { return n.toFixed(2); }

function fmtDate(ts: number | string) {
    const d = new Date(typeof ts === 'string' ? ts : ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtShort(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function PayoutsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [periods, setPeriods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [showCreatePeriod, setShowCreatePeriod] = useState(false);
    const [periodForm, setPeriodForm] = useState({ startDate: '', endDate: '' });

    // Expandable rows
    const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
    const [entryInvoices, setEntryInvoices] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    // Editable bonus
    const [editingBonus, setEditingBonus] = useState<number | null>(null);
    const [bonusValue, setBonusValue] = useState('');

    // Editable fee
    const [editingFee, setEditingFee] = useState<number | null>(null);
    const [feeValue, setFeeValue] = useState('');

    // Expenses
    const [expenses, setExpenses] = useState<any[]>([]);
    const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });

    const userRole = (session?.user as any)?.role || '';
    const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER';

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && !isAdminOrManager) router.push('/dashboard');
    }, [status, isAdminOrManager, router]);

    const loadPeriods = () => {
        fetch('/api/payouts')
            .then(r => r.json())
            .then(d => { setPeriods(d.periods || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { loadPeriods(); }, []);

    const openPeriod = async (period: any) => {
        setSelectedPeriod(period);
        setLoadingEntries(true);
        setExpandedEntry(null);
        await fetch(`/api/payouts/${period.id}/calculate`, { method: 'POST' });
        const [entriesRes, expensesRes] = await Promise.all([
            fetch(`/api/payouts/${period.id}/entries`),
            fetch(`/api/payouts/${period.id}/expenses`),
        ]);
        const entriesData = await entriesRes.json();
        const expensesData = await expensesRes.json();
        setEntries(entriesData.entries || []);
        setExpenses(expensesData.expenses || []);
        setLoadingEntries(false);
    };

    const recalculate = async () => {
        if (!selectedPeriod) return;
        setRecalculating(true);
        await fetch(`/api/payouts/${selectedPeriod.id}/calculate`, { method: 'POST' });
        const res = await fetch(`/api/payouts/${selectedPeriod.id}/entries`);
        const data = await res.json();
        setEntries(data.entries || []);
        setRecalculating(false);
    };

    // Expand chatter row to show invoices
    const toggleExpand = async (entryId: number) => {
        if (expandedEntry === entryId) {
            setExpandedEntry(null);
            setEntryInvoices([]);
            return;
        }
        setExpandedEntry(entryId);
        setLoadingInvoices(true);
        try {
            const res = await fetch(`/api/payouts/${selectedPeriod.id}/entries/${entryId}/invoices`);
            const data = await res.json();
            setEntryInvoices(data.invoices || []);
        } catch { setEntryInvoices([]); }
        setLoadingInvoices(false);
    };

    // Save bonus
    const saveBonus = async (entryId: number) => {
        const res = await fetch(`/api/payouts/${selectedPeriod.id}/entries`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId, bonus: parseFloat(bonusValue) || 0 }),
        });
        const data = await res.json();
        if (res.ok && data.entry) {
            setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...data.entry } : e));
        }
        setEditingBonus(null);
    };

    // Save fee
    const saveFee = async (entryId: number) => {
        const res = await fetch(`/api/payouts/${selectedPeriod.id}/entries`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId, feePercent: parseFloat(feeValue) || 0 }),
        });
        const data = await res.json();
        if (res.ok && data.entry) {
            setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...data.entry } : e));
        }
        setEditingFee(null);
    };

    // Add expense
    const addExpense = async () => {
        if (!expenseForm.description.trim() || !expenseForm.amount) return;
        const res = await fetch(`/api/payouts/${selectedPeriod.id}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: expenseForm.description, amount: parseFloat(expenseForm.amount) }),
        });
        if (res.ok) {
            const data = await res.json();
            setExpenses(prev => [data.expense, ...prev]);
            setExpenseForm({ description: '', amount: '' });
        }
    };

    // Delete expense
    const deleteExpense = async (expenseId: number) => {
        await fetch(`/api/payouts/${selectedPeriod.id}/expenses?expenseId=${expenseId}`, { method: 'DELETE' });
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
    };

    // Totals
    const totalNetPayout = entries.reduce((s, e) => s + (e.netPayout || 0), 0);
    const totalGross = entries.reduce((s, e) => s + (e.totalGross || 0), 0);
    const totalChargebacks = entries.reduce((s, e) => s + (e.chargebackDeductions || 0), 0);
    const totalPunishments = entries.reduce((s, e) => s + (e.punishmentDeductions || 0), 0);
    const totalFees = entries.reduce((s, e) => s + (e.feeAmount || 0), 0);
    const totalBonuses = entries.reduce((s, e) => s + (e.bonus || e.massPPVEarnings || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Payouts</h1>
                {selectedPeriod && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedPeriod(null); setExpandedEntry(null); }}>
                        ← Back to Periods
                    </button>
                )}
            </header>
            <div className="main-body">

                {/* ─── Period Selection View ─── */}
                {!selectedPeriod ? (
                    <>
                        <div className="stats-grid" style={{ marginBottom: 24 }}>
                            <div className="stat-card">
                                <div className="stat-label">Total Periods</div>
                                <div className="stat-value">{periods.length}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Active Period</div>
                                <div className="stat-value">{periods.filter(p => p.status === 'ACTIVE').length}</div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Payout Periods</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowCreatePeriod(true)}>+ New Period</button>
                            </div>
                            {loading ? (
                                <p className="text-muted">Loading...</p>
                            ) : periods.length > 0 ? (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {periods.map((p: any) => (
                                        <div
                                            key={p.id}
                                            onClick={() => openPeriod(p)}
                                            style={{
                                                background: 'var(--bg-glass)',
                                                border: '1px solid var(--border-primary)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '20px 24px',
                                                cursor: 'pointer',
                                                transition: 'all 200ms ease',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                            onMouseEnter={e => {
                                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={e => {
                                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-primary)';
                                                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                                                    Period #{p.id}
                                                </div>
                                                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                                    {fmtDate(p.startDate)} → {fmtDate(p.endDate)}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>INVOICES</div>
                                                    <div style={{ fontSize: 18, fontWeight: 700 }}>{p._count?.invoices || 0}</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>CHATTERS</div>
                                                    <div style={{ fontSize: 18, fontWeight: 700 }}>{p._count?.entries || 0}</div>
                                                </div>
                                                <span className={`badge ${p.status === 'ACTIVE' ? 'badge-success' : p.status === 'COMPLETED' ? 'badge-info' : 'badge-warning'}`}>
                                                    {p.status}
                                                </span>
                                                <span style={{ fontSize: 20, color: 'var(--text-muted)' }}>→</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📅</div>
                                    <div className="empty-state-text">No payout periods yet. Create one to get started.</div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* ─── Period Detail View ─── */
                    <>
                        {/* Stats */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-label">Period</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {fmtDate(selectedPeriod.startDate)}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                                    → {fmtDate(selectedPeriod.endDate)}
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Sales (Gross)</div>
                                <div className="stat-value">${fmt(totalGross)}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Payouts</div>
                                <div className="stat-value">${fmt(totalNetPayout)}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Chatters</div>
                                <div className="stat-value">{entries.length}</div>
                            </div>
                        </div>

                        {/* Totals Summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, margin: '16px 0' }}>
                            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL CHARGEBACKS</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>-${fmt(totalChargebacks)}</div>
                            </div>
                            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL PUNISHMENTS</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>-${fmt(totalPunishments)}</div>
                            </div>
                            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL FEES (5%)</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>-${fmt(totalFees)}</div>
                            </div>
                            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL BONUSES</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>+${fmt(totalBonuses)}</div>
                            </div>
                            {totalExpenses > 0 && (
                                <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL EXPENSES</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary)' }}>-${fmt(totalExpenses)}</div>
                                </div>
                            )}
                        </div>

                        {/* Breakdown Table */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Period #{selectedPeriod.id} — Breakdown</h3>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={recalculate}
                                    disabled={recalculating}
                                >
                                    {recalculating ? '⏳ Calculating...' : '🔄 Recalculate'}
                                </button>
                            </div>
                            {loadingEntries ? (
                                <p className="text-muted">Calculating payouts...</p>
                            ) : entries.length > 0 ? (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}></th>
                                                <th>Chatter</th>
                                                <th>Total Sales</th>
                                                <th>Chargebacks</th>
                                                <th>Rate</th>
                                                <th>Commission</th>
                                                <th>Punishments</th>
                                                <th>Bonus</th>
                                                <th>Fee</th>
                                                <th>Payout</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map((e: any) => {
                                                const totalSales = e.totalGross || 0;
                                                const cb = e.chargebackDeductions || 0;
                                                const rate = e.commissionRate || 4;
                                                const commission = (totalSales - cb) * (rate / 100);
                                                const pun = e.punishmentDeductions || 0;
                                                const bonus = e.bonus || e.massPPVEarnings || 0;
                                                const beforeFee = commission - pun + bonus;
                                                const feePercent = e.feePercent ?? 5;
                                                const fee = beforeFee > 0 ? beforeFee * (feePercent / 100) : 0;
                                                const payout = beforeFee - fee + (e.staffSalary || 0);

                                                const isStaff = e.user?.role && e.user.role !== 'CHATTER';
                                                const isPaid = e.paid;
                                                const isExpanded = expandedEntry === e.id;
                                                const rowStyle: any = {};
                                                if (isPaid) {
                                                    rowStyle.textDecoration = 'line-through';
                                                    rowStyle.opacity = 0.5;
                                                }

                                                const nameColor = isStaff ? '#f97316' : 'var(--text-primary)';

                                                return (
                                                    <>{/* Fragment for row + expanded */}
                                                        <tr
                                                            key={e.id}
                                                            style={{ ...rowStyle, cursor: 'pointer', transition: 'background 150ms' }}
                                                            onClick={() => toggleExpand(e.id)}
                                                            onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(139,92,246,0.05)')}
                                                            onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                                                        >
                                                            <td>
                                                                <button
                                                                    className="btn btn-sm"
                                                                    style={{
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        fontSize: 18,
                                                                        cursor: 'pointer',
                                                                        padding: '2px 6px',
                                                                    }}
                                                                    onClick={async (ev) => {
                                                                        ev.stopPropagation();
                                                                        await fetch(`/api/payouts/${selectedPeriod.id}/entries`, {
                                                                            method: 'PATCH',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ entryId: e.id, paid: !isPaid }),
                                                                        });
                                                                        setEntries(prev => prev.map(en => en.id === e.id ? { ...en, paid: !isPaid } : en));
                                                                    }}
                                                                    title={isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                                                                >
                                                                    {isPaid ? '✅' : '⬜'}
                                                                </button>
                                                            </td>
                                                            <td style={{ fontWeight: 600, color: nameColor }}>
                                                                <span style={{ marginRight: 6 }}>{isExpanded ? '▼' : '▶'}</span>
                                                                {e.user?.firstName} {e.user?.lastName}
                                                                {isStaff && (
                                                                    <span style={{ fontSize: 11, marginLeft: 6, color: '#f97316', opacity: 0.8 }}>
                                                                        ({e.user?.staffProfile?.position || e.user?.role})
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ fontWeight: 600 }}>${fmt(totalSales)}</td>
                                                            <td style={{ color: 'var(--danger)' }}>-${fmt(cb)}</td>
                                                            <td>{parseFloat(rate.toFixed(2))}%</td>
                                                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>${fmt(commission)}</td>
                                                            <td style={{ color: 'var(--danger)' }}>-${fmt(pun)}</td>
                                                            <td
                                                                style={{ color: 'var(--success)', cursor: 'pointer' }}
                                                                onClick={(ev) => {
                                                                    ev.stopPropagation();
                                                                    setEditingBonus(e.id);
                                                                    setBonusValue(bonus.toString());
                                                                }}
                                                            >
                                                                {editingBonus === e.id ? (
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={bonusValue}
                                                                        onChange={ev => setBonusValue(ev.target.value)}
                                                                        onBlur={() => saveBonus(e.id)}
                                                                        onKeyDown={ev => { if (ev.key === 'Enter') saveBonus(e.id); if (ev.key === 'Escape') setEditingBonus(null); }}
                                                                        onClick={ev => ev.stopPropagation()}
                                                                        autoFocus
                                                                        style={{
                                                                            width: 80, padding: '2px 6px', fontSize: 13,
                                                                            background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)',
                                                                            borderRadius: 4, color: 'var(--text-primary)',
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span title="Click to edit bonus">+${fmt(bonus)}</span>
                                                                )}
                                                            </td>
                                                            <td
                                                                style={{ color: 'var(--warning)', cursor: 'pointer' }}
                                                                onClick={(ev) => {
                                                                    ev.stopPropagation();
                                                                    setEditingFee(e.id);
                                                                    setFeeValue(feePercent.toString());
                                                                }}
                                                            >
                                                                {editingFee === e.id ? (
                                                                    <input
                                                                        type="number"
                                                                        step="0.1"
                                                                        value={feeValue}
                                                                        onChange={ev => setFeeValue(ev.target.value)}
                                                                        onBlur={() => saveFee(e.id)}
                                                                        onKeyDown={ev => { if (ev.key === 'Enter') saveFee(e.id); if (ev.key === 'Escape') setEditingFee(null); }}
                                                                        onClick={ev => ev.stopPropagation()}
                                                                        autoFocus
                                                                        style={{
                                                                            width: 60, padding: '2px 6px', fontSize: 13,
                                                                            background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)',
                                                                            borderRadius: 4, color: 'var(--text-primary)',
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span title="Click to edit fee %">-${fmt(fee)} ({feePercent}%)</span>
                                                                )}
                                                            </td>
                                                            <td style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: 15 }}>
                                                                ${fmt(payout)}
                                                            </td>
                                                        </tr>
                                                        {/* Expanded invoices row */}
                                                        {isExpanded && (
                                                            <tr key={`${e.id}-detail`}>
                                                                <td colSpan={10} style={{ padding: 0, background: 'rgba(139,92,246,0.03)' }}>
                                                                    <div style={{ padding: '12px 24px 16px 52px' }}>
                                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                                                            📋 Shifts / Invoices for {e.user?.firstName} {e.user?.lastName}
                                                                        </div>
                                                                        {loadingInvoices ? (
                                                                            <p className="text-muted" style={{ fontSize: 13 }}>Loading invoices...</p>
                                                                        ) : entryInvoices.length > 0 ? (
                                                                            <table style={{ width: '100%', fontSize: 13 }}>
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th style={{ fontSize: 11, padding: '4px 8px' }}>Model</th>
                                                                                        <th style={{ fontSize: 11, padding: '4px 8px' }}>Clock In</th>
                                                                                        <th style={{ fontSize: 11, padding: '4px 8px' }}>Clock Out</th>
                                                                                        <th style={{ fontSize: 11, padding: '4px 8px' }}>Total Gross</th>
                                                                                        <th style={{ fontSize: 11, padding: '4px 8px' }}>Split</th>
                                                                                        <th style={{ fontSize: 11, padding: '4px 8px' }}>Amount</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {entryInvoices.map((inv: any) => (
                                                                                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                                                                            <td style={{ padding: '4px 8px' }}>
                                                                                                <span className="badge badge-primary" style={{ fontSize: 11 }}>{inv.model?.name || '—'}</span>
                                                                                            </td>
                                                                                            <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{inv.clockRecord?.clockIn ? fmtShort(inv.clockRecord.clockIn) : '—'}</td>
                                                                                            <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{inv.clockRecord?.clockOut ? fmtShort(inv.clockRecord.clockOut) : '—'}</td>
                                                                                            <td style={{ padding: '4px 8px' }}>${fmt(inv.totalGross)}</td>
                                                                                            <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{inv.splitCount > 1 ? `${inv.splitCount}-way` : '—'}</td>
                                                                                            <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--success)' }}>${fmt(inv.splitAmount)}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        ) : (
                                                                            <p className="text-muted" style={{ fontSize: 13 }}>No invoices found for this chatter in this period.</p>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📊</div>
                                    <div className="empty-state-text">No entries for this period. Click Recalculate to generate payouts from invoices.</div>
                                </div>
                            )}
                        </div>

                        {/* Additional Expenses */}
                        <div className="card" style={{ marginTop: 16 }}>
                            <div className="card-header">
                                <h3 className="card-title">💰 Additional Expenses</h3>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 12px' }}>
                                Track operational costs: office rent, electricity, subscriptions, etc.
                            </p>

                            {/* Add expense form */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
                                    <input
                                        className="form-input"
                                        value={expenseForm.description}
                                        onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                        placeholder="e.g. Office rent"
                                        style={{ fontSize: 13 }}
                                    />
                                </div>
                                <div style={{ width: 120 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount ($)</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        step="0.01"
                                        value={expenseForm.amount}
                                        onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                        placeholder="0.00"
                                        style={{ fontSize: 13 }}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={addExpense}
                                    disabled={!expenseForm.description.trim() || !expenseForm.amount}
                                    style={{ height: 38 }}
                                >
                                    + Add
                                </button>
                            </div>

                            {expenses.length > 0 ? (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Description</th>
                                                <th>Amount</th>
                                                <th>Date</th>
                                                <th style={{ width: 60 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {expenses.map((exp: any) => (
                                                <tr key={exp.id}>
                                                    <td style={{ fontWeight: 500 }}>{exp.description}</td>
                                                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>-${fmt(exp.amount)}</td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{fmtShort(exp.createdAt)}</td>
                                                    <td>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => deleteExpense(exp.id)}
                                                            style={{ padding: '2px 8px', fontSize: 12 }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                                <td style={{ fontWeight: 700 }}>TOTAL EXPENSES</td>
                                                <td style={{ fontWeight: 700, color: 'var(--danger)' }}>-${fmt(totalExpenses)}</td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-muted" style={{ fontSize: 13 }}>No expenses added for this period.</p>
                            )}
                        </div>
                    </>
                )}
            </div >

            {/* Create Period Modal */}
            {showCreatePeriod && (
                <div className="modal-overlay" onClick={() => setShowCreatePeriod(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Create Payout Period</h2>
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Set the start and end dates for the payout period (6PM CET = 5PM UTC)</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Start Date & Time</label>
                                <input type="datetime-local" value={periodForm.startDate} onChange={e => setPeriodForm({ ...periodForm, startDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>End Date & Time</label>
                                <input type="datetime-local" value={periodForm.endDate} onChange={e => setPeriodForm({ ...periodForm, endDate: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowCreatePeriod(false)}>Cancel</button>
                            <button className="btn btn-primary" disabled={!periodForm.startDate || !periodForm.endDate} onClick={async () => {
                                await fetch('/api/payouts', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(periodForm),
                                });
                                setShowCreatePeriod(false);
                                setPeriodForm({ startDate: '', endDate: '' });
                                loadPeriods();
                            }}>Create Period</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
