import {
    StringSelectMenuInteraction, ModalSubmitInteraction, ButtonInteraction,
    ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ChannelType, TextChannel, EmbedBuilder, MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';

const TICKET_MODALS: Record<string, { title: string; fields: { id: string; label: string; style: TextInputStyle; placeholder: string; required: boolean }[] }> = {
    COVERAGE: {
        title: 'Coverage Request',
        fields: [
            { id: 'reason', label: 'Reason', style: TextInputStyle.Paragraph, placeholder: 'Why do you need coverage?', required: true },
            { id: 'date', label: 'Date (DD/MM/YYYY)', style: TextInputStyle.Short, placeholder: '25/02/2026', required: true },
            { id: 'shift', label: 'Shift', style: TextInputStyle.Short, placeholder: 'Morning / Afternoon / Night', required: true },
        ],
    },
    MUTE: {
        title: 'Mute Approval',
        fields: [
            { id: 'subscriber', label: 'Subscriber Name', style: TextInputStyle.Short, placeholder: 'Name of subscriber to mute', required: true },
            { id: 'reason', label: 'Reason', style: TextInputStyle.Paragraph, placeholder: 'Why should this subscriber be muted?', required: true },
        ],
    },
    CUSTOM: {
        title: 'Custom Content Request',
        fields: [
            { id: 'subscriber', label: 'Subscriber Name', style: TextInputStyle.Short, placeholder: 'Subscriber name', required: true },
            { id: 'description', label: 'What does the subscriber want?', style: TextInputStyle.Paragraph, placeholder: 'Describe the custom content request...', required: true },
        ],
    },
    OUTAGE: {
        title: 'Outage Report',
        fields: [
            { id: 'description', label: 'What happened?', style: TextInputStyle.Paragraph, placeholder: 'CRM down, power outage, internet issues...', required: true },
        ],
    },
    EMERGENCY: {
        title: 'Emergency Report',
        fields: [
            { id: 'description', label: 'Emergency Description', style: TextInputStyle.Paragraph, placeholder: 'Describe the emergency situation in detail...', required: true },
        ],
    },
    SPENDER: {
        title: 'Spender Update',
        fields: [
            { id: 'subscriber', label: 'Subscriber Name', style: TextInputStyle.Short, placeholder: 'Subscriber/spender name', required: true },
            { id: 'update', label: 'Update Details', style: TextInputStyle.Paragraph, placeholder: 'What\'s the update about this subscriber?', required: true },
        ],
    },
};

const PURPOSE_EMOJI: Record<string, string> = {
    COVERAGE: '📋', MUTE: '🔇', CUSTOM: '🎨', OUTAGE: '⚡', EMERGENCY: '🚨', SPENDER: '💰',
};

export default {
    async handleSelect(interaction: StringSelectMenuInteraction) {
        const purpose = interaction.values[0];
        const config = TICKET_MODALS[purpose];
        if (!config) {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Invalid option.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const channel = interaction.channel!;
        const parentChannel = 'parent' in channel ? channel.parent : null;

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal:${purpose}:${parentChannel?.id || ''}`)
            .setTitle(config.title);

        for (const field of config.fields) {
            const input = new TextInputBuilder()
                .setCustomId(field.id)
                .setLabel(field.label)
                .setStyle(field.style)
                .setPlaceholder(field.placeholder)
                .setRequired(field.required);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        }

        await interaction.showModal(modal);
    },

    async handleModal(interaction: ModalSubmitInteraction, params: string[]) {
        const [purpose, categoryId] = params;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const guild = interaction.guild!;
            const discordUserId = interaction.user.id;

            const dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Guild not set up.');
                return interaction.editReply({ embeds: [embed] });
            }

            const model = await prisma.onlyFansModel.findFirst({
                where: { discordCategoryId: categoryId, guildId: dbGuild.id },
            });
            if (!model) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.');
                return interaction.editReply({ embeds: [embed] });
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

            // Collect form data
            const data: Record<string, string> = {};
            const config = TICKET_MODALS[purpose];
            for (const field of config.fields) {
                try {
                    data[field.id] = interaction.fields.getTextInputValue(field.id);
                } catch { /* optional field */ }
            }

            const title = config.title;
            const description = Object.entries(data).map(([k, v]) => `**${k}:** ${v}`).join('\n');

            // Create ticket in DB
            const ticket = await prisma.ticket.create({
                data: {
                    userId: user.id,
                    modelId: model.id,
                    guildId: dbGuild.id,
                    purpose,
                    title,
                    description,
                    data: JSON.stringify(data),
                },
            });

            // Find the update channel (e.g. lara-update, mia-update)
            const category = guild.channels.cache.get(categoryId);
            let targetChannel: TextChannel | undefined;
            if (category && category.type === ChannelType.GuildCategory) {
                targetChannel = category.children.cache.find(
                    ch => ch.name.endsWith('-update') && ch.type === ChannelType.GuildText
                ) as TextChannel | undefined;
            }

            const needsApproval = ['MUTE', 'CUSTOM'].includes(purpose);
            const emoji = PURPOSE_EMOJI[purpose] || '🎫';

            // Build ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setColor(purpose === 'EMERGENCY' ? 0xEF4444 : 0x6366F1)
                .setTitle(`${emoji} ${title} — ${model.name}`)
                .addFields(
                    { name: '👤 Submitted by', value: `<@${discordUserId}>`, inline: true },
                    { name: '📁 Model', value: model.name, inline: true },
                    ...Object.entries(data).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v || 'N/A' })),
                )
                .setTimestamp()
                .setFooter({ text: needsApproval ? 'Awaiting approval from Supervisors/Managers' : 'OF MGMT Bot' });

            if (targetChannel) {
                if (needsApproval) {
                    const approveBtn = new ButtonBuilder()
                        .setCustomId(`ticket_approve:${ticket.id}`)
                        .setLabel('✅ Approve')
                        .setStyle(ButtonStyle.Success);
                    const rejectBtn = new ButtonBuilder()
                        .setCustomId(`ticket_reject:${ticket.id}`)
                        .setLabel('❌ Reject')
                        .setStyle(ButtonStyle.Danger);
                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, rejectBtn);

                    const sent = await targetChannel.send({ embeds: [ticketEmbed], components: [row] });
                    await prisma.ticket.update({ where: { id: ticket.id }, data: { discordMessageId: sent.id } });
                } else {
                    const sent = await targetChannel.send({ embeds: [ticketEmbed] });
                    await prisma.ticket.update({ where: { id: ticket.id }, data: { discordMessageId: sent.id } });
                }
            }

            // DM supervisors for tickets that need approval OR emergencies
            if (needsApproval || purpose === 'EMERGENCY') {
                // Build jump URL if we have a sent message
                let jumpUrl: string | undefined;
                if (targetChannel) {
                    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
                    if (updatedTicket?.discordMessageId) {
                        jumpUrl = `https://discord.com/channels/${guild.id}/${targetChannel.id}/${updatedTicket.discordMessageId}`;
                    }
                }

                // Fetch ALL guild members to ensure we don't miss anyone
                await guild.members.fetch();

                const rolesToNotify = ['Supervisor', 'Admin', 'Manager', 'Founder'];
                for (const roleName of rolesToNotify) {
                    const role = guild.roles.cache.find(r => r.name === roleName);
                    if (role) {
                        const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id));
                        for (const [, member] of membersWithRole) {
                            try {
                                const dmEmbed = new EmbedBuilder()
                                    .setColor(purpose === 'EMERGENCY' ? 0xEF4444 : 0xF59E0B)
                                    .setTitle(`${emoji} ${title} — ${model.name}`)
                                    .addFields(
                                        { name: '👤 From', value: interaction.user.username, inline: true },
                                        { name: '📁 Model', value: model.name, inline: true },
                                        ...Object.entries(data).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v })),
                                    )
                                    .setTimestamp();

                                if (jumpUrl) {
                                    dmEmbed.addFields({ name: '🔗 Jump to Ticket', value: `[Click here to review](${jumpUrl})` });
                                }
                                if (needsApproval) {
                                    dmEmbed.setFooter({ text: 'Use the buttons on the message to approve or reject' });
                                }

                                await member.send({ embeds: [dmEmbed] });
                            } catch (e) { /* Can't DM */ }
                        }
                    }
                }
            }

            const successEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setDescription(`✅ Your **${config.title}** ticket has been submitted!${needsApproval ? ' Waiting for approval.' : ''}`);
            await interaction.editReply({ embeds: [successEmbed] });
        } catch (error) {
            console.error('Ticket modal error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred creating the ticket.');
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleButton(interaction: ButtonInteraction, action: string, params: string[]) {
        const ticketId = parseInt(params[0]);
        const member = interaction.member as any;

        const hasPermission = member.roles.cache.some(
            (r: any) => ['Supervisor', 'Manager', 'Admin', 'Founder'].includes(r.name)
        );
        if (!hasPermission) {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Only Supervisors/Managers/Admins can do this.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        try {
            const ticket = await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: { user: true, model: true },
            });
            if (!ticket) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Ticket not found.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            if (ticket.status !== 'OPEN') {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription(`❌ Ticket already ${ticket.status.toLowerCase()}.`);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const status = action === 'ticket_approve' ? 'APPROVED' : 'REJECTED';
            await prisma.ticket.update({ where: { id: ticketId }, data: { status } });

            const isApproved = status === 'APPROVED';
            const emoji = PURPOSE_EMOJI[ticket.purpose] || '🎫';
            const ticketData = JSON.parse(ticket.data as string || '{}');

            // Update original message with result
            const resultEmbed = new EmbedBuilder()
                .setColor(isApproved ? 0x22C55E : 0xEF4444)
                .setTitle(`${emoji} ${ticket.title} — ${ticket.model.name}`)
                .addFields(
                    { name: '👤 Submitted by', value: `<@${ticket.user.discordId}>`, inline: true },
                    { name: '📁 Model', value: ticket.model.name, inline: true },
                    ...Object.entries(ticketData).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: String(v) })),
                    { name: isApproved ? '✅ Approved' : '❌ Rejected', value: `by <@${interaction.user.id}>` },
                )
                .setTimestamp();

            await interaction.update({ embeds: [resultEmbed], components: [] });

            // DM ticket creator
            if (ticket.user.discordId) {
                try {
                    const guild = interaction.guild!;
                    const creator = await guild.members.fetch(ticket.user.discordId);
                    const dmEmbed = new EmbedBuilder()
                        .setColor(isApproved ? 0x22C55E : 0xEF4444)
                        .setTitle(`${isApproved ? '✅' : '❌'} ${ticket.title} — ${status}`)
                        .addFields(
                            { name: '📁 Model', value: ticket.model.name, inline: true },
                            { name: 'Reviewed by', value: interaction.user.username, inline: true },
                        );
                    await creator.send({ embeds: [dmEmbed] });
                } catch (e) { /* Can't DM */ }
            }
        } catch (error) {
            console.error('Ticket button error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
