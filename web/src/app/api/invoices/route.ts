import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search')?.trim() || '';
    const skip = (page - 1) * limit;

    try {
        // Build search filter
        const where: any = {};
        if (search) {
            const numSearch = parseFloat(search);
            where.OR = [
                { user: { firstName: { contains: search, mode: 'insensitive' } } },
                { user: { lastName: { contains: search, mode: 'insensitive' } } },
                { user: { username: { contains: search, mode: 'insensitive' } } },
                { model: { name: { contains: search, mode: 'insensitive' } } },
                { shiftSummary: { contains: search, mode: 'insensitive' } },
                ...(!isNaN(numSearch) ? [{ totalGross: numSearch }] : []),
            ];
        }

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, username: true, discordUsername: true } },
                    model: { select: { id: true, name: true } },
                    clockRecord: { select: { clockIn: true, clockOut: true, shiftType: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.invoice.count({ where }),
        ]);

        // Find split partners
        const enriched = await Promise.all(invoices.map(async (inv) => {
            let splitPartner = null;
            if (inv.splitCount > 1) {
                const partner = await prisma.invoice.findFirst({
                    where: {
                        modelId: inv.modelId,
                        totalGross: inv.totalGross,
                        splitCount: inv.splitCount,
                        userId: { not: inv.userId },
                        clockRecord: { clockOut: inv.clockRecord?.clockOut },
                    },
                    include: {
                        user: { select: { firstName: true, lastName: true, discordUsername: true } },
                    },
                });
                if (partner) {
                    splitPartner = {
                        name: `${partner.user.firstName} ${partner.user.lastName}`.trim(),
                        username: partner.user.discordUsername,
                    };
                }
            }
            return { ...inv, splitPartner };
        }));

        return NextResponse.json({
            invoices: enriched,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}

/**
 * Parse a datetime-local string (e.g. "2026-02-18T11:00") in a given timezone.
 * Returns a Date object representing that moment in UTC.
 */
function parseDateInTimezone(dateStr: string, tz: string): Date {
    // datetime-local gives us "YYYY-MM-DDTHH:mm" — we treat it as local to the configured tz
    // Create a date formatter that can tell us the offset for this timezone
    const d = new Date(dateStr); // parse as UTC first
    // Get what the time would be in the target timezone
    const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = d.toLocaleString('en-US', { timeZone: tz });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    // Subtract the offset to convert "local tz" input to UTC
    return new Date(d.getTime() - offsetMs);
}

export async function POST(req: Request) {
    try {
        const { userId, userId2, modelId, clockIn, clockOut, totalGross, splitCount, shiftSummary } = await req.json();

        // Fetch configured timezone
        const tzSetting = await prisma.setting.findUnique({ where: { key: 'timezone' } });
        const tz = tzSetting?.value || 'UTC';

        const clockInDate = parseDateInTimezone(clockIn, tz);
        const clockOutDate = parseDateInTimezone(clockOut, tz);

        const hasPartner = userId2 && userId2.trim() && userId2 !== userId;
        const splits = hasPartner ? 2 : (parseInt(splitCount) || 1);
        const gross = parseFloat(totalGross) || 0;
        const splitAmount = gross / splits;

        // Find guild for this model
        const model = await prisma.onlyFansModel.findUnique({ where: { id: parseInt(modelId) } });
        if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 });

        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Create clock record for first user
        const clockRecord = await prisma.clockRecord.create({
            data: {
                userId: parseInt(userId),
                modelId: parseInt(modelId),
                guildId: model.guildId,
                discordUserId: user.discordId || `manual_${user.id}`,
                clockIn: clockInDate,
                clockOut: clockOutDate,
                status: 'COMPLETED',
            },
        });

        // Create invoice for first user
        const invoice = await prisma.invoice.create({
            data: {
                clockRecordId: clockRecord.id,
                userId: parseInt(userId),
                modelId: parseInt(modelId),
                totalGross: gross,
                splitCount: splits,
                splitAmount,
                shiftSummary: shiftSummary || null,
            },
        });

        // If split partner, create invoice for second user too
        let invoice2 = null;
        if (hasPartner) {
            const user2 = await prisma.user.findUnique({ where: { id: parseInt(userId2) } });
            if (!user2) return NextResponse.json({ error: 'Split partner not found' }, { status: 404 });

            const clockRecord2 = await prisma.clockRecord.create({
                data: {
                    userId: parseInt(userId2),
                    modelId: parseInt(modelId),
                    guildId: model.guildId,
                    discordUserId: user2.discordId || `manual_${user2.id}`,
                    clockIn: clockInDate,
                    clockOut: clockOutDate,
                    status: 'COMPLETED',
                },
            });

            invoice2 = await prisma.invoice.create({
                data: {
                    clockRecordId: clockRecord2.id,
                    userId: parseInt(userId2),
                    modelId: parseInt(modelId),
                    totalGross: gross,
                    splitCount: splits,
                    splitAmount,
                    shiftSummary: shiftSummary || null,
                },
            });
        }

        return NextResponse.json({ invoice, invoice2 });
    } catch (error) {
        console.error('Manual invoice creation error:', error);
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }
}
