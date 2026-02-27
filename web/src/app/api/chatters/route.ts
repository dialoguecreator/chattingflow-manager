import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const chatters = await prisma.user.findMany({
            where: { role: 'CHATTER' },
            select: {
                id: true, firstName: true, lastName: true, username: true,
                discordUsername: true, discordId: true,
                commissionNet: true, commissionGross: true,
            },
            orderBy: { firstName: 'asc' },
        });
        return NextResponse.json({ chatters });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { discordUsername, discordId, displayName } = await req.json();

        if (!discordUsername || !displayName) {
            return NextResponse.json({ error: 'Discord username and display name are required' }, { status: 400 });
        }

        // Check if user with this discord username already exists
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { discordUsername },
                    ...(discordId ? [{ discordId }] : []),
                ],
            },
        });
        if (existing) {
            return NextResponse.json({ error: 'A chatter with this Discord username or ID already exists' }, { status: 409 });
        }

        // Split display name into first/last
        const nameParts = displayName.trim().split(/\s+/);
        const firstName = nameParts[0] || displayName;
        const lastName = nameParts.slice(1).join(' ') || '';

        const chatter = await prisma.user.create({
            data: {
                discordUsername,
                discordId: discordId || null,
                username: discordUsername,
                email: `${discordUsername}@discord.placeholder`,
                password: 'discord-auth',
                firstName,
                lastName,
                role: 'CHATTER',
            },
            select: {
                id: true, firstName: true, lastName: true, username: true,
                discordUsername: true, discordId: true,
                commissionNet: true, commissionGross: true,
            },
        });

        return NextResponse.json({ chatter }, { status: 201 });
    } catch (error: any) {
        console.error('Create chatter error:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create chatter' }, { status: 500 });
    }
}
