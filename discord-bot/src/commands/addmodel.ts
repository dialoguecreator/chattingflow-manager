import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { hasManagementRole } from '../utils/permissions';
import prisma from '../lib/prisma';

export default {
    data: new SlashCommandBuilder()
        .setName('addmodel')
        .setDescription('Create a new model category with all required channels')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the model')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as any;

        if (!hasManagementRole(member)) {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Only Founders, Admins, and Managers can use this command.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const modelName = interaction.options.getString('name', true);
        const guild = interaction.guild!;

        await interaction.deferReply();

        try {
            // Check if model already exists in DB
            const dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) {
                return interaction.editReply('❌ Guild not found in database. Please re-invite the bot.');
            }

            const existing = await prisma.onlyFansModel.findFirst({
                where: { name: modelName, guildId: dbGuild.id },
            });
            if (existing) {
                return interaction.editReply(`❌ Model **${modelName}** already exists on this server.`);
            }

            // ─── 1. Create Model Role ────────────────────────────────
            const randomColor = Math.floor(Math.random() * 0xFFFFFF);
            const modelRole = await guild.roles.create({
                name: modelName,
                color: randomColor,
                reason: `Model role for ${modelName}`,
            });

            // ─── 2. Get management roles ─────────────────────────────
            const adminRole = guild.roles.cache.find(r => r.name === 'Admin');
            const managerRole = guild.roles.cache.find(r => r.name === 'Manager');
            const supervisorRole = guild.roles.cache.find(r => r.name === 'Supervisor');
            const founderRole = guild.roles.cache.find(r => r.name === 'Founder');
            const botMember = guild.members.me!;

            // ─── 3. Create Category (visible only to model role + mgmt) ──
            const categoryPermissions: any[] = [
                // Deny everyone by default
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                // Allow bot
                {
                    id: botMember.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                },
                // Allow model role (chatters with this model)
                {
                    id: modelRole.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                },
            ];

            // Allow management roles
            if (founderRole) categoryPermissions.push({ id: founderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
            if (adminRole) categoryPermissions.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
            if (managerRole) categoryPermissions.push({ id: managerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (supervisorRole) categoryPermissions.push({ id: supervisorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

            const category = await guild.channels.create({
                name: modelName,
                type: ChannelType.GuildCategory,
                permissionOverwrites: categoryPermissions,
            });

            // ─── 4. model-info (view only for chatters, mgmt can write) ──
            const modelInfoPermissions: any[] = [
                // Inherit category deny for @everyone
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                // Bot can see + send
                { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                // Model role: can view + react, CANNOT send messages
                {
                    id: modelRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
                    deny: [PermissionFlagsBits.SendMessages],
                },
            ];
            if (founderRole) modelInfoPermissions.push({ id: founderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (adminRole) modelInfoPermissions.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (managerRole) modelInfoPermissions.push({ id: managerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (supervisorRole) modelInfoPermissions.push({ id: supervisorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

            await guild.channels.create({
                name: `${modelName.toLowerCase()}-info`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: modelInfoPermissions,
            });

            // ─── 5. model-update (everyone with model role can see + write) ──
            const modelUpdatePermissions: any[] = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                // Model role: can view AND write
                {
                    id: modelRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
                },
            ];
            if (founderRole) modelUpdatePermissions.push({ id: founderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (adminRole) modelUpdatePermissions.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (managerRole) modelUpdatePermissions.push({ id: managerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (supervisorRole) modelUpdatePermissions.push({ id: supervisorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

            await guild.channels.create({
                name: `${modelName.toLowerCase()}-update`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: modelUpdatePermissions,
            });

            // ─── 5b. schedule (everyone with model role can see + write) ──
            await guild.channels.create({
                name: `${modelName.toLowerCase()}-schedule`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: modelUpdatePermissions,
            });

            // ─── 6. sales-file (hidden from chatters, mgmt only) ─────
            const salesFilePermissions: any[] = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                // Explicitly deny model role from seeing this channel
                { id: modelRole.id, deny: [PermissionFlagsBits.ViewChannel] },
            ];
            if (founderRole) salesFilePermissions.push({ id: founderRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (adminRole) salesFilePermissions.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (managerRole) salesFilePermissions.push({ id: managerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            if (supervisorRole) salesFilePermissions.push({ id: supervisorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

            await guild.channels.create({
                name: 'sales-file',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: salesFilePermissions,
            });

            // ─── 7. Other channels (inherit category perms — model role can see + write) ──
            const otherChannels = ['chat', 'clock-in-and-out', 'milk', 'break', 'mass-message'];
            for (const channelName of otherChannels) {
                await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    // Inherits category permissions (model role can see + write)
                });
            }

            // ─── 8. Voice channel ────────────────────────────────────
            await guild.channels.create({
                name: `${modelName} Voice`,
                type: ChannelType.GuildVoice,
                parent: category.id,
                // Inherits category permissions
            });

            // ─── 9. Save to database ─────────────────────────────────
            await prisma.onlyFansModel.create({
                data: {
                    name: modelName,
                    guildId: dbGuild.id,
                    discordCategoryId: category.id,
                },
            });

            // ─── 10. Success embed ───────────────────────────────────
            const embed = new EmbedBuilder()
                .setColor(randomColor)
                .setTitle(`✅ Model Created — ${modelName}`)
                .addFields(
                    { name: '📁 Category', value: category.name, inline: true },
                    { name: '🎭 Role', value: `<@&${modelRole.id}>`, inline: true },
                    {
                        name: '📝 Channels', value: [
                            `\`${modelName.toLowerCase()}-info\` — view only for chatters`,
                            `\`${modelName.toLowerCase()}-update\` — chatters can write`,
                            `\`${modelName.toLowerCase()}-schedule\` — chatters can write`,
                            '`sales-file` — management only',
                            '`chat`, `clock-in-and-out`, `milk`, `break`, `mass-message`',
                        ].join('\n')
                    },
                    { name: '🔊 Voice', value: `${modelName} Voice` },
                    { name: '🔒 Access', value: `Only users with the <@&${modelRole.id}> role can see this category.` },
                )
                .setFooter({ text: 'Assign the model role to chatters who work on this model' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error creating model:', error);
            await interaction.editReply('❌ Failed to create model. Please check bot permissions (Manage Roles + Manage Channels required).');
        }
    },
};
