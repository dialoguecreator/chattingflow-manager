'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const PERIODS = [
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '14d', label: 'Last 14 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' },
    { value: 'custom', label: 'Custom' },
];

function getPeriodDates(period: string, customFrom?: string, customTo?: string) {
    const now = new Date();
    let from: Date;
    let to = now;

    switch (period) {
        case '24h':
            from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '14d':
            from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'all':
            from = new Date('2020-01-01T00:00:00.000Z');
            break;
        case 'custom':
            from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            to = customTo ? new Date(customTo + 'T23:59:59.999Z') : now;
            break;
        default:
            from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return {
        from: from.toISOString(),
        to: to.toISOString(),
    };
}

function formatTime(seconds: number | undefined) {
    if (!seconds) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatHours(seconds: number | undefined) {
    if (!seconds) return '—';
    const h = (seconds / 3600).toFixed(1);
    return `${h}h`;
}

function fmt(n: number) { return n.toFixed(2); }

export default function OnlyMonsterPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const userRole = (session?.user as any)?.role || '';

    const [tab, setTab] = useState<'chatters' | 'ltv'>('chatters');
    const [period, setPeriod] = useState('7d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    // Chatter metrics state
    const [metrics, setMetrics] = useState<any[]>([]);
    const [metricsLoading, setMetricsLoading] = useState(false);

    // LTV state
    const [ltvData, setLtvData] = useState<any[]>([]);
    const [ltvLoading, setLtvLoading] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && userRole !== 'ADMIN' && userRole !== 'MANAGER' && userRole !== 'FOUNDER') {
            router.push('/dashboard');
        }
    }, [status, userRole, router]);

    // Fetch chatter metrics
    useEffect(() => {
        if (tab !== 'chatters') return;
        if (period === 'custom' && (!customFrom || !customTo)) return;

        setMetricsLoading(true);
        const dates = getPeriodDates(period, customFrom, customTo);

        fetch(`/api/onlymonster/chatter-metrics?from=${encodeURIComponent(dates.from)}&to=${encodeURIComponent(dates.to)}`)
            .then(r => r.json())
            .then(data => {
                setMetrics(data.metrics || []);
                setMetricsLoading(false);
            })
            .catch(() => setMetricsLoading(false));
    }, [tab, period, customFrom, customTo]);

    // Fetch LTV data
    useEffect(() => {
        if (tab !== 'ltv') return;
        if (period === 'custom' && (!customFrom || !customTo)) return;

        setLtvLoading(true);
        const dates = getPeriodDates(period, customFrom, customTo);

        fetch(`/api/onlymonster/subscriber-ltv?from=${encodeURIComponent(dates.from)}&to=${encodeURIComponent(dates.to)}`)
            .then(r => r.json())
            .then(data => {
                setLtvData(data.models || []);
                setLtvLoading(false);
            })
            .catch(() => setLtvLoading(false));
    }, [tab, period, customFrom, customTo]);

    const isAllowed = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'FOUNDER';
    if (status === 'loading') return <div className="main-body"><p>Loading...</p></div>;
    if (!isAllowed) return null;

    // Totals for chatter metrics
    const totalMessages = metrics.reduce((s, m) => s + (m.messages_count || 0), 0);
    const totalSoldMsgPrice = metrics.reduce((s, m) => s + (m.sold_messages_price_sum || 0), 0);
    const totalTips = metrics.reduce((s, m) => s + (m.tips_amount_sum || 0), 0);
    const totalSoldPostsPrice = metrics.reduce((s, m) => s + (m.sold_posts_price_sum || 0), 0);
    const totalEarnings = totalSoldMsgPrice + totalTips + totalSoldPostsPrice;
    const avgReplyTime = metrics.length > 0
        ? metrics.reduce((s, m) => s + (m.reply_time_avg || 0), 0) / metrics.filter(m => m.reply_time_avg > 0).length
        : 0;

    // Totals for LTV
    const totalLtvSubs = ltvData.reduce((s, m) => s + (m.totalSubscribers || 0), 0);
    const totalLtvSales = ltvData.reduce((s, m) => s + (m.totalNetSales || 0), 0);
    const overallLtv = totalLtvSubs > 0 ? totalLtvSales / totalLtvSubs : 0;

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">👾 OnlyMonster</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="text-sm text-muted">Analytics & Performance</span>
                </div>
            </header>
            <div className="main-body">
                {/* Tab Switcher */}
                <div style={{
                    display: 'flex', gap: 4, marginBottom: 20,
                    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                    padding: 4, border: '1px solid var(--border-primary)', width: 'fit-content',
                }}>
                    {[
                        { key: 'chatters' as const, label: '📊 Chatter Performance', },
                        { key: 'ltv' as const, label: '📈 Subscriber LTV', },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                background: tab === t.key ? 'var(--accent-gradient)' : 'transparent',
                                color: tab === t.key ? 'white' : 'var(--text-secondary)',
                                fontSize: 14,
                                fontWeight: tab === t.key ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                fontFamily: 'var(--font-sans)',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Period Filter */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 20, flexWrap: 'wrap',
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
                    {period === 'custom' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="date"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: 13, width: 150 }}
                                value={customFrom}
                                onChange={e => setCustomFrom(e.target.value)}
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
                            <input
                                type="date"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: 13, width: 150 }}
                                value={customTo}
                                onChange={e => setCustomTo(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* CHATTER PERFORMANCE TAB                     */}
                {/* ═══════════════════════════════════════════ */}
                {tab === 'chatters' && (
                    <>
                        {/* Summary Stats */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-label">Total Chatters</div>
                                <div className="stat-value">{metrics.length}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Messages</div>
                                <div className="stat-value">{totalMessages.toLocaleString()}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Earnings</div>
                                <div className="stat-value">${fmt(totalEarnings)}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Avg Reply Time</div>
                                <div className="stat-value">{formatTime(avgReplyTime)}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Tips</div>
                                <div className="stat-value">${fmt(totalTips)}</div>
                            </div>
                        </div>

                        {/* Chatter Table */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Chatter Performance Details</h2>
                                <span className="text-sm text-muted">{metrics.length} chatters</span>
                            </div>
                            {metricsLoading ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>⏳</div>
                                    <div>Loading chatter metrics from OnlyMonster...</div>
                                </div>
                            ) : metrics.length > 0 ? (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>User ID</th>
                                                <th>Creator IDs</th>
                                                <th>Fans</th>
                                                <th>Messages</th>
                                                <th>Reply Time</th>
                                                <th>Paid Msgs Sent</th>
                                                <th>Sold Msgs Revenue</th>
                                                <th>Sold Posts Revenue</th>
                                                <th>Tips</th>
                                                <th>AI Messages</th>
                                                <th>Work Time</th>
                                                <th>Total Earnings</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {metrics.map((m: any, i: number) => {
                                                const earnings = (m.sold_messages_price_sum || 0) + (m.tips_amount_sum || 0) + (m.sold_posts_price_sum || 0);
                                                return (
                                                    <tr key={i}>
                                                        <td>
                                                            <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                                                                #{m.user_id}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                                {(m.creator_ids || []).map((id: number) => (
                                                                    <span key={id} className="badge badge-primary" style={{ fontSize: 10, padding: '1px 6px' }}>
                                                                        {id}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td>{m.fans_count || 0}</td>
                                                        <td style={{ fontWeight: 600 }}>{(m.messages_count || 0).toLocaleString()}</td>
                                                        <td>
                                                            <span style={{
                                                                color: (m.reply_time_avg || 0) < 120 ? 'var(--success)' :
                                                                    (m.reply_time_avg || 0) < 300 ? 'var(--warning)' : 'var(--danger)',
                                                                fontWeight: 600,
                                                            }}>
                                                                {formatTime(m.reply_time_avg)}
                                                            </span>
                                                        </td>
                                                        <td>{m.paid_messages_count || 0}</td>
                                                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                                                            ${fmt(m.sold_messages_price_sum || 0)}
                                                        </td>
                                                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                                                            ${fmt(m.sold_posts_price_sum || 0)}
                                                        </td>
                                                        <td style={{ color: '#f59e0b', fontWeight: 600 }}>
                                                            ${fmt(m.tips_amount_sum || 0)}
                                                        </td>
                                                        <td>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            }}>
                                                                🤖 {m.ai_generated_messages_count || 0}
                                                            </span>
                                                        </td>
                                                        <td>{formatHours(m.work_time)}</td>
                                                        <td style={{
                                                            fontWeight: 700, fontSize: 15,
                                                            background: 'var(--accent-gradient)',
                                                            WebkitBackgroundClip: 'text',
                                                            WebkitTextFillColor: 'transparent',
                                                            backgroundClip: 'text',
                                                        }}>
                                                            ${fmt(earnings)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                                                <td></td>
                                                <td style={{ fontWeight: 600 }}>{metrics.reduce((s, m) => s + (m.fans_count || 0), 0)}</td>
                                                <td style={{ fontWeight: 700 }}>{totalMessages.toLocaleString()}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{formatTime(avgReplyTime)}</td>
                                                <td style={{ fontWeight: 600 }}>{metrics.reduce((s, m) => s + (m.paid_messages_count || 0), 0)}</td>
                                                <td style={{ fontWeight: 700, color: 'var(--success)' }}>${fmt(totalSoldMsgPrice)}</td>
                                                <td style={{ fontWeight: 700, color: 'var(--success)' }}>${fmt(totalSoldPostsPrice)}</td>
                                                <td style={{ fontWeight: 700, color: '#f59e0b' }}>${fmt(totalTips)}</td>
                                                <td style={{ fontWeight: 600 }}>🤖 {metrics.reduce((s, m) => s + (m.ai_generated_messages_count || 0), 0)}</td>
                                                <td style={{ fontWeight: 600 }}>{formatHours(metrics.reduce((s, m) => s + (m.work_time || 0), 0))}</td>
                                                <td style={{
                                                    fontWeight: 800, fontSize: 16,
                                                    background: 'var(--accent-gradient)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                    backgroundClip: 'text',
                                                }}>
                                                    ${fmt(totalEarnings)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📊</div>
                                    <div className="empty-state-text">
                                        No chatter metrics found for this period. Try a different time range.
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ═══════════════════════════════════════════ */}
                {/* SUBSCRIBER LTV TAB                          */}
                {/* ═══════════════════════════════════════════ */}
                {tab === 'ltv' && (
                    <>
                        {/* Summary Stats */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-label">Total Models</div>
                                <div className="stat-value">{ltvData.length}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Subscribers</div>
                                <div className="stat-value">{totalLtvSubs.toLocaleString()}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Total Net Sales</div>
                                <div className="stat-value">${fmt(totalLtvSales)}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Overall LTV</div>
                                <div className="stat-value">${fmt(overallLtv)}</div>
                            </div>
                        </div>

                        {/* LTV Table */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Subscriber LTV per Model</h2>
                                <span className="text-sm text-muted">{ltvData.length} models</span>
                            </div>
                            {ltvLoading ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>⏳</div>
                                    <div>Calculating LTV from OnlyMonster data...</div>
                                    <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>
                                        This may take a moment — fetching transactions & tracking links for each model.
                                    </div>
                                </div>
                            ) : ltvData.length > 0 ? (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Model</th>
                                                <th>Username</th>
                                                <th>Sub Price</th>
                                                <th>New Subscribers</th>
                                                <th>Tracking Links</th>
                                                <th>Total Net Sales</th>
                                                <th>LTV (Sales / Subs)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ltvData.map((m: any) => (
                                                <tr key={m.accountId}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            {m.avatar && (
                                                                <img
                                                                    src={m.avatar}
                                                                    alt={m.name}
                                                                    style={{
                                                                        width: 32, height: 32, borderRadius: '50%',
                                                                        border: '2px solid var(--border-primary)',
                                                                        objectFit: 'cover',
                                                                    }}
                                                                />
                                                            )}
                                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                                {m.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: 'var(--accent-primary)', fontSize: 13 }}>
                                                            @{m.username}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {m.subscribePrice != null ? (
                                                            <span style={{ fontWeight: 600 }}>
                                                                ${fmt(m.subscribePrice)}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--success)' }}>Free</span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontWeight: 700, fontSize: 16, color: 'var(--info)' }}>
                                                        {m.totalSubscribers.toLocaleString()}
                                                    </td>
                                                    <td>{m.trackingLinksCount}</td>
                                                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                                                        ${fmt(m.totalNetSales)}
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            fontWeight: 800, fontSize: 18,
                                                            background: m.ltv > 0 ? 'var(--accent-gradient)' : 'none',
                                                            WebkitBackgroundClip: m.ltv > 0 ? 'text' : undefined,
                                                            WebkitTextFillColor: m.ltv > 0 ? 'transparent' : 'var(--text-muted)',
                                                            backgroundClip: m.ltv > 0 ? 'text' : undefined,
                                                            color: m.ltv > 0 ? undefined : 'var(--text-muted)',
                                                        }}>
                                                            ${fmt(m.ltv)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid var(--border-primary)' }}>
                                                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                                                <td></td>
                                                <td></td>
                                                <td style={{ fontWeight: 700, fontSize: 16, color: 'var(--info)' }}>
                                                    {totalLtvSubs.toLocaleString()}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>
                                                    {ltvData.reduce((s: number, m: any) => s + (m.trackingLinksCount || 0), 0)}
                                                </td>
                                                <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                                                    ${fmt(totalLtvSales)}
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontWeight: 800, fontSize: 18,
                                                        background: 'var(--accent-gradient)',
                                                        WebkitBackgroundClip: 'text',
                                                        WebkitTextFillColor: 'transparent',
                                                        backgroundClip: 'text',
                                                    }}>
                                                        ${fmt(overallLtv)}
                                                    </span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📈</div>
                                    <div className="empty-state-text">
                                        No subscriber data found for this period. Try a different time range.
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
