import {
    SlashCommandBuilder, ChatInputCommandInteraction,
    StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder,
    MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';

export default {
    data: new SlashCommandBuilder()
        .setName('adminco')
        .setDescription('Admin/Manager: Clock out a chatter who forgot to clock out'),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel!;
        const member = interaction.member as any;

        // Permission check — only Supervisor/Manager/Admin/Founder
        const hasPermission = member.roles.cache.some(
            (r: any) => ['Supervisor', 'Manager', 'Admin', 'Founder'].includes(r.name)
        );
        if (!hasPermission) {
            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setDescription('❌ Only Supervisors/Managers/Admins can use this command.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Must be used in #clock-in-and-out channel
        if (!('name' in channel) || channel.name !== 'clock-in-and-out') {
            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setDescription('❌ This command can only be used in a `#clock-in-and-out` channel.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const guild = interaction.guild!;

        try {
            const dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) {
                const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Guild not set up.');
                return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
            }

            const parentChannel = 'parent' in channel ? channel.parent : null;
            if (!parentChannel) {
                const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Cannot determine model.');
                return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
            }

            const model = await prisma.onlyFansModel.findFirst({
                where: { discordCategoryId: parentChannel.id, guildId: dbGuild.id },
            });
            if (!model) {
                const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.');
                return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
            }

            // Find all chatters currently clocked in on this model
            const clockedIn = await prisma.clockRecord.findMany({
                where: {
                    modelId: model.id,
                    guildId: dbGuild.id,
                    status: 'ACTIVE',
                },
                include: { user: true },
            });

            if (clockedIn.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setDescription(`❌ No chatters are currently clocked in on **${model.name}**.`);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // Build select menu to choose which chatter to clock out
            const options = clockedIn.map(r => ({
                label: `${r.user.firstName} ${r.user.lastName}`,
                description: `@${r.user.discordUsername || r.user.username} — Clocked in since ${r.clockIn.toLocaleTimeString()}`,
                value: `${r.id}`, // clock record ID
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`adminco_select:${model.id}:${dbGuild.id}`)
                .setPlaceholder('Select the chatter to clock out...')
                .addOptions(options);

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor(0xF59E0B)
                .setTitle(`🔧 Admin Clock Out — ${model.name}`)
                .setDescription('**Step 1 of 3:** Select the chatter you want to clock out.')
                .addFields({
                    name: '👥 Currently Clocked In',
                    value: clockedIn.map(r =>
                        `• ${r.user.firstName} ${r.user.lastName} (@${r.user.discordUsername})`
                    ).join('\n'),
                })
                .setFooter({ text: 'This will record as a normal clock-out in the CRM' });

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            console.error('Admin clock-out error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
