import { PrismaClient } from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root
const rootDir = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(rootDir, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Point to the shared database in web/prisma/dev.db
const dbPath = path.resolve(projectRoot, 'web', 'prisma', 'dev.db');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: `file:${dbPath}`,
        },
    },
});

export default prisma;
