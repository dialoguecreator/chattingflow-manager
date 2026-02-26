import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const { subscriberName, userId, modelId, amount, ppvSentDate, chargebackDate } = await req.json();
        const chargeback = await prisma.chargeback.update({
            where: { id: parseInt(id) },
            data: {
                ...(subscriberName !== undefined && { subscriberName }),
                ...(userId !== undefined && { userId: parseInt(userId) }),
                ...(modelId !== undefined && { modelId: modelId ? parseInt(modelId) : null }),
                ...(amount !== undefined && { amount: parseFloat(amount) }),
                ...(ppvSentDate !== undefined && { ppvSentDate: ppvSentDate ? new Date(ppvSentDate) : null }),
                ...(chargebackDate !== undefined && { chargebackDate: chargebackDate ? new Date(chargebackDate) : null }),
            },
        });
        return NextResponse.json({ chargeback });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update chargeback' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        await prisma.chargeback.delete({ where: { id: parseInt(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete chargeback' }, { status: 500 });
    }
}
