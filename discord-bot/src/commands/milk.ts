import {
    SlashCommandBuilder, ChatInputCommandInteraction,
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
    EmbedBuilder, MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';

export default {
    data: new SlashCommandBuilder()
        .setName('milk')
        .setDescription('Submit a milk report for a subscriber'),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel!;

        // Only allow in #milk channel
        if (!('name' in channel) || channel.name !== 'milk') {
            const embed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setDescription('❌ This command can only be used in a `#milk` channel.');
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
                const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Use this in a model category channel.');
                return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
            }

            const model = await prisma.onlyFansModel.findFirst({
                where: { discordCategoryId: parentChannel.id, guildId: dbGuild.id },
            });
            if (!model) {
                const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found for this category.');
                return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
            }

            // Build modal with 5 fields (max allowed by Discord)
            const modal = new ModalBuilder()
                .setCustomId(`milk_modal:${model.id}:${dbGuild.id}`)
                .setTitle(`🥛 Milk Report — ${model.name}`);

            const subscriberNameInput = new TextInputBuilder()
                .setCustomId('subscriber_name')
                .setLabel('Subscriber Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the subscriber name...')
                .setRequired(true);

            const amountSpentInput = new TextInputBuilder()
                .setCustomId('amount_spent')
                .setLabel('Amount Spent ($)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 150')
                .setRequired(true);

            const notesInput = new TextInputBuilder()
                .setCustomId('notes_completed')
                .setLabel('Did you fill out notes? (yes / no)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('yes or no')
                .setRequired(true)
                .setMaxLength(3);

            const aftercareInput = new TextInputBuilder()
                .setCustomId('aftercare_done')
                .setLabel('Did you do aftercare? (yes / no)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('yes or no')
                .setRequired(true)
                .setMaxLength(3);

            const issuesInput = new TextInputBuilder()
                .setCustomId('issues_description')
                .setLabel('Any issues? Describe or leave blank')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe any issues with this subscriber during the milk session, or leave empty if none...')
                .setRequired(false)
                .setMaxLength(1500);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(subscriberNameInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(amountSpentInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(aftercareInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(issuesInput),
            );

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Milk command error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
