import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function GET() {
    const auth = await requireRole('ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const punishments = await prisma.punishment.findMany({
            include: {
                user: { select: { firstName: true, lastName: true } },
                payoutPeriod: { select: { id: true, startDate: true, endDate: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ punishments });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: Request) {
    const auth = await requireRole('ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const { userId, amount, reason, payoutPeriodId } = await req.json();

        // Use selected period, or fallback to active period
        let periodId: number | undefined;
        if (payoutPeriodId) {
            periodId = parseInt(payoutPeriodId);
        } else {
            const activePeriod = await prisma.payoutPeriod.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });
            periodId = activePeriod?.id;
        }

        const punishment = await prisma.punishment.create({
            data: { userId: parseInt(userId), amount: parseFloat(amount), reason, payoutPeriodId: periodId },
        });
        return NextResponse.json({ punishment });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
