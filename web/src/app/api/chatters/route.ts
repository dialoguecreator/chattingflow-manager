import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const chatters = await prisma.user.findMany({
            where: { role: 'CHATTER' },
            select: {
                id: true, firstName: true, lastName: true, username: true,
                discordUsername: true, discordId: true,
                commissionNet: true, commissionGross: true,
            },
            orderBy: { firstName: 'asc' },
        });
        return NextResponse.json({ chatters });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
