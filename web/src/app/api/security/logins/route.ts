import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

// GET /api/security/logins
// The login audit trail — every attempt with source IP and device.
// This is the "Login Activity" (devices & IP addresses) data source.
// Only records attempts made AFTER this feature was deployed.
export async function GET(req: Request) {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 2000);

    const audits = await prisma.loginAudit.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { email: true, firstName: true, lastName: true, role: true } } },
    });

    // Group successful logins by (account + IP + device) so you can see which
    // devices/locations each account has been used from.
    const deviceMap = new Map<string, {
        email: string;
        role: string | null;
        ipAddress: string;
        userAgent: string;
        successCount: number;
        lastSeen: Date;
        firstSeen: Date;
    }>();

    for (const a of audits) {
        if (!a.success) continue;
        const key = `${a.email}||${a.ipAddress}||${a.userAgent}`;
        const existing = deviceMap.get(key);
        if (existing) {
            existing.successCount += 1;
            if (a.createdAt > existing.lastSeen) existing.lastSeen = a.createdAt;
            if (a.createdAt < existing.firstSeen) existing.firstSeen = a.createdAt;
        } else {
            deviceMap.set(key, {
                email: a.email,
                role: a.user?.role ?? null,
                ipAddress: a.ipAddress,
                userAgent: a.userAgent,
                successCount: 1,
                lastSeen: a.createdAt,
                firstSeen: a.createdAt,
            });
        }
    }

    const devices = Array.from(deviceMap.values()).sort(
        (x, y) => y.lastSeen.getTime() - x.lastSeen.getTime()
    );

    return NextResponse.json({
        devices,
        recentAttempts: audits.map((a) => ({
            id: a.id,
            email: a.email,
            success: a.success,
            reason: a.reason,
            ipAddress: a.ipAddress,
            userAgent: a.userAgent,
            createdAt: a.createdAt,
            role: a.user?.role ?? null,
        })),
    });
}
