import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const { id } = await params;
    const body = await req.json();

    try {
        const punishment = await prisma.punishment.update({
            where: { id: parseInt(id) },
            data: { revoked: body.revoked },
        });
        return NextResponse.json({ punishment });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
