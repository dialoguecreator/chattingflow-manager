import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuid } from 'uuid';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const invites = await prisma.inviteToken.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return NextResponse.json({ invites });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userId = (session.user as any).id;
        const token = uuid();

        await prisma.inviteToken.create({
            data: {
                token,
                createdById: userId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        return NextResponse.json({ token });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
