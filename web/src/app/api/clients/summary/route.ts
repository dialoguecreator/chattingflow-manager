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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        // Get all active models with client names
        const models = await prisma.onlyFansModel.findMany({
            where: { status: 'ACTIVE', clientName: { not: null } },
            orderBy: { clientName: 'asc' },
        });

        // Build date filter for invoices
        const dateFilter: any = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        // Get invoices
        const invoices = await prisma.invoice.findMany({
            where: dateFilter,
            select: { modelId: true, splitAmount: true },
        });

        // Group models by client
        const clientMap: Record<string, { models: any[]; totalRevenue: number; totalCommission: number }> = {};

        for (const model of models) {
            const cn = model.clientName!;
            if (!clientMap[cn]) {
                clientMap[cn] = { models: [], totalRevenue: 0, totalCommission: 0 };
            }

            const modelInvoices = invoices.filter(inv => inv.modelId === model.id);
            const totalSales = modelInvoices.reduce((sum, inv) => sum + inv.splitAmount, 0);
            const commissionEarnings = totalSales * ((model.commission || 0) / 100);

            clientMap[cn].models.push({
                id: model.id,
                name: model.name,
                commission: model.commission,
                totalSales,
                commissionEarnings,
                invoiceCount: modelInvoices.length,
            });
            clientMap[cn].totalRevenue += totalSales;
            clientMap[cn].totalCommission += commissionEarnings;
        }

        const clients = Object.entries(clientMap).map(([name, data]) => ({
            clientName: name,
            ...data,
        }));

        return NextResponse.json({ clients });
    } catch (error) {
        console.error('Client summary error:', error);
        return NextResponse.json({ error: 'Failed to fetch client summary' }, { status: 500 });
    }
}
