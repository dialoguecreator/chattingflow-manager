import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const { price, buyerCount, description } = await req.json();
        const priceNum = parseFloat(price);
        const buyers = parseInt(buyerCount);
        const totalSales = priceNum * buyers;
        const commissionAmount = totalSales * 0.048;

        const massPPV = await prisma.massPPV.update({
            where: { id: parseInt(id) },
            data: {
                ...(price !== undefined && { price: priceNum }),
                ...(buyerCount !== undefined && { buyerCount: buyers }),
                ...(description !== undefined && { description }),
                totalSales,
                commissionAmount,
            },
        });
        return NextResponse.json({ massPPV });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        await prisma.massPPV.delete({ where: { id: parseInt(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
