import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';

const OM_API_BASE = 'https://omapi.onlymonster.ai';
const OM_TOKEN = process.env.OM_API_TOKEN || 'om_token_019e03b44ecca7fb8f88e8130384c33e3df2f2ed96c17d2fef85fc4b5b5c62c9';

export async function GET(req: Request) {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        if (!from || !to) {
            return NextResponse.json({ error: 'from and to query params are required' }, { status: 400 });
        }

        // Fetch all metrics with pagination
        const allMetrics: any[] = [];
        let offset = 0;
        const limit = 100;

        do {
            const url = new URL(`${OM_API_BASE}/api/v0/users/metrics`);
            url.searchParams.set('from', from);
            url.searchParams.set('to', to);
            url.searchParams.set('offset', String(offset));
            url.searchParams.set('limit', String(limit));

            const res = await fetch(url.toString(), {
                headers: { 'x-om-auth-token': OM_TOKEN },
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('OnlyMonster metrics error:', res.status, text);
                return NextResponse.json({ error: 'Failed to fetch chatter metrics' }, { status: 502 });
            }

            const data = await res.json();
            const items = data.items || [];
            allMetrics.push(...items);

            // If we got fewer items than the limit, we've reached the end
            if (items.length < limit) break;
            offset += limit;
        } while (true);

        return NextResponse.json({ metrics: allMetrics });
    } catch (error) {
        console.error('OnlyMonster metrics error:', error);
        return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }
}
