import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

type Role = 'FOUNDER' | 'ADMIN' | 'MANAGER' | 'FINANCE_MANAGER' | 'SUPERVISOR' | 'CHATTER' | 'MASS_PPV_ENGINEER';

/**
 * Check if the current user has one of the allowed roles.
 * Returns { authorized: true, session, role } or { authorized: false, response }.
 */
export async function requireRole(...allowedRoles: Role[]) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { authorized: false as const, response: { error: 'Unauthorized' }, status: 401 };
    }

    const role = (session.user as any)?.role as Role | undefined;
    if (!role || !allowedRoles.includes(role)) {
        return { authorized: false as const, response: { error: 'Forbidden' }, status: 403 };
    }

    return { authorized: true as const, session, role, userId: (session.user as any)?.id };
}

/**
 * Check if user is at least authenticated (any role).
 */
export async function requireAuth() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { authorized: false as const, response: { error: 'Unauthorized' }, status: 401 };
    }

    const role = (session.user as any)?.role as Role;
    const userId = (session.user as any)?.id;
    return { authorized: true as const, session, role, userId };
}
