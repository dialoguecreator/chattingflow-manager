import { PrismaClient } from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root
const rootDir = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(rootDir, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Also load from discord-bot dir if it exists (for production)
dotenv.config({ path: path.join(rootDir, '.env') });

const databaseUrl = process.env.DATABASE_URL;

const prisma = new PrismaClient({
    ...(databaseUrl && !databaseUrl.startsWith('postgresql') && !databaseUrl.startsWith('postgres') ? {
        datasources: {
            db: {
                url: databaseUrl.startsWith('file:') ? databaseUrl : `file:${path.resolve(projectRoot, 'web', 'prisma', 'dev.db')}`,
            },
        },
    } : {}),
});

export default prisma;

