import {
    SlashCommandBuilder, ChatInputCommandInteraction,
    StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, MessageFlags
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a ticket (coverage, mute, custom, outage, emergency, spender)'),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel!;

        if (!('name' in channel) || channel.name !== 'model-update') {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ This command can only be used in a `#model-update` channel.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_purpose')
            .setPlaceholder('Select ticket purpose...')
            .addOptions([
                { label: '📋 Coverage Request', value: 'COVERAGE', description: 'Request coverage for a shift' },
                { label: '🔇 Mute Approval', value: 'MUTE', description: 'Request to mute a subscriber' },
                { label: '🎨 Custom Request', value: 'CUSTOM', description: 'Custom content request from subscriber' },
                { label: '⚡ Outage', value: 'OUTAGE', description: 'Report CRM/power/internet outage' },
                { label: '🚨 Emergency Report', value: 'EMERGENCY', description: 'Urgent emergency report' },
                { label: '💰 Spender Update', value: 'SPENDER', description: 'Update about a spender/subscriber' },
            ]);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0x6366F1)
            .setTitle('🎫 Create a Ticket')
            .setDescription('Select the purpose of your ticket from the dropdown below.');

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });
    },
};
