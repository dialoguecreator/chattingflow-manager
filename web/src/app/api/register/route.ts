import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { email, username, password, firstName, lastName, inviteToken } = await req.json();

        if (!email || !username || !password || !firstName || !lastName || !inviteToken) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // Validate invite token
        const invite = await prisma.inviteToken.findUnique({ where: { token: inviteToken } });
        if (!invite) {
            return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 });
        }
        if (invite.usedBy) {
            return NextResponse.json({ error: 'Invite token already used' }, { status: 400 });
        }
        if (invite.paused) {
            return NextResponse.json({ error: 'This invite link has been paused' }, { status: 400 });
        }
        if (invite.expiresAt && invite.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Invite token expired' }, { status: 400 });
        }

        // Check existing
        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) return NextResponse.json({ error: 'Email already taken' }, { status: 400 });

        const existingUsername = await prisma.user.findUnique({ where: { username } });
        if (existingUsername) return NextResponse.json({ error: 'Username already taken' }, { status: 400 });

        const hashedPassword = await hash(password, 12);

        const user = await prisma.user.create({
            data: { email, username, password: hashedPassword, firstName, lastName, role: 'CHATTER' },
        });

        // Mark invite as used
        await prisma.inviteToken.update({
            where: { id: invite.id },
            data: { usedBy: email, usedAt: new Date() },
        });

        return NextResponse.json({ success: true, userId: user.id });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }
}
