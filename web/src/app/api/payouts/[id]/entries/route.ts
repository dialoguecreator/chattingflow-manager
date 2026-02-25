import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const periodId = parseInt(id);

    try {
        const entries = await prisma.payoutEntry.findMany({
            where: { payoutPeriodId: periodId },
            include: {
                user: {
                    select: {
                        firstName: true, lastName: true, discordUsername: true, role: true,
                        staffProfile: { select: { position: true } },
                    },
                },
            },
            orderBy: { netPayout: 'desc' },
        });

        return NextResponse.json({ entries });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json();

    try {
        const entry = await prisma.payoutEntry.update({
            where: { id: parseInt(body.entryId) },
            data: { paid: body.paid },
        });
        return NextResponse.json({ entry });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
