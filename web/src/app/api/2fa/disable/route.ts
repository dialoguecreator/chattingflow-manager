import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/apiAuth';

// POST /api/2fa/disable  { password: "..." }
// Turning off 2FA is sensitive, so re-confirm the account password.
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    const userId = Number(auth.userId);
    const { password } = await req.json().catch(() => ({ password: '' }));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ok = await compare(String(password || ''), user.password);
    if (!ok) return NextResponse.json({ error: 'Wrong password' }, { status: 400 });

    await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: '[]' },
    });

    return NextResponse.json({ enabled: false });
}
