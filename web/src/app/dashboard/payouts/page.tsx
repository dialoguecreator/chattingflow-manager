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

export default function PayoutsPage() {
    const { status } = useSession();
    const router = useRouter();
    const [periods, setPeriods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [showCreatePeriod, setShowCreatePeriod] = useState(false);
    const [periodForm, setPeriodForm] = useState({ startDate: '', endDate: '' });

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

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
        // First recalculate
        await fetch(`/api/payouts/${period.id}/calculate`, { method: 'POST' });
        // Then fetch entries
        const res = await fetch(`/api/payouts/${period.id}/entries`);
        const data = await res.json();
        setEntries(data.entries || []);
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

    const totalNetPayout = entries.reduce((s, e) => s + (e.netPayout || 0), 0);
    const totalGross = entries.reduce((s, e) => s + (e.totalGross || 0), 0);

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Payouts</h1>
                {selectedPeriod && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPeriod(null)}>
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
                                                <th>Fee (5%)</th>
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
                                                const bonus = e.massPPVEarnings || 0;
                                                const beforeFee = commission - pun + bonus;
                                                const fee = beforeFee > 0 ? beforeFee * 0.05 : 0;
                                                const payout = beforeFee - fee + (e.staffSalary || 0);

                                                const isStaff = e.user?.role && e.user.role !== 'CHATTER';
                                                const isPaid = e.paid;
                                                const rowStyle: any = {};
                                                if (isPaid) {
                                                    rowStyle.textDecoration = 'line-through';
                                                    rowStyle.opacity = 0.5;
                                                }

                                                const nameColor = isStaff ? '#f97316' : 'var(--text-primary)';

                                                return (
                                                    <tr key={e.id} style={rowStyle}>
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
                                                                onClick={async () => {
                                                                    await fetch(`/api/payouts/${selectedPeriod.id}/entries`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ entryId: e.id, paid: !isPaid }),
                                                                    });
                                                                    // Update locally
                                                                    setEntries(prev => prev.map(en => en.id === e.id ? { ...en, paid: !isPaid } : en));
                                                                }}
                                                                title={isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                                                            >
                                                                {isPaid ? '✅' : '⬜'}
                                                            </button>
                                                        </td>
                                                        <td style={{ fontWeight: 600, color: nameColor }}>
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
                                                        <td style={{ color: 'var(--success)' }}>+${fmt(bonus)}</td>
                                                        <td style={{ color: 'var(--warning)' }}>-${fmt(fee)}</td>
                                                        <td style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: 15 }}>
                                                            ${fmt(payout)}
                                                        </td>
                                                    </tr>
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
