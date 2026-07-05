import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/apiAuth';
import { verifyTotp, generateBackupCodes } from '@/lib/totp';

// POST /api/2fa/enable  { token: "123456" }
// Confirms the user can produce a valid code from the secret created in
// /api/2fa/setup, then activates 2FA and returns one-time backup codes.
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const userId = Number(auth.userId);
    const { token } = await req.json().catch(() => ({ token: '' }));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) {
        return NextResponse.json({ error: 'Start setup first' }, { status: 400 });
    }

    if (!verifyTotp(String(token || ''), user.twoFactorSecret)) {
        return NextResponse.json({ error: 'Invalid code — check your authenticator app and try again.' }, { status: 400 });
    }

    const { plain, hashed } = await generateBackupCodes(10);
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true, twoFactorBackupCodes: JSON.stringify(hashed) },
    });

    // Backup codes are returned once here and never shown again.
    return NextResponse.json({ enabled: true, backupCodes: plain });
}
