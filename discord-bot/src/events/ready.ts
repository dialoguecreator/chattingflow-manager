import { Events, Client, REST, Routes } from 'discord.js';
import { createRolesIfMissing } from '../utils/permissions';
import prisma from '../lib/prisma';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client) {
        console.log(`🤖 Bot is ready! Logged in as ${client.user?.tag}`);
        console.log(`📡 Connected to ${client.guilds.cache.size} guild(s)`);

        // Register slash commands with Discord API
        const commands = [...client.commands.values()].map(c => c.data.toJSON());
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

        for (const [, guild] of client.guilds.cache) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(client.user!.id, guild.id),
                    { body: commands },
                );
                console.log(`✅ Registered ${commands.length} commands in ${guild.name}`);
            } catch (error) {
                console.error(`Failed to register commands in ${guild.name}:`, error);
            }

            await createRolesIfMissing(guild);
            await prisma.guild.upsert({
                where: { guildId: guild.id },
                update: { name: guild.name },
                create: { guildId: guild.id, name: guild.name },
            });
        }
    },
};
