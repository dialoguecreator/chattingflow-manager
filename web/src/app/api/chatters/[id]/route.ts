import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = parseInt(id);
    const body = await req.json();

    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                commissionNet: body.commissionNet,
                commissionGross: body.commissionGross,
            },
        });
        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = parseInt(id);

    try {
        // Delete related records first
        await prisma.payoutEntry.deleteMany({ where: { userId } });
        await prisma.breakRecord.deleteMany({ where: { userId } });
        await prisma.invoice.deleteMany({ where: { userId } });
        await prisma.clockRecord.deleteMany({ where: { userId } });
        await prisma.punishment.deleteMany({ where: { userId } });
        await prisma.staff.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete chatter error:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
