'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { ReactNode } from 'react';

const navItems = [
    { label: 'Overview', href: '/dashboard', icon: '📊' },
    { section: 'Financial' },
    { label: 'Invoices', href: '/dashboard/invoices', icon: '🧾' },
    { label: 'Revenue', href: '/dashboard/revenue', icon: '💰', adminOnly: true },
    { label: 'Payouts', href: '/dashboard/payouts', icon: '💸', adminOnly: true },
    { label: 'Chargebacks', href: '/dashboard/chargebacks', icon: '↩️' },
    { label: 'Mass PPVs', href: '/dashboard/mass-ppvs', icon: '📨' },
    { label: 'Models', href: '/dashboard/models', icon: '🏷️', superAdminOnly: true },
    { section: 'People' },
    { label: 'Chatters', href: '/dashboard/chatters', icon: '💬' },
    { label: 'Staff', href: '/dashboard/staff', icon: '👥' },
    { label: 'Punishments', href: '/dashboard/punishments', icon: '⚖️' },
    { section: 'Settings' },
    { label: 'Settings', href: '/dashboard/settings', icon: '⚙️', adminOnly: true },
    { label: 'Invite Member', href: '/dashboard/invite', icon: '🔗', adminOnly: true },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role || '';
    const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER';
    const isAdmin = userRole === 'ADMIN';

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <svg className="dialogue-logo" viewBox="0 0 220 60" width="180" height="48">
                            <defs>
                                <filter id="neon-glow">
                                    <feGaussianBlur stdDeviation="2" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <text
                                className="dialogue-text"
                                x="10" y="42"
                                filter="url(#neon-glow)"
                            >
                                Dialogue
                            </text>
                        </svg>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map((item, i) => {
                        if ('section' in item) {
                            return <div key={i} className="nav-section-label">{item.section}</div>;
                        }
                        // Hide super-admin-only items (ADMIN only)
                        if (item.superAdminOnly && !isAdmin) {
                            return null;
                        }
                        // Hide admin-only items for non-admin/non-manager users
                        if (item.adminOnly && !isAdminOrManager) {
                            return null;
                        }
                        const isActive = pathname === item.href ||
                            (item.href !== '/dashboard' && pathname?.startsWith(item.href!));
                        return (
                            <Link
                                key={item.href}
                                href={item.href!}
                                className={`nav-link ${isActive ? 'active' : ''}`}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div style={{ padding: '16px', borderTop: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        {session?.user?.name}
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="btn btn-secondary btn-sm w-full"
                        style={{ justifyContent: 'center' }}
                    >
                        Sign Out
                    </button>
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
