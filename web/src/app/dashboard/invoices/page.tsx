'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function SearchableSelect({ label, placeholder, items, value, onChange, onAddNew }: {
    label: string;
    placeholder: string;
    items: { id: number; label: string }[];
    value: string;
    onChange: (val: string) => void;
    onAddNew?: () => void;
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
            <label>{label}</label>
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
                    maxHeight: 240,
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
                    {onAddNew && (
                        <div
                            onClick={() => { onAddNew(); setOpen(false); setSearch(''); }}
                            style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                color: 'var(--accent-primary)',
                                background: 'rgba(139, 92, 246, 0.05)',
                                borderTop: '2px solid var(--border-primary)',
                                transition: 'background 100ms',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)')}
                        >
                            ➕ Add New Chatter
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function InvoicesPage() {
    const { status } = useSession();
    const router = useRouter();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editInvoice, setEditInvoice] = useState<any>(null);
    const [editForm, setEditForm] = useState({ totalGross: '', splitCount: '', splitAmount: '', shiftSummary: '' });
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    // Add shift modal
    const [showAdd, setShowAdd] = useState(false);
    const [chatters, setChatters] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [addForm, setAddForm] = useState({
        userId: '', modelId: '', clockIn: '', clockOut: '', totalGross: '', splitCount: '1', shiftSummary: ''
    });

    // Inline add chatter
    const [showNewChatter, setShowNewChatter] = useState(false);
    const [newChatterForm, setNewChatterForm] = useState({ discordUsername: '', discordId: '', displayName: '' });
    const [creatingChatter, setCreatingChatter] = useState(false);

    const createChatter = async () => {
        if (!newChatterForm.discordUsername || !newChatterForm.displayName) return;
        setCreatingChatter(true);
        try {
            const res = await fetch('/api/chatters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newChatterForm),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(`Error: ${data.error || 'Failed to create chatter'}`);
                setCreatingChatter(false);
                return;
            }
            // Add new chatter to the list and select them
            setChatters(prev => [...prev, data.chatter]);
            setAddForm(prev => ({ ...prev, userId: String(data.chatter.id) }));
            setShowNewChatter(false);
            setNewChatterForm({ discordUsername: '', discordId: '', displayName: '' });
        } catch (e: any) {
            alert(`Error: ${e.message || 'Network error'}`);
        }
        setCreatingChatter(false);
    };

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    const fetchInvoices = (p: number = page) => {
        setLoading(true);
        fetch(`/api/invoices?page=${p}&limit=50`)
            .then(r => r.json())
            .then(d => {
                setInvoices(d.invoices || []);
                setTotalPages(d.totalPages || 1);
                setTotal(d.total || 0);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchInvoices(page); }, [page]);

    // Load chatters and models for the add modal
    const openAddModal = () => {
        Promise.all([
            fetch('/api/chatters').then(r => r.json()),
            fetch('/api/models').then(r => r.json()),
        ]).then(([c, m]) => {
            setChatters(c.chatters || []);
            setModels(m.models || []);
            setShowAdd(true);
        });
    };

    const addInvoice = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addForm),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(`Error: ${data.error || 'Failed to create shift'}`);
                setSaving(false);
                return;
            }
            setShowAdd(false);
            setAddForm({ userId: '', modelId: '', clockIn: '', clockOut: '', totalGross: '', splitCount: '1', shiftSummary: '' });
            fetchInvoices(page);
        } catch (e: any) {
            alert(`Error: ${e.message || 'Network error'}`);
        }
        setSaving(false);
    };

    const openEdit = (inv: any) => {
        setEditInvoice(inv);
        setEditForm({
            totalGross: inv.totalGross?.toString() || '',
            splitCount: inv.splitCount?.toString() || '1',
            splitAmount: inv.splitAmount?.toString() || '',
            shiftSummary: inv.shiftSummary || '',
        });
    };

    const handleSave = async () => {
        if (!editInvoice) return;
        setSaving(true);
        try {
            await fetch(`/api/invoices/${editInvoice.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            setEditInvoice(null);
            fetchInvoices(page);
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const handleDelete = async (id: number) => {
        try {
            await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
            setConfirmDelete(null);
            fetchInvoices(page);
        } catch (e) { console.error(e); }
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Invoices</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="text-sm text-muted">{total} total invoices</span>
                    <button className="btn btn-primary btn-sm" onClick={openAddModal}>+ Add Shift</button>
                </div>
            </header>
            <div className="main-body">
                <div className="card">
                    {loading ? (
                        <p className="text-muted">Loading...</p>
                    ) : invoices.length > 0 ? (
                        <>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Chatter</th>
                                            <th>Model</th>
                                            <th>Clock In</th>
                                            <th>Clock Out</th>
                                            <th>Total Sales</th>
                                            <th>Split</th>
                                            <th>Partner</th>
                                            <th>Per Person</th>
                                            <th>Summary</th>
                                            <th>Sales File</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((inv: any) => (
                                            <tr key={inv.id}>
                                                <td>{inv.id}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {inv.user?.firstName} {inv.user?.lastName}
                                                </td>
                                                <td><span className="badge badge-primary">{inv.model?.name}</span></td>
                                                <td>{new Date(inv.clockRecord?.clockIn).toLocaleString()}</td>
                                                <td>{inv.clockRecord?.clockOut ? new Date(inv.clockRecord.clockOut).toLocaleString() : '—'}</td>
                                                <td style={{ color: 'var(--success)', fontWeight: 700 }}>${inv.totalGross?.toFixed(2)}</td>
                                                <td>{inv.splitCount > 1 ? `${inv.splitCount}-way` : 'Solo'}</td>
                                                <td style={{ color: inv.splitPartner ? 'var(--primary)' : 'var(--text-muted)', fontWeight: inv.splitPartner ? 600 : 400 }}>
                                                    {inv.splitPartner ? inv.splitPartner.name || inv.splitPartner.username : '—'}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>${inv.splitAmount?.toFixed(2)}</td>
                                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {inv.shiftSummary || '—'}
                                                </td>
                                                <td>
                                                    {inv.salesTrackerPath ? (
                                                        <a href={`/api/files/${inv.salesTrackerPath}`} className="btn btn-sm btn-secondary">📥 Download</a>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button className="btn btn-sm btn-primary" onClick={() => openEdit(inv)}>✏️</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(inv.id)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    padding: '20px 0 4px',
                                }}>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => p - 1)}
                                    >
                                        ← Prev
                                    </button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
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
                            <div className="empty-state-icon">🧾</div>
                            <div className="empty-state-text">No invoices yet. Click "+ Add Shift" to create one manually, or data will appear when chatters clock out via Discord.</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Shift Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Add Shift Manually</h2>
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                            Create a manual shift/invoice entry
                        </p>

                        <SearchableSelect
                            label="Chatter"
                            placeholder="Search chatter..."
                            items={chatters.map((c: any) => ({ id: c.id, label: `${c.firstName} ${c.lastName} (${c.username})` }))}
                            value={addForm.userId}
                            onChange={val => setAddForm({ ...addForm, userId: val })}
                            onAddNew={() => setShowNewChatter(true)}
                        />

                        {showNewChatter && (
                            <div style={{
                                background: 'rgba(139, 92, 246, 0.08)',
                                border: '1px solid var(--border-primary)',
                                borderRadius: 'var(--radius-md)',
                                padding: '1rem',
                                marginBottom: '0.5rem',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>➕ New Chatter</span>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => { setShowNewChatter(false); setNewChatterForm({ discordUsername: '', discordId: '', displayName: '' }); }}
                                        style={{ padding: '4px 8px', fontSize: 12 }}
                                    >✕</button>
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: 13 }}>Discord Username *</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. johndoe"
                                        value={newChatterForm.discordUsername}
                                        onChange={e => setNewChatterForm({ ...newChatterForm, discordUsername: e.target.value })}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: 13 }}>Discord ID <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. 123456789012345678"
                                        value={newChatterForm.discordId}
                                        onChange={e => setNewChatterForm({ ...newChatterForm, discordId: e.target.value })}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: 13 }}>Display Name *</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. John Doe"
                                        value={newChatterForm.displayName}
                                        onChange={e => setNewChatterForm({ ...newChatterForm, displayName: e.target.value })}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={createChatter}
                                    disabled={creatingChatter || !newChatterForm.discordUsername || !newChatterForm.displayName}
                                    style={{ width: '100%' }}
                                >
                                    {creatingChatter ? 'Creating...' : '✅ Create & Select Chatter'}
                                </button>
                            </div>
                        )}

                        <SearchableSelect
                            label="Model"
                            placeholder="Search model..."
                            items={models.map((m: any) => ({ id: m.id, label: m.name }))}
                            value={addForm.modelId}
                            onChange={val => setAddForm({ ...addForm, modelId: val })}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Clock In</label>
                                <input type="datetime-local" value={addForm.clockIn} onChange={e => setAddForm({ ...addForm, clockIn: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Clock Out</label>
                                <input type="datetime-local" value={addForm.clockOut} onChange={e => setAddForm({ ...addForm, clockOut: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Total Sales ($)</label>
                                <input type="number" step="0.01" value={addForm.totalGross} onChange={e => setAddForm({ ...addForm, totalGross: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Split Count</label>
                                <input type="number" min="1" value={addForm.splitCount} onChange={e => setAddForm({ ...addForm, splitCount: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Shift Summary</label>
                            <textarea rows={3} value={addForm.shiftSummary} onChange={e => setAddForm({ ...addForm, shiftSummary: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={addInvoice} disabled={saving || !addForm.userId || !addForm.modelId || !addForm.clockIn || !addForm.clockOut || !addForm.totalGross}>
                                {saving ? 'Creating...' : 'Create Shift'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editInvoice && (
                <div className="modal-overlay" onClick={() => setEditInvoice(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Edit Invoice #{editInvoice.id}</h2>
                        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                            {editInvoice.user?.firstName} {editInvoice.user?.lastName} — {editInvoice.model?.name}
                        </p>

                        <div className="form-group">
                            <label>Total Gross Sales ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={editForm.totalGross}
                                onChange={e => setEditForm({ ...editForm, totalGross: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Split Count</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={editForm.splitCount}
                                    onChange={e => setEditForm({ ...editForm, splitCount: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Amount Per Person ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editForm.splitAmount}
                                    onChange={e => setEditForm({ ...editForm, splitAmount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Shift Summary</label>
                            <textarea
                                rows={3}
                                value={editForm.shiftSummary}
                                onChange={e => setEditForm({ ...editForm, shiftSummary: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button className="btn btn-secondary" onClick={() => setEditInvoice(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {confirmDelete !== null && (
                <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <h3 className="modal-title">Delete Invoice</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
                            Are you sure you want to delete this invoice? This action cannot be undone.
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>🗑️ Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
