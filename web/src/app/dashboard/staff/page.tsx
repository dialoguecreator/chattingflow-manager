'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const POSITIONS = ['Manager', 'Supervisor', 'Mass PPV Engineer', 'Finance Manager', 'Recruiter', 'Trainer'];
const ROLES = [
    { value: 'ADMIN', label: 'Admin', color: '#ef4444' },
    { value: 'MANAGER', label: 'Manager', color: '#8b5cf6' },
    { value: 'SUPERVISOR', label: 'Supervisor', color: '#3b82f6' },
    { value: 'STAFF', label: 'Staff', color: '#6b7280' },
];

export default function StaffPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [editingStaff, setEditingStaff] = useState<any | null>(null);
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', positions: [] as string[], monthlySalary: '' });
    const [editForm, setEditForm] = useState({ firstName: '', lastName: '', positions: [] as string[], monthlySalary: '', userRole: '' });

    const userRole = (session?.user as any)?.role || '';
    const userId = (session?.user as any)?.id;
    const isAdmin = userRole === 'ADMIN';
    const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER';

    useEffect(() => { if (status === 'unauthenticated') router.push('/login'); }, [status, router]);
    useEffect(() => { loadStaff(); }, []);

    const loadStaff = () => {
        fetch('/api/staff').then(r => r.json()).then(d => { setStaffList(d.staff || []); setLoading(false); }).catch(() => setLoading(false));
    };

    const togglePosition = (pos: string) => {
        setForm(prev => ({
            ...prev,
            positions: prev.positions.includes(pos)
                ? prev.positions.filter(p => p !== pos)
                : [...prev.positions, pos],
        }));
    };

    const toggleEditPosition = (pos: string) => {
        setEditForm(prev => ({
            ...prev,
            positions: prev.positions.includes(pos)
                ? prev.positions.filter(p => p !== pos)
                : [...prev.positions, pos],
        }));
    };

    const addStaff = async () => {
        await fetch('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, position: form.positions.join(', ') }),
        });
        setShowAdd(false);
        setForm({ firstName: '', lastName: '', email: '', positions: [], monthlySalary: '' });
        loadStaff();
    };

    const openEdit = (staff: any) => {
        setEditingStaff(staff);
        setEditForm({
            firstName: staff.user?.firstName || '',
            lastName: staff.user?.lastName || '',
            positions: staff.position ? staff.position.split(', ').filter((p: string) => p) : [],
            monthlySalary: staff.monthlySalary?.toString() || '0',
            userRole: staff.user?.role || 'STAFF',
        });
    };

    const saveEdit = async () => {
        if (!editingStaff) return;
        await fetch(`/api/staff/${editingStaff.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: editForm.firstName,
                lastName: editForm.lastName,
                position: editForm.positions.join(', '),
                monthlySalary: editForm.monthlySalary,
                userRole: editForm.userRole,
            }),
        });
        setEditingStaff(null);
        loadStaff();
    };

    const deleteStaff = async (staffId: number) => {
        await fetch(`/api/staff/${staffId}`, { method: 'DELETE' });
        setConfirmDelete(null);
        loadStaff();
    };

    // Filter: non-admin/non-manager see only themselves
    const visibleStaff = isAdminOrManager
        ? staffList
        : staffList.filter(s => s.userId === userId);

    const getRoleBadge = (role: string) => {
        const r = ROLES.find(r => r.value === role);
        if (!r) return null;
        return (
            <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontWeight: 600,
                background: `${r.color}22`,
                color: r.color,
                border: `1px solid ${r.color}44`,
            }}>
                {r.label}
            </span>
        );
    };

    return (
        <>
            <header className="main-header">
                <h1 className="page-title">Staff</h1>
                {isAdminOrManager && (
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Staff</button>
                )}
            </header>
            <div className="main-body">
                <div className="card">
                    {loading ? <p className="text-muted">Loading...</p> : visibleStaff.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>Position</th>
                                        {isAdminOrManager ? <th>Monthly Salary</th> : <th>My Salary</th>}
                                        {isAdminOrManager ? <th>Bi-Weekly</th> : <th>My Bi-Weekly</th>}
                                        {isAdminOrManager && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleStaff.map((s: any) => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.user?.firstName} {s.user?.lastName}</td>
                                            <td>{getRoleBadge(s.user?.role)}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {s.position?.split(', ').filter((p: string) => p).map((pos: string) => (
                                                        <span key={pos} className="badge badge-primary">{pos}</span>
                                                    ))}
                                                    {(!s.position || s.position.trim() === '') && <span className="text-muted">—</span>}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>${s.monthlySalary?.toFixed(2)}</td>
                                            <td>${(s.monthlySalary / 2)?.toFixed(2)}</td>
                                            {isAdminOrManager && (
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(s)}>✏️ Edit</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(s.id)}>🗑️ Remove</button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">👥</div>
                            <div className="empty-state-text">{isAdminOrManager ? 'No staff added yet.' : 'You are not assigned as staff.'}</div>
                        </div>
                    )}
                </div>

                {/* Add Staff Modal */}
                {showAdd && isAdminOrManager && (
                    <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <h3 className="modal-title">Add Staff Member</h3>
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input className="form-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input className="form-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Positions</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                    {POSITIONS.map(pos => (
                                        <button
                                            key={pos}
                                            type="button"
                                            onClick={() => togglePosition(pos)}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: 'var(--radius-md)',
                                                border: form.positions.includes(pos) ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                                                background: form.positions.includes(pos) ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-glass)',
                                                color: form.positions.includes(pos) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: 13,
                                                fontWeight: form.positions.includes(pos) ? 600 : 400,
                                                transition: 'all 150ms ease',
                                            }}
                                        >
                                            {form.positions.includes(pos) ? '✓ ' : ''}{pos}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Monthly Salary ($)</label>
                                <input className="form-input" type="number" value={form.monthlySalary} onChange={e => setForm({ ...form, monthlySalary: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button className="btn btn-primary" disabled={form.positions.length === 0} onClick={addStaff}>Add Staff</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Staff Modal */}
                {editingStaff && isAdminOrManager && (
                    <div className="modal-overlay" onClick={() => setEditingStaff(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <h3 className="modal-title">Edit Staff Member</h3>
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input className="form-input" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input className="form-input" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
                            </div>

                            {/* Role assignment - only visible to ADMIN */}
                            {isAdmin && (
                                <div className="form-group">
                                    <label className="form-label">System Role</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                        {ROLES.map(role => (
                                            <button
                                                key={role.value}
                                                type="button"
                                                onClick={() => setEditForm({ ...editForm, userRole: role.value })}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: editForm.userRole === role.value ? `2px solid ${role.color}` : '1px solid var(--border-primary)',
                                                    background: editForm.userRole === role.value ? `${role.color}22` : 'var(--bg-glass)',
                                                    color: editForm.userRole === role.value ? role.color : 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: 13,
                                                    fontWeight: editForm.userRole === role.value ? 600 : 400,
                                                    transition: 'all 150ms ease',
                                                }}
                                            >
                                                {editForm.userRole === role.value ? '✓ ' : ''}{role.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Positions</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                    {POSITIONS.map(pos => (
                                        <button
                                            key={pos}
                                            type="button"
                                            onClick={() => toggleEditPosition(pos)}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: 'var(--radius-md)',
                                                border: editForm.positions.includes(pos) ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                                                background: editForm.positions.includes(pos) ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-glass)',
                                                color: editForm.positions.includes(pos) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: 13,
                                                fontWeight: editForm.positions.includes(pos) ? 600 : 400,
                                                transition: 'all 150ms ease',
                                            }}
                                        >
                                            {editForm.positions.includes(pos) ? '✓ ' : ''}{pos}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Monthly Salary ($)</label>
                                <input className="form-input" type="number" value={editForm.monthlySalary} onChange={e => setEditForm({ ...editForm, monthlySalary: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setEditingStaff(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveEdit}>💾 Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirm Modal */}
                {confirmDelete !== null && (
                    <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                            <h3 className="modal-title">Remove Staff Member</h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
                                Are you sure you want to remove this staff member? This action cannot be undone.
                            </p>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                <button className="btn btn-danger" onClick={() => deleteStaff(confirmDelete)}>🗑️ Remove</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
