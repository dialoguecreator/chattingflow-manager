import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const [totalInvoices, activeShifts, totalChatters, revenueResult] = await Promise.all([
            prisma.invoice.count(),
            prisma.clockRecord.count({ where: { status: 'ACTIVE' } }),
            prisma.user.count({ where: { role: 'CHATTER' } }),
            prisma.invoice.aggregate({ _sum: { splitAmount: true } }),
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
