import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    try {
        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, username: true, discordUsername: true } },
                    model: { select: { id: true, name: true } },
                    clockRecord: { select: { clockIn: true, clockOut: true, shiftType: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.invoice.count(),
        ]);

        // Find split partners
        const enriched = await Promise.all(invoices.map(async (inv) => {
            let splitPartner = null;
            if (inv.splitCount > 1) {
                const partner = await prisma.invoice.findFirst({
                    where: {
                        modelId: inv.modelId,
                        totalGross: inv.totalGross,
                        splitCount: inv.splitCount,
                        userId: { not: inv.userId },
                        clockRecord: { clockOut: inv.clockRecord?.clockOut },
                    },
                    include: {
                        user: { select: { firstName: true, lastName: true, discordUsername: true } },
                    },
                });
                if (partner) {
                    splitPartner = {
                        name: `${partner.user.firstName} ${partner.user.lastName}`.trim(),
                        username: partner.user.discordUsername,
                    };
                }
            }
            return { ...inv, splitPartner };
        }));

        return NextResponse.json({
            invoices: enriched,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { userId, modelId, clockIn, clockOut, totalGross, splitCount, shiftSummary } = await req.json();

        const splits = parseInt(splitCount) || 1;
        const gross = parseFloat(totalGross) || 0;
        const splitAmount = gross / splits;

        // Find guild for this model
        const model = await prisma.onlyFansModel.findUnique({ where: { id: parseInt(modelId) } });
        if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 });

        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Create clock record
        const clockRecord = await prisma.clockRecord.create({
            data: {
                userId: parseInt(userId),
                modelId: parseInt(modelId),
                guildId: model.guildId,
                discordUserId: user.discordId || `manual_${user.id}`,
                clockIn: new Date(clockIn),
                clockOut: new Date(clockOut),
                status: 'COMPLETED',
            },
        });

        // Create invoice
        const invoice = await prisma.invoice.create({
            data: {
                clockRecordId: clockRecord.id,
                userId: parseInt(userId),
                modelId: parseInt(modelId),
                totalGross: gross,
                splitCount: splits,
                splitAmount,
                shiftSummary: shiftSummary || null,
            },
        });

        return NextResponse.json({ invoice });
    } catch (error) {
        console.error('Manual invoice creation error:', error);
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }
}
