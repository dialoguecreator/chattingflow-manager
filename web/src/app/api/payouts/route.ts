import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const periods = await prisma.payoutPeriod.findMany({
            include: {
                _count: { select: { entries: true, invoices: true } },
            },
            orderBy: { startDate: 'desc' },
        });

        // Also get total gross for each period from invoices
        const enriched = await Promise.all(periods.map(async (p) => {
            const invoices = await prisma.invoice.findMany({
                where: {
                    clockRecord: {
                        clockOut: { gte: p.startDate, lte: p.endDate },
                    },
                },
            });
            const totalGross = invoices.reduce((sum, inv) => sum + inv.splitAmount, 0);
            return { ...p, totalGross };
        }));

        return NextResponse.json({ periods: enriched });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);

        let startDate: Date, endDate: Date, bufferEnd: Date;

        if (body?.startDate && body?.endDate) {
            // Manual period creation with custom dates
            startDate = new Date(body.startDate);
            endDate = new Date(body.endDate);
            bufferEnd = new Date(endDate.getTime() + 60 * 60 * 1000); // +1h buffer
        } else {
            // Auto: next Monday 6PM CET bi-weekly
            const now = new Date();
            const dayOfWeek = now.getUTCDay();
            const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;

            startDate = new Date(now);
            startDate.setUTCDate(now.getUTCDate() + daysUntilMonday);
            startDate.setUTCHours(17, 0, 0, 0);

            endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 14);

            bufferEnd = new Date(endDate);
            bufferEnd.setUTCHours(18, 0, 0, 0);
        }

        const period = await prisma.payoutPeriod.create({
            data: { startDate, endDate, bufferEnd },
        });

        return NextResponse.json({ period });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
