'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const PERIODS = [
    { value: 'all', label: 'All Time' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '14d', label: 'Last 14 Days' },
    { value: '30d', label: 'Last 30 Days' },
];

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [period, setPeriod] = useState('all');

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        fetch(`/api/dashboard/stats?period=${period}`).then(r => r.json()).then(setStats).catch(() => { });
    }, [period]);

    useEffect(() => {
        fetch(`/api/invoices?page=${page}&limit=10`)
            .then(r => r.json())
            .then(d => {
                setRecentInvoices(d.invoices || []);
                setTotalPages(d.totalPages || 1);
            })
            .catch(() => { });
    }, [page]);

    if (status === 'loading') return <div className="main-body"><p>Loading...</p></div>;

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Dashboard</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="text-sm text-muted">Welcome back, {session?.user?.name}</span>
                </div>
            </header>
            <div className="main-body">
                {/* Period Filter */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 16, flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>📅 Period:</span>
                    {PERIODS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: period === p.value
                                    ? '1px solid var(--accent-primary)'
                                    : '1px solid var(--border-primary)',
                                background: period === p.value
                                    ? 'rgba(139, 92, 246, 0.15)'
                                    : 'var(--bg-secondary)',
                                color: period === p.value
                                    ? 'var(--accent-primary)'
                                    : 'var(--text-secondary)',
                                fontSize: 13,
                                fontWeight: period === p.value ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-label">Total Revenue {period !== 'all' ? `(${PERIODS.find(p => p.value === period)?.label})` : '(All Time)'}</div>
                        <div className="stat-value">${stats?.totalRevenue?.toFixed(2) || '0.00'}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Active Shifts</div>
                        <div className="stat-value">{stats?.activeShifts || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Total Chatters</div>
                        <div className="stat-value">{stats?.totalChatters || 0}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Total Invoices {period !== 'all' ? `(${PERIODS.find(p => p.value === period)?.label})` : '(All Time)'}</div>
                        <div className="stat-value">{stats?.totalInvoices || 0}</div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Recent Invoices</h2>
                        {totalPages > 1 && (
                            <span className="text-sm text-muted">Page {page} of {totalPages}</span>
                        )}
                    </div>
                    {recentInvoices.length > 0 ? (
                        <>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Chatter</th>
                                            <th>Model</th>
                                            <th>Total Sales</th>
                                            <th>Split</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentInvoices.map((inv: any) => (
                                            <tr key={inv.id}>
                                                <td>{inv.user?.firstName} {inv.user?.lastName}</td>
                                                <td>{inv.model?.name}</td>
                                                <td style={{ color: 'var(--success)', fontWeight: 600 }}>${inv.totalGross?.toFixed(2)}</td>
                                                <td>{inv.splitCount > 1 ? `$${inv.splitAmount?.toFixed(2)} (${inv.splitCount}-way)` : 'Solo'}</td>
                                                <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    padding: '16px 0 4px',
                                }}>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        ← Prev
                                    </button>

                                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                                        <button
                                            key={p}
                                            className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setPage(p)}
                                            style={{ minWidth: 36, justifyContent: 'center' }}
                                        >
                                            {p}
                                        </button>
                                    ))}

                                    <button
                                        className="btn btn-sm btn-secondary"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📊</div>
                            <div className="empty-state-text">No invoices yet. Clock out data from Discord will appear here.</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
