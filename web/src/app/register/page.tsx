'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RegisterForm() {
    const [form, setForm] = useState({ email: '', username: '', password: '', firstName: '', lastName: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, inviteToken: token }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            router.push('/login');
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [field]: e.target.value }));

    if (!token) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-logo">
                        <div className="auth-logo-icon">OF</div>
                        <div className="auth-logo-title">Registration</div>
                        <div className="auth-logo-subtitle">You need an invite link to register</div>
                    </div>
                    <div className="auth-error">
                        No invite token provided. Please use the invite link sent to you.
                    </div>
                    <div className="auth-footer">
                        Already have an account? <a href="/login">Sign in</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon">OF</div>
                    <div className="auth-logo-title">Create Account</div>
                    <div className="auth-logo-subtitle">Join the agency management platform</div>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label className="form-label">First Name</label>
                            <input className="form-input" value={form.firstName} onChange={update('firstName')} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Last Name</label>
                            <input className="form-input" value={form.lastName} onChange={update('lastName')} required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" value={form.email} onChange={update('email')} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input className="form-input" value={form.username} onChange={update('username')} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input type="password" className="form-input" value={form.password} onChange={update('password')} required minLength={6} />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account? <a href="/login">Sign in</a>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="auth-page"><p>Loading...</p></div>}>
            <RegisterForm />
        </Suspense>
    );
}
