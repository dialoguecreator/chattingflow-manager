import { Client, Guild, GuildMember, Collection } from 'discord.js';

// Cache guild members to avoid rate limiting from repeated guild.members.fetch() calls.
// Refreshes every 5 minutes automatically.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let lastFetchTime = 0;
let cachedClient: Client | null = null;

export function initMemberCache(client: Client) {
    cachedClient = client;

    // Fetch all guild members on startup (after ready)
    client.once('ready', async () => {
        console.log('[MemberCache] Initial fetch of all guild members...');
        await refreshAllGuilds(client);
        console.log('[MemberCache] Initial fetch complete.');
    });

    // Refresh every 5 minutes
    setInterval(async () => {
        if (cachedClient) {
            console.log('[MemberCache] Periodic refresh of guild members...');
            await refreshAllGuilds(cachedClient);
        }
    }, CACHE_TTL_MS);
}

async function refreshAllGuilds(client: Client) {
    for (const [, guild] of client.guilds.cache) {
        try {
            await guild.members.fetch();
            console.log(`[MemberCache] Fetched ${guild.members.cache.size} members for ${guild.name}`);
        } catch (e) {
            console.error(`[MemberCache] Failed to fetch members for ${guild.name}:`, e);
        }
    }
    lastFetchTime = Date.now();
}

/**
 * Get members with specific roles from a guild.
 * Uses cached members (no API call) to avoid rate limits.
 * Falls back to a fresh fetch only if cache is very stale (>10 min).
 */
export async function getMembersWithRoles(guild: Guild, roleNames: string[]): Promise<Map<string, GuildMember>> {
    const STALE_TTL = 10 * 60 * 1000; // 10 minutes

    // Only fetch if cache is very stale
    if (Date.now() - lastFetchTime > STALE_TTL) {
        try {
            await guild.members.fetch();
            lastFetchTime = Date.now();
            console.log(`[MemberCache] Stale cache refreshed for ${guild.name}`);
        } catch (e) {
            console.warn(`[MemberCache] Could not refresh stale cache, using existing cache`);
        }
    }

    const uniqueMembers = new Map<string, GuildMember>();
    for (const roleName of roleNames) {
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) {
            const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id));
            for (const [id, member] of membersWithRole) {
                uniqueMembers.set(id, member);
            }
        }
    }

    return uniqueMembers;
}
