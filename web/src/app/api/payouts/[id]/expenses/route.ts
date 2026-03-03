import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const { id } = await params;
    const periodId = parseInt(id);

    try {
        const expenses = await prisma.payoutExpense.findMany({
            where: { payoutPeriodId: periodId },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ expenses });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const { id } = await params;
    const periodId = parseInt(id);

    try {
        const body = await req.json();
        const { description, amount } = body;

        if (!description?.trim()) {
            return NextResponse.json({ error: 'Description is required' }, { status: 400 });
        }
        if (typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
        }

        const expense = await prisma.payoutExpense.create({
            data: {
                payoutPeriodId: periodId,
                description: description.trim(),
                amount,
            },
        });
        return NextResponse.json({ expense });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const { searchParams } = new URL(req.url);
        const expenseId = parseInt(searchParams.get('expenseId') || '0');
        if (!expenseId) return NextResponse.json({ error: 'Missing expenseId' }, { status: 400 });

        await prisma.payoutExpense.delete({ where: { id: expenseId } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
