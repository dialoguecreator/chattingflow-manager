import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/apiAuth';
import { generateTotpSecret, buildTotpEnrollment } from '@/lib/totp';

// POST /api/2fa/setup
// Starts enrollment: generates a fresh secret (not yet enabled) and returns a
// QR code for the authenticator app. 2FA activates only after /api/2fa/enable.
export async function POST() {
    const auth = await requireAuth();
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const userId = Number(auth.userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

    const secret = generateTotpSecret();
    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });

    const { otpauthUrl, qrDataUrl } = await buildTotpEnrollment(user?.email || String(userId), secret);
    return NextResponse.json({ secret, otpauthUrl, qrDataUrl });
}
