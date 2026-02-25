import {
    SlashCommandBuilder, ChatInputCommandInteraction,
    StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder,
    MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';

export default {
    data: new SlashCommandBuilder()
        .setName('co')
        .setDescription('Clock out and end your shift on this model'),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel!;

        if (!('name' in channel) || channel.name !== 'clock-in-and-out') {
            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setDescription('❌ This command can only be used in a `#clock-in-and-out` channel.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const guild = interaction.guild!;
        const discordUserId = interaction.user.id;

        try {
            const dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Guild not set up.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const parentChannel = 'parent' in channel ? channel.parent : null;
            if (!parentChannel) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Cannot determine model.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const model = await prisma.onlyFansModel.findFirst({
                where: { discordCategoryId: parentChannel.id, guildId: dbGuild.id },
            });
            if (!model) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
            if (!user) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ User not found. Clock in first.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // Check if user is clocked in
            const clockRecord = await prisma.clockRecord.findFirst({
                where: { userId: user.id, modelId: model.id, status: 'ACTIVE' },
            });
            if (!clockRecord) {
                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setDescription(`❌ You are not clocked in on **${model.name}**.`);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // Check for other chatters clocked in on this model
            const otherClockedIn = await prisma.clockRecord.findMany({
                where: {
                    modelId: model.id,
                    guildId: dbGuild.id,
                    status: 'ACTIVE',
                    userId: { not: user.id },
                },
                include: { user: true },
            });

            // Build split partner select menu
            const options = [
                {
                    label: '🚫 Solo — No Split',
                    description: 'I worked alone this shift',
                    value: 'solo',
                },
                ...otherClockedIn.map(r => ({
                    label: `${r.user.firstName} ${r.user.lastName}`,
                    description: `@${r.user.discordUsername || r.user.username}`,
                    value: r.user.discordId || `user_${r.user.id}`,
                })),
            ];

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`co_split:${clockRecord.id}:${model.id}:${dbGuild.id}`)
                .setPlaceholder('Select your split partner...')
                .addOptions(options);

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor(0x6366F1)
                .setTitle(`🔴 Clock Out — ${model.name}`)
                .setDescription('**Step 1 of 3:** Select your split partner below.')
                .addFields(
                    {
                        name: '👥 Available Chatters', value: otherClockedIn.length > 0
                            ? otherClockedIn.map(r => `• ${r.user.firstName} ${r.user.lastName} (@${r.user.discordUsername})`).join('\n')
                            : '_No other chatters are currently clocked in_'
                    }
                )
                .setFooter({ text: 'Select "Solo" if you worked alone' });

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            console.error('Clock-out error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
