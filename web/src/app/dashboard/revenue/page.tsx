'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function fmt(n: number) { return n.toFixed(2); }

// Generate weekly periods: Monday 18:00 CET to next Monday 18:30 CET
function generateWeeklyPeriods(count: number = 8) {
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
        end.setUTCHours(17, 30, 0, 0); // 18:30 CET = 17:30 UTC

        const startLocal = new Date(start.getTime());
        const endLocal = new Date(end.getTime());

        const formatDate = (d: Date) => {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const isCurrent = now >= start && now <= end;

        periods.push({
            label: `${formatDate(startLocal)} – ${formatDate(endLocal)}${isCurrent ? ' (Current)' : ''}`,
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
                        Monday 18:00 CET → Monday 18:30 CET (7-day billing cycle)
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
                                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                                                No revenue data for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {modelRevenue.filter(m => m.totalSales > 0 || m.totalChargebacks > 0).length > 0 && (
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</td>
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
            </div>
        </>
    );
}
