import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const periodId = parseInt(id);

    try {
        const entries = await prisma.payoutEntry.findMany({
            where: { payoutPeriodId: periodId },
            include: {
                user: {
                    select: {
                        firstName: true, lastName: true, discordUsername: true, role: true,
                        staffProfile: { select: { position: true } },
                    },
                },
            },
            orderBy: { netPayout: 'desc' },
        });

        return NextResponse.json({ entries });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json();

    try {
        const entryId = parseInt(body.entryId);

        // If updating paid status only
        if (body.paid !== undefined && body.bonus === undefined) {
            const entry = await prisma.payoutEntry.update({
                where: { id: entryId },
                data: { paid: body.paid },
            });
            return NextResponse.json({ entry });
        }

        // If updating bonus — recalculate netPayout
        if (body.bonus !== undefined) {
            const existing = await prisma.payoutEntry.findUnique({ where: { id: entryId } });
            if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

            const bonus = parseFloat(body.bonus) || 0;
            const afterChargebacks = existing.totalGross - existing.chargebackDeductions;
            const commissionEarnings = afterChargebacks * (existing.commissionRate / 100);
            const beforeFee = commissionEarnings - existing.punishmentDeductions + bonus;
            const feeAmount = beforeFee > 0 ? beforeFee * (existing.feePercent / 100) : 0;
            const netPayout = (beforeFee - feeAmount) + existing.staffSalary;

            const entry = await prisma.payoutEntry.update({
                where: { id: entryId },
                data: { bonus, massPPVEarnings: bonus, feeAmount, netPayout },
            });
            return NextResponse.json({ entry });
        }

        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
