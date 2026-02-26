import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = parseInt(id);
    const body = await req.json();

    try {
        const updateData: any = {};
        if (body.commissionNet !== undefined) updateData.commissionNet = body.commissionNet;
        if (body.commissionGross !== undefined) updateData.commissionGross = body.commissionGross;
        if (body.status !== undefined) updateData.status = body.status;

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });
        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// Archive chatter (mark as FIRED) instead of deleting
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = parseInt(id);

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { status: 'FIRED' },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Archive chatter error:', error);
        return NextResponse.json({ error: 'Failed to archive' }, { status: 500 });
    }
}
