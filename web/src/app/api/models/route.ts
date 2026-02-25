import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const models = await prisma.onlyFansModel.findMany({
            select: { id: true, name: true, status: true },
            orderBy: { name: 'asc' },
        });
        return NextResponse.json({ models });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
