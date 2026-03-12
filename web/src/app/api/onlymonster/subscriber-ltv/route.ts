import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';

const OM_API_BASE = 'https://omapi.onlymonster.ai';
const OM_TOKEN = process.env.OM_API_TOKEN || 'om_token_019e03b44ecca7fb8f88e8130384c33e3df2f2ed96c17d2fef85fc4b5b5c62c9';

async function fetchAllPages(baseUrl: string, from: string, to: string, startParam = 'start', endParam = 'end') {
    const allItems: any[] = [];
    let cursor: string | undefined;

    do {
        const url = new URL(baseUrl);
        url.searchParams.set(startParam, from);
        url.searchParams.set(endParam, to);
        url.searchParams.set('limit', '1000');
        if (cursor) url.searchParams.set('cursor', cursor);

        const res = await fetch(url.toString(), {
            headers: { 'x-om-auth-token': OM_TOKEN },
        });

        if (!res.ok) {
            console.error(`OM API error ${baseUrl}:`, res.status);
            break;
        }

        const data = await res.json();
        allItems.push(...(data.items || []));
        cursor = data.cursor;
    } while (cursor);

    return allItems;
}

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

        // 1. Get all accounts
        const accountsRes = await fetch(`${OM_API_BASE}/api/v0/accounts`, {
            headers: { 'x-om-auth-token': OM_TOKEN },
        });

        if (!accountsRes.ok) {
            return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 502 });
        }

        const accountsData = await accountsRes.json();
        const accounts = accountsData.accounts || [];

        // 2. For each account, fetch tracking links and transactions in parallel
        const results = await Promise.all(
            accounts.map(async (account: any) => {
                const platformId = account.platform_account_id;

                const [trackingLinks, transactions] = await Promise.all([
                    fetchAllPages(
                        `${OM_API_BASE}/api/v0/platforms/onlyfans/accounts/${platformId}/tracking-links`,
                        from, to
                    ),
                    fetchAllPages(
                        `${OM_API_BASE}/api/v0/platforms/onlyfans/accounts/${platformId}/transactions`,
                        from, to
                    ),
                ]);

                // Count total subscribers from tracking links
                const totalSubscribers = trackingLinks.reduce(
                    (sum: number, link: any) => sum + (link.subscribers || 0), 0
                );

                // Sum net sales from transactions (only completed ones)
                const totalNetSales = transactions
                    .filter((t: any) => t.status === 'done')
                    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

                // LTV = total net sales / subscribers
                const ltv = totalSubscribers > 0 ? totalNetSales / totalSubscribers : 0;

                return {
                    accountId: account.id,
                    platformAccountId: platformId,
                    name: account.name,
                    username: account.username,
                    avatar: account.avatar,
                    subscribePrice: account.subscribe_price,
                    totalSubscribers,
                    totalNetSales,
                    ltv,
                    trackingLinksCount: trackingLinks.length,
                    transactionsCount: transactions.length,
                };
            })
        );

        return NextResponse.json({ models: results });
    } catch (error) {
        console.error('OnlyMonster subscriber LTV error:', error);
        return NextResponse.json({ error: 'Failed to calculate LTV' }, { status: 500 });
    }
}
