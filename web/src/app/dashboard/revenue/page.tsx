'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function fmt(n: number) { return n.toFixed(2); }

// Generate weekly periods: Monday 18:00 CET to next Monday 18:00 CET
function generateWeeklyPeriods(count: number = 12) {
    const periods: { label: string; startDate: string; endDate: string }[] = [];

    // Find the most recent Monday 18:00 CET (17:00 UTC)
    const now = new Date();
    const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon
    const daysBack = currentDay === 0 ? 6 : currentDay === 1 ? 0 : currentDay - 1;

    const latestMonday = new Date(now);
    latestMonday.setUTCDate(now.getUTCDate() - daysBack);
    latestMonday.setUTCHours(17, 0, 0, 0); // 18:00 CET = 17:00 UTC

    // If we haven't passed this Monday's 18:00 yet, go back one more week
    if (latestMonday > now) {
        latestMonday.setUTCDate(latestMonday.getUTCDate() - 7);
    }

    for (let i = 0; i < count; i++) {
        const start = new Date(latestMonday);
        start.setUTCDate(latestMonday.getUTCDate() - (i * 7));

        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 7);

        const formatDate = (d: Date) => {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const isCurrent = now >= start && now <= end;

        periods.push({
            label: `${formatDate(start)} – ${formatDate(end)}${isCurrent ? ' (Current)' : ''}`,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
        });
    }

    return periods;
}

