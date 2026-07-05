'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    const [needs2fa, setNeeds2fa] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await signIn('credentials', {
            email,
            password,
            token,
            redirect: false,
        });

        if (result?.error) {
            if (result.error === '2FA_REQUIRED') {
                // Password was correct; this account needs a 2FA code.
                setNeeds2fa(true);
                setError('');
            } else if (result.error === 'INVALID_2FA') {
                setError('Invalid 2FA code. Enter the current 6-digit code or a backup code.');
            } else if (result.error === 'ACCOUNT_FIRED') {
                setError('Kibo jebi se - Deni');
            } else {
                setError('Invalid email or password');
            }
            setLoading(false);
        } else {
            router.push('/dashboard');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon">OF</div>
                    <div className="auth-logo-title">OF MGMT CRM</div>
                    <div className="auth-logo-subtitle">Agency Management Dashboard</div>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@agency.com"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            disabled={needs2fa}
                        />
                    </div>
                    {needs2fa && (
                        <div className="form-group">
                            <label className="form-label">Two-factor code</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                className="form-input"
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                placeholder="6-digit code or backup code"
                                required
                                autoFocus
                            />
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? (needs2fa ? 'Verifying...' : 'Signing in...') : (needs2fa ? 'Verify code' : 'Sign In')}
                    </button>
                </form>

                <div className="auth-footer">
                    Got an invite? <a href="/register">Create an account</a>
                </div>
            </div>
        </div>
    );
}
