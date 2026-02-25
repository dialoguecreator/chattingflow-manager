import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const massPPVs = await prisma.massPPV.findMany({
            include: {
                sentBy: { select: { firstName: true, lastName: true } },
                model: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ massPPVs });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: Request) {
    try {
        const { sentById, modelId, price, buyerCount, description } = await req.json();
        const priceNum = parseFloat(price);
        const buyers = parseInt(buyerCount);
        const totalSales = priceNum * buyers;
        const commissionAmount = totalSales * 0.048; // 4.8% gross

        const activePeriod = await prisma.payoutPeriod.findFirst({ where: { status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });

        const massPPV = await prisma.massPPV.create({
            data: {
                sentById: parseInt(sentById),
                modelId: parseInt(modelId),
                price: priceNum,
                buyerCount: buyers,
                description,
                totalSales,
                commissionAmount,
                payoutPeriodId: activePeriod?.id,
            },
        });
        return NextResponse.json({ massPPV });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
