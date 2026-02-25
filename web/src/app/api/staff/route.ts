import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

export async function GET() {
    try {
        const staff = await prisma.staff.findMany({
            include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
            orderBy: { position: 'asc' },
        });
        return NextResponse.json({ staff });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { firstName, lastName, email, position, monthlySalary } = await req.json();
        const roleMap: Record<string, string> = {
            'Manager': 'MANAGER', 'Supervisor': 'SUPERVISOR',
            'Mass PPV Engineer': 'MASS_PPV_ENGINEER', 'Finance Manager': 'FINANCE_MANAGER',
        };

        // Create user if not exists
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    username: email.split('@')[0],
                    password: await hash('changeme123', 12),
                    firstName, lastName,
                    role: roleMap[position] || 'MANAGER',
                },
            });
        }

        const staffEntry = await prisma.staff.create({
            data: {
                userId: user.id,
                position,
                monthlySalary: parseFloat(monthlySalary) || 0,
            },
        });

        return NextResponse.json({ staff: staffEntry });
    } catch (error) {
        console.error('Staff creation error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
