import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const staffId = parseInt(id);

    try {
        const session = await getServerSession(authOptions);
        const currentUserRole = (session?.user as any)?.role;

        // Only ADMIN and MANAGER can edit staff
        if (currentUserRole !== 'ADMIN' && currentUserRole !== 'MANAGER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { position, monthlySalary, firstName, lastName, userRole } = await req.json();
        const staff = await prisma.staff.update({
            where: { id: staffId },
            data: {
                ...(position !== undefined && { position }),
                ...(monthlySalary !== undefined && { monthlySalary: parseFloat(monthlySalary) }),
            },
        });

        // Update user name and role if provided
        const updateData: any = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;

        // Only ADMIN can assign the ADMIN role
        if (userRole !== undefined && currentUserRole === 'ADMIN') {
            updateData.role = userRole;
        }

        if (Object.keys(updateData).length > 0) {
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
        const session = await getServerSession(authOptions);
        const currentUserRole = (session?.user as any)?.role;

        // Only ADMIN and MANAGER can delete staff
        if (currentUserRole !== 'ADMIN' && currentUserRole !== 'MANAGER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await prisma.staff.delete({ where: { id: staffId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
    }
}
