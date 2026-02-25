import { Guild, PermissionFlagsBits, ChannelType } from 'discord.js';

export const ROLES = [
    { name: 'Founder', color: 0xFFD700 as number, position: 7 },
    { name: 'Admin', color: 0xFF4500 as number, position: 6 },
    { name: 'Manager', color: 0x1E90FF as number, position: 5 },
    { name: 'Finance Manager', color: 0x32CD32 as number, position: 4 },
    { name: 'Supervisor', color: 0x9B59B6 as number, position: 3 },
    { name: 'Chatter', color: 0x3498DB as number, position: 2 },
    { name: 'Mass PPV Engineer', color: 0xE67E22 as number, position: 1 },
];

export const MANAGEMENT_ROLES = ['Founder', 'Admin', 'Manager'];
export const SUPERVISOR_ROLES = ['Founder', 'Admin', 'Manager', 'Supervisor'];

export function hasRole(member: any, roleNames: string[]): boolean {
    return member.roles.cache.some((role: any) => roleNames.includes(role.name));
}

export function hasManagementRole(member: any): boolean {
    return hasRole(member, MANAGEMENT_ROLES);
}

export function hasSupervisorRole(member: any): boolean {
    return hasRole(member, SUPERVISOR_ROLES);
}

export async function createRolesIfMissing(guild: Guild): Promise<void> {
    const existingRoles = guild.roles.cache;

    for (const roleConfig of ROLES) {
        const exists = existingRoles.find(r => r.name === roleConfig.name);
        if (!exists) {
            await guild.roles.create({
                name: roleConfig.name,
                color: roleConfig.color as any,
                reason: 'OF MGMT Bot setup',
            });
            console.log(`  ✅ Created role: ${roleConfig.name} in ${guild.name}`);
        }
    }
}
