import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const inviteId = parseInt(id);
    const body = await req.json();

    try {
        const invite = await prisma.inviteToken.update({
            where: { id: inviteId },
            data: { paused: body.paused },
        });
        return NextResponse.json({ invite });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const inviteId = parseInt(id);

    try {
        await prisma.inviteToken.delete({ where: { id: inviteId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
