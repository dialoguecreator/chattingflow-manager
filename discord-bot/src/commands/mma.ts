import {
    SlashCommandBuilder, ChatInputCommandInteraction,
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
    EmbedBuilder, MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';

export default {
    data: new SlashCommandBuilder()
        .setName('mma')
        .setDescription('Submit a mass message idea for approval'),

    async execute(interaction: ChatInputCommandInteraction) {
        const guild = interaction.guild!;

        try {
            const dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Guild not set up.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const channel = interaction.channel!;
            const parentChannel = 'parent' in channel ? channel.parent : null;
            if (!parentChannel) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Use this in a model category channel.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const model = await prisma.onlyFansModel.findFirst({
                where: { discordCategoryId: parentChannel.id, guildId: dbGuild.id },
            });
            if (!model) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const modal = new ModalBuilder()
                .setCustomId(`mma_modal:${model.id}:${dbGuild.id}`)
                .setTitle(`Mass Message — ${model.name}`);

            const messageInput = new TextInputBuilder()
                .setCustomId('mma_message')
                .setLabel('Your Mass Message Idea')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe your mass message idea in detail...')
                .setRequired(true)
                .setMaxLength(2000);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput),
            );

            await interaction.showModal(modal);
        } catch (error) {
            console.error('MMA error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
