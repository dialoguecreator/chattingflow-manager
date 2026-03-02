import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string; entryId: string }> }
) {
    const { id, entryId } = await params;
    const periodId = parseInt(id);
    const entryIdNum = parseInt(entryId);

    try {
        // Get the entry to find the userId
        const entry = await prisma.payoutEntry.findUnique({
            where: { id: entryIdNum },
        });
        if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

        // Get the period for date range
        const period = await prisma.payoutPeriod.findUnique({
            where: { id: periodId },
        });
        if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });

        // Get all invoices for this user within the period
        const invoices = await prisma.invoice.findMany({
            where: {
                userId: entry.userId,
                clockRecord: {
                    clockOut: { gte: period.startDate, lte: period.endDate },
                },
            },
            include: {
                model: { select: { name: true } },
                clockRecord: { select: { clockIn: true, clockOut: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ invoices });
    } catch (error) {
        console.error('Fetch invoices error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
