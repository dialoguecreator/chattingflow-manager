import { Events, Guild } from 'discord.js';
import { createRolesIfMissing } from '../utils/permissions';
import prisma from '../lib/prisma';

export default {
    name: Events.GuildCreate,
    once: false,
    async execute(guild: Guild) {
        console.log(`🏠 Joined guild: ${guild.name} (${guild.id})`);

        // Create roles
        await createRolesIfMissing(guild);

        // Save guild to database
        await prisma.guild.upsert({
            where: { guildId: guild.id },
            update: { name: guild.name },
            create: { guildId: guild.id, name: guild.name },
        });

        console.log(`✅ Guild setup complete: ${guild.name}`);
    },
};
