import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function GET() {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER', 'SUPERVISOR');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const periods = await prisma.payoutPeriod.findMany({
            select: { id: true, startDate: true, endDate: true, status: true },
            orderBy: { startDate: 'desc' },
        });
        return NextResponse.json({ periods });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
