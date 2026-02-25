import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const adminPassword = await hash('admin123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@agency.com' },
        update: {},
        create: {
            email: 'admin@agency.com',
            username: 'admin',
            password: adminPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
        },
    });
    console.log(`✅ Admin user created: ${admin.email} / admin123`);

    // Create first payout period (current bi-weekly)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startDate = new Date(now);
    startDate.setUTCDate(now.getUTCDate() - daysUntilLastMonday);
    startDate.setUTCHours(17, 0, 0, 0); // 18:00 CET = 17:00 UTC

    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 14);

    const bufferEnd = new Date(endDate);
    bufferEnd.setUTCHours(18, 0, 0, 0);

    await prisma.payoutPeriod.upsert({
        where: { id: 1 },
        update: {},
        create: { startDate, endDate, bufferEnd },
    });
    console.log('✅ First payout period created');

    console.log('\n🎉 Seed complete!');
    console.log('Login with: admin@agency.com / admin123');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
