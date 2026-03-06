import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });
    const { id } = await params;
    const periodId = parseInt(id);

    try {
        const period = await prisma.payoutPeriod.findUnique({ where: { id: periodId } });
        if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Get all invoices where clock-out falls within the period
        const invoices = await prisma.invoice.findMany({
            where: {
                clockRecord: {
                    clockOut: { gte: period.startDate, lte: period.endDate },
                },
            },
            include: { user: true },
        });

        // Aggregate per user
        const userTotals: Record<number, { gross: number; commissionRate: number }> = {};
        for (const inv of invoices) {
            if (!userTotals[inv.userId]) {
                userTotals[inv.userId] = { gross: 0, commissionRate: inv.user.commissionGross };
            }
            userTotals[inv.userId].gross += inv.splitAmount;
        }

        // Get chargebacks
        const chargebacks = await prisma.chargeback.findMany({
            where: { payoutPeriodId: periodId },
        });
        const cbByUser: Record<number, number> = {};
        for (const cb of chargebacks) {
            cbByUser[cb.userId] = (cbByUser[cb.userId] || 0) + cb.amount;
        }

        // Get punishments (exclude revoked)
        const punishments = await prisma.punishment.findMany({
            where: { payoutPeriodId: periodId, revoked: false },
        });
        const punByUser: Record<number, number> = {};
        for (const p of punishments) {
            punByUser[p.userId] = (punByUser[p.userId] || 0) + p.amount;
        }

        // Get mass PPV earnings
        const massPPVs = await prisma.massPPV.findMany({
            where: { payoutPeriodId: periodId },
        });
        const ppvByUser: Record<number, number> = {};
        for (const ppv of massPPVs) {
            ppvByUser[ppv.sentById] = (ppvByUser[ppv.sentById] || 0) + ppv.commissionAmount;
        }

        // Get staff salaries
        const staff = await prisma.staff.findMany({ include: { user: true } });
        const staffByUser: Record<number, number> = {};
        for (const s of staff) {
            staffByUser[s.userId] = s.monthlySalary / 2;
        }

        // Collect all user IDs
        const allUserIds = new Set<number>([
            ...Object.keys(userTotals).map(Number),
            ...Object.keys(cbByUser).map(Number),
            ...Object.keys(punByUser).map(Number),
            ...Object.keys(ppvByUser).map(Number),
            ...Object.keys(staffByUser).map(Number),
        ]);

        // Create/update payout entries
        // Formula: (((Total Sales - Chargebacks) * commission%) - punishment + bonus) - 5% Fee
        for (const userId of allUserIds) {
            const totalGross = userTotals[userId]?.gross || 0;
            const commissionRate = userTotals[userId]?.commissionRate || 4.0;
            const chargebackDeductions = cbByUser[userId] || 0;
            const punishmentDeductions = punByUser[userId] || 0;
            const massPPVEarnings = ppvByUser[userId] || 0; // bonus
            const salary = staffByUser[userId] || 0;
            const isStaff = staffByUser[userId] !== undefined;

            // Fetch user's fee preference
            const userRecord = await prisma.user.findUnique({
                where: { id: userId },
            });
            // Staff never pay fee; chatters respect their hasFee setting
            const userHasFee = (userRecord as any)?.hasFee ?? true;
            const feePercent = (isStaff || !userHasFee) ? 0 : 5.0;
            console.log(`[CALC] userId=${userId} isStaff=${isStaff} hasFee=${userHasFee} => feePercent=${feePercent}`);

            // Check if entry already exists (to preserve manually-set bonus)
            const existing = await prisma.payoutEntry.findUnique({
                where: { payoutPeriodId_userId: { payoutPeriodId: periodId, userId } },
            });

            // Preserve manually-set bonus if it exists, otherwise use massPPVEarnings
            const bonus = existing ? existing.bonus : massPPVEarnings;

            // Step 1: Total Sales - Chargebacks
            const afterChargebacks = totalGross - chargebackDeductions;

            // Step 2: × commission%
            const commissionEarnings = afterChargebacks * (commissionRate / 100);

            // Step 3: - punishment + bonus
            const beforeFee = commissionEarnings - punishmentDeductions + bonus;

            // Step 4: - 5% fee
            const feeAmount = beforeFee > 0 ? beforeFee * (feePercent / 100) : 0;

            // Final payout + staff salary
            const netPayout = (beforeFee - feeAmount) + salary;

            await prisma.payoutEntry.upsert({
                where: { payoutPeriodId_userId: { payoutPeriodId: periodId, userId } },
                update: {
                    totalGross, commissionRate, commissionEarnings,
                    chargebackDeductions, punishmentDeductions, massPPVEarnings,
                    bonus, feePercent, feeAmount,
                    staffSalary: salary, netPayout,
                },
                create: {
                    payoutPeriodId: periodId, userId,
                    totalGross, commissionRate, commissionEarnings,
                    chargebackDeductions, punishmentDeductions, massPPVEarnings,
                    bonus: massPPVEarnings, feePercent, feeAmount,
                    staffSalary: salary, netPayout,
                },
            });
        }

        // Link invoices to period
        await prisma.invoice.updateMany({
            where: {
                clockRecord: { clockOut: { gte: period.startDate, lte: period.endDate } },
                payoutPeriodId: null,
            },
            data: { payoutPeriodId: periodId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Payout calculation error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
