import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const invoiceId = parseInt(id);

    try {
        const body = await req.json();
        const { totalGross, splitCount, splitAmount, shiftSummary } = body;

        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                ...(totalGross !== undefined && { totalGross: parseFloat(totalGross) }),
                ...(splitCount !== undefined && { splitCount: parseInt(splitCount) }),
                ...(splitAmount !== undefined && { splitAmount: parseFloat(splitAmount) }),
                ...(shiftSummary !== undefined && { shiftSummary }),
            },
        });

        return NextResponse.json({ invoice: updated });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const invoiceId = parseInt(id);

    try {
        await prisma.invoice.delete({ where: { id: invoiceId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
    }
}
