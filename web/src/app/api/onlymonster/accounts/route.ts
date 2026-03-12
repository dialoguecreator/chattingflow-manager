import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';

const OM_API_BASE = 'https://omapi.onlymonster.ai';
const OM_TOKEN = process.env.OM_API_TOKEN || 'om_token_019e03b44ecca7fb8f88e8130384c33e3df2f2ed96c17d2fef85fc4b5b5c62c9';

export async function GET() {
    const auth = await requireRole('FOUNDER', 'ADMIN', 'MANAGER');
    if (!auth.authorized) return NextResponse.json(auth.response, { status: auth.status });

    try {
        const allAccounts: any[] = [];
        let cursor: string | undefined;

        // Paginate through all accounts
        do {
            const url = new URL(`${OM_API_BASE}/api/v0/accounts`);
            if (cursor) url.searchParams.set('cursor', cursor);
            url.searchParams.set('limit', '100');

            const res = await fetch(url.toString(), {
                headers: { 'x-om-auth-token': OM_TOKEN },
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('OnlyMonster accounts error:', res.status, text);
                return NextResponse.json({ error: 'Failed to fetch OnlyMonster accounts' }, { status: 502 });
            }

            const data = await res.json();
            allAccounts.push(...(data.accounts || []));
            cursor = data.nextCursor;
        } while (cursor);

        return NextResponse.json({ accounts: allAccounts });
    } catch (error) {
        console.error('OnlyMonster accounts error:', error);
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}
