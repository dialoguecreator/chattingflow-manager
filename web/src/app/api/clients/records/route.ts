import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clientName = searchParams.get('clientName');

    try {
        const where: any = {};
        if (clientName) where.clientName = clientName;

        const records = await prisma.clientPaymentRecord.findMany({
            where,
            orderBy: { receivedAt: 'desc' },
        });

        return NextResponse.json({ records });
    } catch (error) {
        console.error('Client payment records error:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { clientName, amount, periodFrom, periodTo, receivedAt, note } = await req.json();

        if (!clientName || amount === undefined || !periodFrom || !periodTo) {
            return NextResponse.json({ error: 'clientName, amount, periodFrom, periodTo are required' }, { status: 400 });
        }

        const record = await prisma.clientPaymentRecord.create({
            data: {
                clientName,
                amount: parseFloat(amount),
                periodFrom: new Date(periodFrom),
                periodTo: new Date(periodTo),
                receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
                note: note || null,
            },
        });

        return NextResponse.json({ record });
    } catch (error) {
        console.error('Create payment record error:', error);
        return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        await prisma.clientPaymentRecord.delete({ where: { id: parseInt(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete payment record error:', error);
        return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
}
