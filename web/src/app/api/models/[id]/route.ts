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
        const { commission, status } = await req.json();
        const model = await prisma.onlyFansModel.update({
            where: { id: parseInt(id) },
            data: {
                ...(commission !== undefined && { commission: parseFloat(commission) }),
                ...(status !== undefined && { status }),
            },
        });
        return NextResponse.json({ model });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
    }
}
