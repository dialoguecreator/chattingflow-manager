import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/apiAuth';

function getPeriodDates(period: string | null): { from: Date | null; to: Date } {
    const now = new Date();
    if (!period || period === 'all') return { from: null, to: now };

    const ms: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '14d': 14 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const diff = ms[period];
    if (!diff) return { from: null, to: now };

    return { from: new Date(now.getTime() - diff), to: now };
}

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period');
    const { from } = getPeriodDates(period);

    try {
        const dateFilter = from ? { createdAt: { gte: from } } : {};
        const clockDateFilter = from ? { clockIn: { gte: from } } : {};

        const [totalInvoices, activeShifts, totalChatters, revenueResult] = await Promise.all([
            prisma.invoice.count({ where: dateFilter }),
            prisma.clockRecord.count({ where: { status: 'ACTIVE', ...clockDateFilter } }),
            prisma.user.count({ where: { role: 'CHATTER' } }),
            prisma.invoice.aggregate({ _sum: { splitAmount: true }, where: dateFilter }),
        ]);

        return NextResponse.json({
            totalRevenue: revenueResult._sum.splitAmount || 0,
            activeShifts,
            totalChatters,
            totalInvoices,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
    }
}
