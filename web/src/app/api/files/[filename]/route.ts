import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    // Resolve uploads directory (project root / uploads)
    const uploadsDir = path.resolve(process.cwd(), '..', 'uploads');
    const filePath = path.join(uploadsDir, filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.csv': 'text/csv',
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Extract original filename (remove prefix: userId_clockRecordId_timestamp_)
    const parts = filename.split('_');
    const originalName = parts.length > 3 ? parts.slice(3).join('_') : filename;

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${originalName}"`,
        },
    });
}
