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
    const clientName = searchParams.get('clientName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        const where: any = {};
        if (clientName) where.clientName = clientName;
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
        const { clientName, periodStart, periodEnd, paid, amount, status, carryOver, action } = await req.json();

        if (!clientName || !periodStart || !periodEnd) {
            return NextResponse.json({ error: 'clientName, periodStart, periodEnd are required' }, { status: 400 });
        }

        // Handle carry-over action: take unpaid amount from previous period and add to current
        if (action === 'carry_over') {
            const { fromPeriodStart, fromPeriodEnd } = await req.json().catch(() => ({}));

            // Get the source (old unpaid) payment
            const sourcePayment = await prisma.clientPayment.findUnique({
                where: {
                    clientName_periodStart_periodEnd: {
                        clientName,
                        periodStart: new Date(periodStart),
                        periodEnd: new Date(periodEnd),
                    },
                },
            });

            if (sourcePayment && !sourcePayment.paid) {
                const totalDebt = sourcePayment.amount + sourcePayment.carryOver;

                // Mark source as carried over
                await prisma.clientPayment.update({
                    where: { id: sourcePayment.id },
                    data: { status: 'carried_over', paid: false },
                });

                return NextResponse.json({ carriedAmount: totalDebt, sourceId: sourcePayment.id });
            }

            return NextResponse.json({ carriedAmount: 0 });
        }

        // Normal upsert: create or update payment record
        const payment = await prisma.clientPayment.upsert({
            where: {
                clientName_periodStart_periodEnd: {
                    clientName,
                    periodStart: new Date(periodStart),
                    periodEnd: new Date(periodEnd),
                },
            },
            update: {
                ...(paid !== undefined && { paid }),
                ...(status !== undefined && { status }),
                ...(amount !== undefined && { amount }),
                ...(carryOver !== undefined && { carryOver }),
                // When marking as paid, set status to paid
                ...(paid === true && { status: 'paid' }),
                ...(paid === false && { status: 'pending' }),
            },
            create: {
                clientName,
                periodStart: new Date(periodStart),
                periodEnd: new Date(periodEnd),
                paid: paid ?? false,
                status: paid ? 'paid' : (status || 'pending'),
                amount: amount ?? 0,
                carryOver: carryOver ?? 0,
            },
        });

        return NextResponse.json({ payment });
    } catch (error) {
        console.error('Client payment toggle error:', error);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }
}
