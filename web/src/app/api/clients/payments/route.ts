import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        const where: any = {};
        if (startDate && endDate) {
            where.periodStart = { gte: new Date(startDate) };
            where.periodEnd = { lte: new Date(endDate) };
        }

        const payments = await prisma.clientPayment.findMany({
            where,
            orderBy: [{ periodStart: 'desc' }, { clientName: 'asc' }],
        });

        return NextResponse.json({ payments });
    } catch (error) {
        console.error('Client payments error:', error);
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { clientName, periodStart, periodEnd, paid, amount } = await req.json();

        if (!clientName || !periodStart || !periodEnd) {
            return NextResponse.json({ error: 'clientName, periodStart, periodEnd are required' }, { status: 400 });
        }

        const payment = await prisma.clientPayment.upsert({
            where: {
                clientName_periodStart_periodEnd: {
                    clientName,
                    periodStart: new Date(periodStart),
                    periodEnd: new Date(periodEnd),
                },
            },
            update: {
                paid: paid ?? false,
                ...(amount !== undefined && { amount }),
            },
            create: {
                clientName,
                periodStart: new Date(periodStart),
                periodEnd: new Date(periodEnd),
                paid: paid ?? false,
                amount: amount ?? 0,
            },
        });

        return NextResponse.json({ payment });
    } catch (error) {
        console.error('Client payment toggle error:', error);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }
}
