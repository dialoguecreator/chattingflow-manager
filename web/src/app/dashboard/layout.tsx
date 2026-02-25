'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { ReactNode } from 'react';

const navItems = [
    { label: 'Overview', href: '/dashboard', icon: '📊' },
    { section: 'Financial' },
    { label: 'Invoices', href: '/dashboard/invoices', icon: '🧾' },
    { label: 'Payouts', href: '/dashboard/payouts', icon: '💸' },
    { label: 'Chargebacks', href: '/dashboard/chargebacks', icon: '↩️' },
    { label: 'Mass PPVs', href: '/dashboard/mass-ppvs', icon: '📨' },
    { section: 'People' },
    { label: 'Chatters', href: '/dashboard/chatters', icon: '💬' },
    { label: 'Staff', href: '/dashboard/staff', icon: '👥' },
    { label: 'Punishments', href: '/dashboard/punishments', icon: '⚖️' },
    { section: 'Settings' },
    { label: 'Invite Member', href: '/dashboard/invite', icon: '🔗' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">OF</div>
                        <div className="sidebar-logo-text">MGMT CRM</div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map((item, i) => {
                        if ('section' in item) {
                            return <div key={i} className="nav-section-label">{item.section}</div>;
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
