import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const chargebacks = await prisma.chargeback.findMany({
            include: {
                user: { select: { firstName: true, lastName: true } },
                model: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ chargebacks });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: Request) {
    try {
        const { subscriberName, userId, modelId, amount, ppvSentDate, chargebackDate } = await req.json();
        const activePeriod = await prisma.payoutPeriod.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });
        const chargeback = await prisma.chargeback.create({
            data: {
                subscriberName,
                userId: parseInt(userId),
                modelId: modelId ? parseInt(modelId) : null,
                amount: parseFloat(amount),
                ppvSentDate: ppvSentDate ? new Date(ppvSentDate) : null,
                chargebackDate: chargebackDate ? new Date(chargebackDate) : null,
                payoutPeriodId: activePeriod?.id,
            },
        });
        return NextResponse.json({ chargeback });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
