import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const staffId = parseInt(id);

    try {
        const { position, monthlySalary, firstName, lastName } = await req.json();
        const staff = await prisma.staff.update({
            where: { id: staffId },
            data: {
                ...(position !== undefined && { position }),
                ...(monthlySalary !== undefined && { monthlySalary: parseFloat(monthlySalary) }),
            },
        });

        // Update user name if provided
        if (firstName !== undefined || lastName !== undefined) {
            const updateData: any = {};
            if (firstName !== undefined) updateData.firstName = firstName;
            if (lastName !== undefined) updateData.lastName = lastName;
            await prisma.user.update({ where: { id: staff.userId }, data: updateData });
        }

        return NextResponse.json({ staff });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const staffId = parseInt(id);

    try {
        await prisma.staff.delete({ where: { id: staffId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
    }
}

