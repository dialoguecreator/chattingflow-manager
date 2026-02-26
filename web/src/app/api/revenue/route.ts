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
        // Get all models
        const models = await prisma.onlyFansModel.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { name: 'asc' },
        });

        // Build date filter
        const dateFilter: any = {};
        if (startDate && endDate) {
            dateFilter.clockRecord = {
                clockOut: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                },
            };
        }

        // Get invoices grouped by model
        const invoices = await prisma.invoice.findMany({
            where: dateFilter,
            select: {
                modelId: true,
                totalGross: true,
            },
        });

        // Get chargebacks grouped by model
        const chargebackFilter: any = {};
        if (startDate && endDate) {
            chargebackFilter.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        const chargebacks = await prisma.chargeback.findMany({
            where: chargebackFilter,
            select: {
                modelId: true,
                amount: true,
            },
        });

        // Aggregate per model
        const modelRevenue = models.map(model => {
            const modelInvoices = invoices.filter(inv => inv.modelId === model.id);
            const modelChargebacks = chargebacks.filter(cb => cb.modelId === model.id);

            const totalSales = modelInvoices.reduce((sum, inv) => sum + inv.totalGross, 0);
            const totalChargebacks = modelChargebacks.reduce((sum, cb) => sum + cb.amount, 0);
            const netRevenue = totalSales - totalChargebacks;

            return {
                modelId: model.id,
                modelName: model.name,
                totalSales,
                totalChargebacks,
                netRevenue,
                invoiceCount: modelInvoices.length,
                chargebackCount: modelChargebacks.length,
            };
        });

        // Grand totals
        const grandTotalSales = modelRevenue.reduce((sum, m) => sum + m.totalSales, 0);
        const grandTotalChargebacks = modelRevenue.reduce((sum, m) => sum + m.totalChargebacks, 0);
        const grandNetRevenue = grandTotalSales - grandTotalChargebacks;

        return NextResponse.json({
            models: modelRevenue,
            totals: {
                totalSales: grandTotalSales,
                totalChargebacks: grandTotalChargebacks,
                netRevenue: grandNetRevenue,
            },
        });
    } catch (error) {
        console.error('Revenue API error:', error);
        return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 });
    }
}
