import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import prisma from '../lib/prisma';
import { formatDuration } from '../utils/shifts';

export default {
    data: new SlashCommandBuilder()
        .setName('back')
        .setDescription('Return from your break'),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel!;

        if (!('name' in channel) || channel.name !== 'break') {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ This command can only be used in a `#break` channel.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const guild = interaction.guild!;
        const discordUserId = interaction.user.id;

        try {
            const dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Guild not set up.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const parentChannel = 'parent' in channel ? channel.parent : null;
            if (!parentChannel) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Cannot determine model.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const model = await prisma.onlyFansModel.findFirst({
                where: { discordCategoryId: parentChannel.id, guildId: dbGuild.id },
            });
            if (!model) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
            if (!user) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ User not found.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const clockRecord = await prisma.clockRecord.findFirst({
                where: { userId: user.id, modelId: model.id, status: 'ACTIVE' },
            });
            if (!clockRecord) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ You are not clocked in.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const activeBreak = await prisma.breakRecord.findFirst({
                where: { clockRecordId: clockRecord.id, endTime: null },
            });
            if (!activeBreak) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ You are not currently on a break.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const now = new Date();
            const breakDuration = now.getTime() - activeBreak.startTime.getTime();

            await prisma.breakRecord.update({
                where: { id: activeBreak.id },
                data: { endTime: now },
            });

            const timestamp = Math.floor(now.getTime() / 1000);
            const exceeded = breakDuration > 15 * 60 * 1000;

            const embed = new EmbedBuilder()
                .setColor(exceeded ? 0xEF4444 : 0x22C55E)
                .setTitle(`✅ Back From Break — ${model.name}`)
                .setDescription(`<@${discordUserId}> is **back from break**!`)
                .addFields(
                    { name: '⏰ Returned', value: `<t:${timestamp}:T>`, inline: true },
                    { name: '⏱️ Break Duration', value: formatDuration(breakDuration), inline: true },
                )
                .setTimestamp()
                .setFooter({ text: 'OF MGMT Bot' });

            if (exceeded) {
                embed.addFields({ name: '⚠️ Warning', value: 'Break exceeded 15 minutes!' });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Back error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
