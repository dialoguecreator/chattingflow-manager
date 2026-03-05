import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function GET() {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER', 'SUPERVISOR');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const chargebacks = await prisma.chargeback.findMany({
            include: {
                user: { select: { firstName: true, lastName: true } },
                model: { select: { name: true } },
                payoutPeriod: { select: { startDate: true, endDate: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ chargebacks });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: Request) {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER', 'SUPERVISOR');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const { subscriberName, userId, userIds, modelId, amount, ppvSentDate, chargebackDate, payoutPeriodId } = await req.json();

        let periodId = payoutPeriodId ? parseInt(payoutPeriodId) : undefined;
        if (!periodId) {
            const activePeriod = await prisma.payoutPeriod.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });
            periodId = activePeriod?.id;
        }

        // Support multiple chatters - split amount equally
        const ids: number[] = userIds?.length > 0
            ? userIds.map((id: string) => parseInt(id))
            : userId ? [parseInt(userId)] : [];

        if (ids.length === 0) {
            return NextResponse.json({ error: 'At least one chatter is required' }, { status: 400 });
        }

        const splitAmount = parseFloat(amount) / ids.length;

        const chargebacks = await Promise.all(
            ids.map(uid =>
                prisma.chargeback.create({
                    data: {
                        subscriberName,
                        userId: uid,
                        modelId: modelId ? parseInt(modelId) : null,
                        amount: splitAmount,
                        ppvSentDate: ppvSentDate ? new Date(ppvSentDate) : null,
                        chargebackDate: chargebackDate ? new Date(chargebackDate) : null,
                        payoutPeriodId: periodId,
                    },
                })
            )
        );

        return NextResponse.json({ chargebacks });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