export default function RevenuePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [modelRevenue, setModelRevenue] = useState<any[]>([]);
    const [totals, setTotals] = useState({ totalSales: 0, totalChargebacks: 0, netRevenue: 0 });
    const [loading, setLoading] = useState(true);
    const [periods] = useState(generateWeeklyPeriods(12));
    const [selectedPeriod, setSelectedPeriod] = useState(0);

    // Client payment tracking
    const [clientPayments, setClientPayments] = useState<Record<string, any>>({});
    const [clientPaymentsLoading, setClientPaymentsLoading] = useState(false);

    const userRole = (session?.user as any)?.role || '';

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && userRole !== 'ADMIN') router.push('/dashboard');
    }, [status, userRole, router]);

    useEffect(() => {
        if (periods.length > 0) loadRevenue();
    }, [selectedPeriod]);

    const loadRevenue = () => {
        setLoading(true);
        const period = periods[selectedPeriod];
        fetch(`/api/revenue?startDate=${encodeURIComponent(period.startDate)}&endDate=${encodeURIComponent(period.endDate)}`)
            .then(r => r.json())
            .then(d => {
                setModelRevenue(d.models || []);
                setTotals(d.totals || { totalSales: 0, totalChargebacks: 0, netRevenue: 0 });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    // Load client payment records for selected period + previous periods (to detect carry-over)
    const loadClientPayments = useCallback(() => {
        setClientPaymentsLoading(true);
        // Load all payments (no date filter) so we can detect carry-over from previous periods
        fetch('/api/clients/payments')
            .then(r => r.json())
            .then(d => {
                const payMap: Record<string, any> = {};
                (d.payments || []).forEach((p: any) => {
                    const key = `${p.clientName}__${p.periodStart}__${p.periodEnd}`;
                    payMap[key] = p;
                });
                setClientPayments(payMap);
                setClientPaymentsLoading(false);
            })
            .catch(() => setClientPaymentsLoading(false));
    }, []);

    useEffect(() => { loadClientPayments(); }, [loadClientPayments]);

    // Group models by client for the selected period
    const clientGroups = (() => {
        const groups: Record<string, { models: any[]; totalGross: number; totalNet: number }> = {};

        for (const m of modelRevenue) {
            const cn = m.clientName;
            if (!cn) continue;

            if (!groups[cn]) {
                groups[cn] = { models: [], totalGross: 0, totalNet: 0 };
            }
            groups[cn].models.push(m);
            groups[cn].totalGross += m.totalSales;
            groups[cn].totalNet += m.netRevenue;
        }

        return Object.entries(groups).map(([name, data]) => ({ clientName: name, ...data }));
    })();

    // Get payment record for a client in the selected period
    const getPaymentRecord = (clientName: string) => {
        const period = periods[selectedPeriod];
        const key = `${clientName}__${period.startDate}__${period.endDate}`;
        return clientPayments[key] || null;
    };

    // Calculate carry-over: sum up unpaid amounts from ALL previous periods
    const getCarryOver = (clientName: string) => {
        const currentPeriodStart = new Date(periods[selectedPeriod].startDate);
        let total = 0;
        let lateCount = 0;

        // Check all periods BEFORE the selected one
        for (const [key, payment] of Object.entries(clientPayments) as [string, any][]) {
            if (payment.clientName !== clientName) continue;
            const pStart = new Date(payment.periodStart);
            if (pStart >= currentPeriodStart) continue; // skip current and future

            if (!payment.paid && payment.status !== 'carried_over') {
                total += (payment.amount || 0) + (payment.carryOver || 0);
                lateCount++;
            } else if (payment.status === 'carried_over') {
                // Already carried — its amount was rolled forward
            }
        }

        return { total, lateCount };
    };

    // Toggle paid status
    const togglePaid = async (clientName: string, paid: boolean, amount: number) => {
        const period = periods[selectedPeriod];
        const carry = getCarryOver(clientName);

        await fetch('/api/clients/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientName,
                periodStart: period.startDate,
                periodEnd: period.endDate,
                paid,
                amount,
                carryOver: carry.total,
            }),
        });
        loadClientPayments();
    };

    // Mark as late
    const markLate = async (clientName: string, amount: number) => {
        const period = periods[selectedPeriod];
        const carry = getCarryOver(clientName);

        await fetch('/api/clients/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientName,
                periodStart: period.startDate,
                periodEnd: period.endDate,
                paid: false,
                status: 'late',
                amount,
                carryOver: carry.total,
            }),
        });
        loadClientPayments();
    };

    // Carry over unpaid balance: mark previous as carried_over and add to current
    const carryOverDebt = async (clientName: string, currentAmount: number) => {
        const currentPeriodStart = new Date(periods[selectedPeriod].startDate);
        let carryTotal = 0;

        // Find all unpaid previous periods and mark them as carried_over
        for (const [key, payment] of Object.entries(clientPayments) as [string, any][]) {
            if (payment.clientName !== clientName) continue;
            const pStart = new Date(payment.periodStart);
            if (pStart >= currentPeriodStart) continue;

            if (!payment.paid && payment.status !== 'carried_over') {
                const debt = (payment.amount || 0) + (payment.carryOver || 0);
                carryTotal += debt;

                // Mark as carried over
                await fetch('/api/clients/payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientName,
                        periodStart: payment.periodStart,
                        periodEnd: payment.periodEnd,
                        paid: false,
                        status: 'carried_over',
                        amount: payment.amount,
                        carryOver: payment.carryOver,
                    }),
                });
            }
        }

        // Update current period with the carry-over amount
        const period = periods[selectedPeriod];
        await fetch('/api/clients/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientName,
                periodStart: period.startDate,
                periodEnd: period.endDate,
                paid: false,
                status: 'late',
                amount: currentAmount,
                carryOver: carryTotal,
            }),
        });

        loadClientPayments();
    };

    if (userRole !== 'ADMIN') return null;

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Revenue</h1>
            </header>
            <div className="main-body">
                {/* Period Selector */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>📅 Weekly Period:</span>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {periods.slice(0, 6).map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedPeriod(i)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: selectedPeriod === i ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                                        background: selectedPeriod === i ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-glass)',
                                        color: selectedPeriod === i ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        fontWeight: selectedPeriod === i ? 600 : 400,
                                        transition: 'all 150ms ease',
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                        Monday 18:00 CET → Monday 18:00 CET (7-day billing cycle)
                    </div>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Total Sales</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>${fmt(totals.totalSales)}</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Chargebacks</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>-${fmt(totals.totalChargebacks)}</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Net Revenue</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: totals.netRevenue >= 0 ? 'var(--accent-primary)' : 'var(--danger)' }}>
                            ${fmt(totals.netRevenue)}
                        </div>
                    </div>
                </div>

                {/* Per-Model Breakdown */}
                <div className="card">
                    <h3 style={{ margin: '0 0 16px', fontWeight: 600, color: 'var(--text-primary)' }}>Revenue by Model</h3>
                    {loading ? <p className="text-muted">Loading...</p> : modelRevenue.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Model</th>
                                        <th>Client</th>
                                        <th>Shifts</th>
                                        <th>Total Sales</th>
                                        <th>Chargebacks</th>
                                        <th>Net Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modelRevenue.filter(m => m.totalSales > 0 || m.totalChargebacks > 0).map((m: any) => (
                                        <tr key={m.modelId}>
                                            <td>
                                                <span className="badge badge-primary" style={{ fontSize: 13 }}>{m.modelName}</span>
                                            </td>
                                            <td style={{ color: m.clientName ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13 }}>
                                                {m.clientName || '—'}
                                            </td>
                                            <td>{m.invoiceCount}</td>
                                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>${fmt(m.totalSales)}</td>
                                            <td style={{ color: m.totalChargebacks > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: m.totalChargebacks > 0 ? 600 : 400 }}>
                                                {m.totalChargebacks > 0 ? `-$${fmt(m.totalChargebacks)}` : '—'}
                                            </td>
                                            <td style={{ fontWeight: 700, color: m.netRevenue >= 0 ? 'var(--accent-primary)' : 'var(--danger)' }}>
                                                ${fmt(m.netRevenue)}
                                            </td>
                                        </tr>
                                    ))}
                                    {modelRevenue.filter(m => m.totalSales > 0 || m.totalChargebacks > 0).length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                                                No revenue data for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {modelRevenue.filter(m => m.totalSales > 0 || m.totalChargebacks > 0).length > 0 && (
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</td>
                                            <td></td>
                                            <td style={{ fontWeight: 600 }}>{modelRevenue.reduce((s, m) => s + m.invoiceCount, 0)}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--success)' }}>${fmt(totals.totalSales)}</td>
                                            <td style={{ fontWeight: 700, color: totals.totalChargebacks > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                {totals.totalChargebacks > 0 ? `-$${fmt(totals.totalChargebacks)}` : '—'}
                                            </td>
                                            <td style={{ fontWeight: 700, color: totals.netRevenue >= 0 ? 'var(--accent-primary)' : 'var(--danger)' }}>
                                                ${fmt(totals.netRevenue)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">💰</div>
                            <div className="empty-state-text">No models found.</div>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* CLIENT PAYMENTS TRACKING */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div className="card" style={{ marginTop: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>
                            👥 Client Payments
                        </h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            Track which clients have paid for the selected period. Late payments carry over to the next period.
                        </p>
                    </div>

                    {clientPaymentsLoading ? (
                        <p className="text-muted">Loading...</p>
                    ) : clientGroups.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>Paid</th>
                                        <th>Client</th>
                                        <th>Models</th>
                                        <th>Total Gross</th>
                                        <th>Carry Over</th>
                                        <th>Total Owed</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientGroups.map(client => {
                                        const record = getPaymentRecord(client.clientName);
                                        const isPaid = record?.paid || false;
                                        const recordStatus = record?.status || 'pending';
                                        const carry = getCarryOver(client.clientName);
                                        const recordCarry = record?.carryOver || 0;
                                        const effectiveCarry = Math.max(carry.total, recordCarry);
                                        const totalOwed = client.totalGross + effectiveCarry;

                                        return (
                                            <tr
                                                key={client.clientName}
                                                style={{
                                                    background: isPaid
                                                        ? 'rgba(34, 197, 94, 0.03)'
                                                        : recordStatus === 'late'
                                                            ? 'rgba(239, 68, 68, 0.03)'
                                                            : 'transparent',
                                                }}
                                            >
                                                {/* Paid checkbox */}
                                                <td>
                                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isPaid}
                                                            onChange={e => togglePaid(client.clientName, e.target.checked, client.totalGross)}
                                                            style={{ display: 'none' }}
                                                        />
                                                        <span style={{
                                                            width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                                                            border: isPaid ? '2px solid var(--success)' : '2px solid var(--border-primary)',
                                                            background: isPaid ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 15, transition: 'all 0.15s ease',
                                                            color: 'var(--success)',
                                                        }}>
                                                            {isPaid ? '✓' : ''}
                                                        </span>
                                                    </label>
                                                </td>

                                                {/* Client name */}
                                                <td>
                                                    <span style={{
                                                        fontWeight: 600, fontSize: 15,
                                                        color: isPaid ? 'var(--success)' : recordStatus === 'late' ? 'var(--danger)' : 'var(--text-primary)',
                                                    }}>
                                                        {client.clientName}
                                                    </span>
                                                </td>

                                                {/* Models badges */}
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {client.models.map((m: any) => (
                                                            <span
                                                                key={m.modelId}
                                                                className="badge badge-primary"
                                                                style={{ fontSize: 11, padding: '2px 8px' }}
                                                            >
                                                                {m.modelName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Total Gross this period */}
                                                <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                                                    ${fmt(client.totalGross)}
                                                </td>

                                                {/* Carry Over */}
                                                <td>
                                                    {effectiveCarry > 0 ? (
                                                        <span style={{
                                                            color: 'var(--danger)', fontWeight: 600,
                                                            fontSize: 13,
                                                        }}>
                                                            +${fmt(effectiveCarry)}
                                                            {carry.lateCount > 0 && (
                                                                <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>
                                                                    ({carry.lateCount} period{carry.lateCount > 1 ? 's' : ''})
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                    )}
                                                </td>

                                                {/* Total Owed */}
                                                <td style={{
                                                    fontWeight: 700, fontSize: 16,
                                                    color: isPaid ? 'var(--success)' : effectiveCarry > 0 ? 'var(--danger)' : 'var(--accent-primary)',
                                                }}>
                                                    ${fmt(totalOwed)}
                                                </td>

                                                {/* Status badge */}
                                                <td>
                                                    {isPaid ? (
                                                        <span style={{
                                                            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                                                            fontSize: 11, fontWeight: 700,
                                                            background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)',
                                                        }}>✅ PAID</span>
                                                    ) : recordStatus === 'late' ? (
                                                        <span style={{
                                                            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                                                            fontSize: 11, fontWeight: 700,
                                                            background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)',
                                                        }}>🔴 LATE</span>
                                                    ) : recordStatus === 'carried_over' ? (
                                                        <span style={{
                                                            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                                                            fontSize: 11, fontWeight: 700,
                                                            background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                                                        }}>🔄 CARRIED</span>
                                                    ) : (
                                                        <span style={{
                                                            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                                                            fontSize: 11, fontWeight: 600,
                                                            background: 'rgba(107, 114, 128, 0.15)', color: 'var(--text-muted)',
                                                        }}>⏳ PENDING</span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {!isPaid && recordStatus !== 'late' && (
                                                            <button
                                                                className="btn btn-sm"
                                                                style={{
                                                                    fontSize: 11, padding: '3px 10px',
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                    color: 'var(--danger)',
                                                                }}
                                                                onClick={() => markLate(client.clientName, client.totalGross)}
                                                            >
                                                                🔴 Mark Late
                                                            </button>
                                                        )}
                                                        {!isPaid && carry.lateCount > 0 && recordStatus !== 'carried_over' && (
                                                            <button
                                                                className="btn btn-sm"
                                                                style={{
                                                                    fontSize: 11, padding: '3px 10px',
                                                                    background: 'rgba(245, 158, 11, 0.1)',
                                                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                                                    color: '#f59e0b',
                                                                }}
                                                                onClick={() => carryOverDebt(client.clientName, client.totalGross)}
                                                                title="Prenesi prethodni dug u ovaj period"
                                                            >
                                                                🔄 Carry Over
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                        <td></td>
                                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                            {clientGroups.reduce((s, c) => s + c.models.length, 0)} models
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                                            ${fmt(clientGroups.reduce((s, c) => s + c.totalGross, 0))}
                                        </td>
                                        <td></td>
                                        <td style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-primary)' }}>
                                            ${fmt(clientGroups.reduce((s, c) => {
                                                const carry = getCarryOver(c.clientName);
                                                const record = getPaymentRecord(c.clientName);
                                                const effectiveCarry = Math.max(carry.total, record?.carryOver || 0);
                                                return s + c.totalGross + effectiveCarry;
                                            }, 0))}
                                        </td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">👥</div>
                            <div className="empty-state-text">
                                No clients with revenue this period. Assign client names on the Models page to see them here.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
