import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import prisma from '../lib/prisma';
import { getCurrentShift } from '../utils/shifts';

export default {
    data: new SlashCommandBuilder()
        .setName('ci')
        .setDescription('Clock in to start your shift on this model'),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel!;

        if (!('name' in channel) || channel.name !== 'clock-in-and-out') {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ This command can only be used in a `#clock-in-and-out` channel.');
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

            let user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        discordId: discordUserId,
                        discordUsername: interaction.user.username,
                        email: `${discordUserId}@discord.placeholder`,
                        username: interaction.user.username,
                        password: 'discord-auth',
                        firstName: interaction.user.displayName || interaction.user.username,
                        lastName: '',
                        role: 'CHATTER',
                    },
                });
            }

            const existingClock = await prisma.clockRecord.findFirst({
                where: { userId: user.id, modelId: model.id, status: 'ACTIVE' },
            });

            if (existingClock) {
                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setDescription(`❌ You are already clocked in on **${model.name}**! Clock out first with \`/co\`.`);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const shift = getCurrentShift();

            await prisma.clockRecord.create({
                data: {
                    userId: user.id,
                    modelId: model.id,
                    guildId: dbGuild.id,
                    discordUserId,
                    shiftType: shift.type,
                },
            });

            const timestamp = Math.floor(Date.now() / 1000);

            const embed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle(`🟢 CLOCK IN — ${model.name}`)
                .setDescription(`<@${discordUserId}> has successfully **clocked in**!`)
                .addFields(
                    { name: '⏰ Time', value: `<t:${timestamp}:F>`, inline: true },
                    { name: '🔄 Shift', value: shift.label, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: 'OF MGMT Bot' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Clock-in error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred during clock-in.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
