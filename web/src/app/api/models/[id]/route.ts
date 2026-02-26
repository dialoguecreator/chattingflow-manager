import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    try {
        const { commission, status, name } = await req.json();
        const model = await prisma.onlyFansModel.update({
            where: { id: parseInt(id) },
            data: {
                ...(commission !== undefined && { commission: parseFloat(commission) }),
                ...(status !== undefined && { status }),
                ...(name !== undefined && { name }),
            },
        });
        return NextResponse.json({ model });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    try {
        await prisma.onlyFansModel.delete({ where: { id: parseInt(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete model. It may have related records.' }, { status: 500 });
    }
}
