import {
    ModalSubmitInteraction, ButtonInteraction,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ChannelType, TextChannel, EmbedBuilder, MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';

import { getMembersWithRoles } from '../utils/memberCache';

export default {
    async handleModal(interaction: ModalSubmitInteraction, params: string[]) {
        const [modelId, guildDbId] = params.map(Number);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const message = interaction.fields.getTextInputValue('mma_message');
            const discordUserId = interaction.user.id;
            const guild = interaction.guild!;

            console.log(`[MMA] Modal submitted by ${interaction.user.username} (${discordUserId}) for model ${modelId}`);

            let user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
            if (!user) {
                console.log(`[MMA] Creating new user for ${interaction.user.username}`);
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

            const model = await prisma.onlyFansModel.findUnique({ where: { id: modelId } });
            if (!model) {
                console.error(`[MMA] Model ${modelId} not found`);
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.');
                return interaction.editReply({ embeds: [embed] });
            }

            console.log(`[MMA] Creating MMA request for ${model.name} by ${user.username}`);

            // Create MMA request
            const mmaRequest = await prisma.massMessageRequest.create({
                data: {
                    userId: user.id,
                    modelId: model.id,
                    guildId: guildDbId,
                    message: message,
                },
            });

            console.log(`[MMA] Created MMA request #${mmaRequest.id}`);

            // Find #mass-message channel in the model's category
            const category = guild.channels.cache.get(model.discordCategoryId || '');
            if (category && category.type === ChannelType.GuildCategory) {
                const massMessageChannel = category.children.cache.find(
                    ch => ch.name === 'mass-message' && ch.type === ChannelType.GuildText
                ) as TextChannel | undefined;

                if (massMessageChannel) {
                    const approveButton = new ButtonBuilder()
                        .setCustomId(`mma_approve:${mmaRequest.id}`)
                        .setLabel('✅ Approve')
                        .setStyle(ButtonStyle.Success);

                    const rejectButton = new ButtonBuilder()
                        .setCustomId(`mma_reject:${mmaRequest.id}`)
                        .setLabel('❌ Reject')
                        .setStyle(ButtonStyle.Danger);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);

                    const requestEmbed = new EmbedBuilder()
                        .setColor(0x6366F1)
                        .setTitle(`📨 Mass Message Request — ${model.name}`)
                        .addFields(
                            { name: '👤 Submitted by', value: `<@${discordUserId}>`, inline: true },
                            { name: '📁 Model', value: model.name, inline: true },
                            { name: '💬 Message Idea', value: message },
                        )
                        .setFooter({ text: 'Supervisors/Managers: Use the buttons below to approve or reject' })
                        .setTimestamp();

                    const sentMessage = await massMessageChannel.send({
                        embeds: [requestEmbed],
                        components: [row],
                    });

                    await prisma.massMessageRequest.update({
                        where: { id: mmaRequest.id },
                        data: { discordMessageId: sentMessage.id },
                    });

                    console.log(`[MMA] Posted request #${mmaRequest.id} in #mass-message (${massMessageChannel.id})`);
                } else {
                    console.warn(`[MMA] No #mass-message channel found in category ${category.name} (${category.id})`);
                }
            } else {
                console.warn(`[MMA] Category not found for model ${model.name} (discordCategoryId: ${model.discordCategoryId})`);
            }

            // DM supervisors, managers, admins, founders
            const rolesToNotify = ['Supervisor', 'Manager', 'Admin', 'Founder'];

            // Build jump URL from the sentMessage posted in #mass-message
            let jumpUrl: string | undefined;
            if (category && category.type === ChannelType.GuildCategory) {
                const mmChannel = category.children.cache.find(
                    ch => ch.name === 'mass-message' && ch.type === ChannelType.GuildText
                );
                if (mmChannel) {
                    const updatedMma = await prisma.massMessageRequest.findUnique({ where: { id: mmaRequest.id } });
                    if (updatedMma?.discordMessageId) {
                        jumpUrl = `https://discord.com/channels/${guild.id}/${mmChannel.id}/${updatedMma.discordMessageId}`;
                    }
                }
            }

            // Get unique members with notification roles (uses cached members, no rate limit)
            const notifyMembers = await getMembersWithRoles(guild, rolesToNotify);

            console.log(`[MMA] Sending DMs to ${notifyMembers.size} unique members for MMA #${mmaRequest.id}`);

            for (const [, member] of notifyMembers) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xF59E0B)
                        .setTitle('📨 New Mass Message Request')
                        .addFields(
                            { name: '👤 From', value: interaction.user.username, inline: true },
                            { name: '📁 Model', value: model.name, inline: true },
                            { name: '💬 Idea', value: message },
                        )
                        .setTimestamp();

                    if (jumpUrl) {
                        dmEmbed.addFields({ name: '🔗 Jump to Request', value: `[Click here to go to the request](${jumpUrl})` });
                    } else {
                        dmEmbed.setFooter({ text: 'Check the #mass-message channel to approve/reject' });
                    }

                    await member.send({ embeds: [dmEmbed] });
                } catch (e) {
                    console.error(`[MMA DM] Failed to DM ${member.user?.tag || member.id}:`, e);
                }
            }

            const successEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setDescription('✅ Your mass message idea has been submitted for approval!');
            await interaction.editReply({ embeds: [successEmbed] });
        } catch (error) {
            console.error('[MMA] Modal handler error:', error);
            try {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred while submitting your mass message request. Please try again.');
                await interaction.editReply({ embeds: [embed] });
            } catch (e) {
                console.error('[MMA] Failed to send error reply:', e);
            }
        }
    },

    async handleButton(interaction: ButtonInteraction, action: string, params: string[]) {
        const mmaId = parseInt(params[0]);
        const member = interaction.member as any;

        // Check permissions
        const hasPermission = member.roles.cache.some(
            (r: any) => ['Supervisor', 'Manager', 'Admin', 'Founder'].includes(r.name)
        );
        if (!hasPermission) {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Only Supervisors/Managers/Admins can do this.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        try {
            const mma = await prisma.massMessageRequest.findUnique({
                where: { id: mmaId },
                include: { user: true, model: true },
            });
            if (!mma) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Request not found.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            if (mma.status !== 'PENDING') {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription(`❌ Already ${mma.status.toLowerCase()}.`);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const reviewer = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });
            const status = action === 'mma_approve' ? 'APPROVED' : 'REJECTED';

            await prisma.massMessageRequest.update({
                where: { id: mmaId },
                data: { status, reviewedById: reviewer?.id },
            });

            const isApproved = status === 'APPROVED';

            // Update the original message with result embed
            const resultEmbed = new EmbedBuilder()
                .setColor(isApproved ? 0x22C55E : 0xEF4444)
                .setTitle(`📨 Mass Message Request — ${mma.model.name}`)
                .addFields(
                    { name: '👤 Submitted by', value: `<@${mma.user.discordId}>`, inline: true },
                    { name: '📁 Model', value: mma.model.name, inline: true },
                    { name: '💬 Message Idea', value: mma.message },
                    { name: isApproved ? '✅ Approved' : '❌ Rejected', value: `by <@${interaction.user.id}>`, inline: true },
                )
                .setTimestamp();

            await interaction.update({
                embeds: [resultEmbed],
                components: [],
            });

            // DM the requester
            if (mma.user.discordId) {
                try {
                    const guild = interaction.guild!;
                    const requester = await guild.members.fetch(mma.user.discordId);
                    const dmEmbed = new EmbedBuilder()
                        .setColor(isApproved ? 0x22C55E : 0xEF4444)
                        .setTitle(`${isApproved ? '✅' : '❌'} Mass Message ${status}`)
                        .addFields(
                            { name: '📁 Model', value: mma.model.name, inline: true },
                            { name: 'Reviewed by', value: interaction.user.username, inline: true },
                            { name: '💬 Your Idea', value: mma.message },
                        );
                    await requester.send({ embeds: [dmEmbed] });
                } catch (e) { /* Can't DM */ }
            }
        } catch (error) {
            console.error('MMA button error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
