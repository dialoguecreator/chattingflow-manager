import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/apiAuth';

// GET /api/2fa/status -> { enabled, backupCodesRemaining }
export async function GET() {
    const auth = await requireAuth();
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const userId = Number(auth.userId);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
    });

    let remaining = 0;
    try {
        remaining = (JSON.parse(user?.twoFactorBackupCodes || '[]') as string[]).length;
    } catch {
        remaining = 0;
    }

    return NextResponse.json({ enabled: !!user?.twoFactorEnabled, backupCodesRemaining: remaining });
}
