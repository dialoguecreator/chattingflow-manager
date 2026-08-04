import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
} from 'discord.js';
import prisma from '../lib/prisma';

function fmt(n: number): string {
    return n.toFixed(2);
}

function fmtDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Belgrade' });
}

export default {
    data: new SlashCommandBuilder()
        .setName('plata')
        .setDescription('Check your payout/earnings for a specific period'),

    async execute(interaction: ChatInputCommandInteraction) {
        const discordUserId = interaction.user.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            // Find the user in DB
            const user = await prisma.user.findFirst({
                where: { discordId: discordUserId },
            });

            if (!user) {
                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setDescription('❌ You are not registered in the system. Please contact an admin.');
                return interaction.editReply({ embeds: [embed] });
            }

            // Get all payout periods
            const periods = await prisma.payoutPeriod.findMany({
                orderBy: { startDate: 'desc' },
                take: 25, // Discord limit for select menu options
            });

            if (periods.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setDescription('❌ No payout periods found. Admin needs to create a payout period first.');
                return interaction.editReply({ embeds: [embed] });
            }

            // Build select menu with periods
            const select = new StringSelectMenuBuilder()
                .setCustomId(`plata_period:${user.id}`)
                .setPlaceholder('📅 Select a payout period...')
                .addOptions(
                    periods.map(p => ({
                        label: `Period #${p.id}`,
                        description: `${fmtDate(p.startDate)} → ${fmtDate(p.endDate)}`,
                        value: `${p.id}`,
                        emoji: p.status === 'ACTIVE' ? '🟢' : '✅',
                    }))
                );

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

            const embed = new EmbedBuilder()
                .setColor(0x8B5CF6)
                .setTitle('💰 Plata — Select Period')
                .setDescription('Choose a payout period to see your earnings breakdown.')
                .setFooter({ text: 'Your data is private — only you can see this.' });

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Plata command error:', error);
            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setDescription('❌ Failed to load payout periods.');
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
