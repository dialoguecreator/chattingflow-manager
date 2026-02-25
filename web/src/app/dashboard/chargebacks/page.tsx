'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function SearchableSelect({ label, placeholder, items, value, onChange }: {
    label: string;
    placeholder: string;
    items: { id: number; label: string }[];
    value: string;
    onChange: (val: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = items.find(i => String(i.id) === value);
    const filtered = items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="form-group" ref={ref} style={{ position: 'relative' }}>
            <label className="form-label">{label}</label>
            <input
                className="form-input"
                placeholder={selected ? selected.label : placeholder}
                value={open ? search : (selected ? selected.label : '')}
                onFocus={() => { setOpen(true); setSearch(''); }}
                onChange={e => setSearch(e.target.value)}
                style={{
                    color: selected && !open ? 'var(--text-primary)' : undefined,
                    cursor: 'text',
                }}
            />
            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: 200,
                    overflowY: 'auto',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    zIndex: 100,
                    marginTop: 4,
                }}>
                    {filtered.length > 0 ? filtered.map(item => (
                        <div
                            key={item.id}
                            onClick={() => { onChange(String(item.id)); setOpen(false); setSearch(''); }}
                            style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontSize: 14,
                                color: String(item.id) === value ? 'var(--accent-primary)' : 'var(--text-primary)',
                                fontWeight: String(item.id) === value ? 600 : 400,
                                background: String(item.id) === value ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                                borderBottom: '1px solid var(--border-primary)',
                                transition: 'background 100ms',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)')}
                            onMouseLeave={e => (e.currentTarget.style.background = String(item.id) === value ? 'rgba(139, 92, 246, 0.1)' : 'transparent')}
                        >
                            {item.label}
                        </div>
                    )) : (
                        <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>
                            No results found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ChargebacksPage() {
    const { status } = useSession();
    const router = useRouter();
    const [chargebacks, setChargebacks] = useState<any[]>([]);
    const [chatters, setChatters] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ subscriberName: '', userId: '', modelId: '', amount: '', ppvSentDate: '', chargebackDate: '' });

    useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
    useEffect(() => { loadData(); }, []);

    const loadData = () => {
        Promise.all([
            fetch('/api/chargebacks').then(r => r.json()),
            fetch('/api/chatters').then(r => r.json()),
            fetch('/api/models').then(r => r.json()),
        ]).then(([cbData, cData, mData]) => {
            setChargebacks(cbData.chargebacks || []);
            setChatters(cData.chatters || []);
            setModels(mData.models || []);
            setLoading(false);
        });
    };

    const addChargeback = async () => {
        await fetch('/api/chargebacks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setShowAdd(false);
        setForm({ subscriberName: '', userId: '', modelId: '', amount: '', ppvSentDate: '', chargebackDate: '' });
        loadData();
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Chargebacks</h1>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Chargeback</button>
            </header>
            <div className="main-body">
                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : chargebacks.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Subscriber</th><th>Chatter</th><th>Model</th><th>Amount</th><th>PPV Sent</th><th>Chargeback Date</th></tr>
                                </thead>
                                <tbody>
                                    {chargebacks.map((cb: any) => (
                                        <tr key={cb.id}>
                                            <td style={{ fontWeight: 600 }}>{cb.subscriberName}</td>
                                            <td>{cb.user?.firstName} {cb.user?.lastName}</td>
                                            <td>{cb.model ? <span className="badge badge-primary">{cb.model.name}</span> : '—'}</td>
                                            <td style={{ color: 'var(--danger)', fontWeight: 700 }}>-${cb.amount?.toFixed(2)}</td>
                                            <td>{cb.ppvSentDate ? new Date(cb.ppvSentDate).toLocaleDateString() : '—'}</td>
                                            <td>{cb.chargebackDate ? new Date(cb.chargebackDate).toLocaleDateString() : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">↩️</div>
                            <div className="empty-state-text">No chargebacks recorded.</div>
                        </div>
                    )}
                </div>

                {showAdd && (
                    <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <h3 className="modal-title">Add Chargeback</h3>
                            <div className="form-group">
                                <label className="form-label">Subscriber Name</label>
                                <input className="form-input" value={form.subscriberName} onChange={e => setForm({ ...form, subscriberName: e.target.value })} />
                            </div>

                            <SearchableSelect
                                label="Chatter"
                                placeholder="Search chatter..."
                                items={chatters.map((c: any) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }))}
                                value={form.userId}
                                onChange={val => setForm({ ...form, userId: val })}
                            />

                            <SearchableSelect
                                label="Model"
                                placeholder="Search model..."
                                items={models.map((m: any) => ({ id: m.id, label: m.name }))}
                                value={form.modelId}
                                onChange={val => setForm({ ...form, modelId: val })}
                            />

                            <div className="form-group">
                                <label className="form-label">Amount ($)</label>
                                <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">PPV Sent Date (optional)</label>
                                <input className="form-input" type="date" value={form.ppvSentDate} onChange={e => setForm({ ...form, ppvSentDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Chargeback Date (optional)</label>
                                <input className="form-input" type="date" value={form.chargebackDate} onChange={e => setForm({ ...form, chargebackDate: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button className="btn btn-danger" onClick={addChargeback}>Add Chargeback</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
