import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const models = await prisma.onlyFansModel.findMany({
            orderBy: { name: 'asc' },
        });
        return NextResponse.json({ models });
    } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
        }

        // Auto-select first guild
        const guild = await prisma.guild.findFirst();
        if (!guild) {
            return NextResponse.json({ error: 'No guild found. Bot must be in at least one server.' }, { status: 400 });
        }

        // Check for duplicate name in same guild
        const existing = await prisma.onlyFansModel.findFirst({
            where: { name: name.trim(), guildId: guild.id },
        });
        if (existing) {
            return NextResponse.json({ error: 'A model with this name already exists' }, { status: 400 });
        }

        const model = await prisma.onlyFansModel.create({
            data: {
                name: name.trim(),
                guildId: guild.id,
                // No discordCategoryId — manual model
            },
        });

        return NextResponse.json({ model });
    } catch (error) {
        console.error('Create model error:', error);
        return NextResponse.json({ error: 'Failed to create model' }, { status: 500 });
    }
}
