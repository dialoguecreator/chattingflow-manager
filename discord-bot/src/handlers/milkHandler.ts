import {
    ModalSubmitInteraction, ButtonInteraction,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    TextChannel, EmbedBuilder, MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = fs.createWriteStream(dest);
        const client = url.startsWith('https') ? https : http;
        client.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => { fs.unlink(dest, () => { }); reject(err); });
    });
}

function parseYesNo(value: string): boolean {
    return ['yes', 'y', 'da'].includes(value.trim().toLowerCase());
}

export default {
    async handleModal(interaction: ModalSubmitInteraction, params: string[]) {
        const [action, ...rest] = [interaction.customId.split(':')[0], ...params];

        // Rejection reason modal
        if (action === 'milk_reject_modal') {
            return this.handleRejectModal(interaction, params);
        }

        const [modelId, guildDbId] = params.map(Number);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const subscriberName = interaction.fields.getTextInputValue('subscriber_name');
            const amountSpentStr = interaction.fields.getTextInputValue('amount_spent');
            const notesRaw = interaction.fields.getTextInputValue('notes_completed');
            const aftercareRaw = interaction.fields.getTextInputValue('aftercare_done');
            const issuesDescription = interaction.fields.getTextInputValue('issues_description');

            const amountSpent = parseFloat(amountSpentStr);
            if (isNaN(amountSpent) || amountSpent < 0) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Invalid amount. Please enter a valid number.');
                return interaction.editReply({ embeds: [embed] });
            }

            const notesCompleted = parseYesNo(notesRaw);
            const aftercareDone = parseYesNo(aftercareRaw);
            const hasIssues = issuesDescription.trim().length > 0;

            const discordUserId = interaction.user.id;
            const guild = interaction.guild!;

            // Find or create user
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

            const model = await prisma.onlyFansModel.findUnique({ where: { id: modelId } });
            if (!model) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.');
                return interaction.editReply({ embeds: [embed] });
            }

            // Ask for screenshot upload
            const fileEmbed = new EmbedBuilder()
                .setColor(0xF59E0B)
                .setTitle('📸 Upload Chat Screenshot')
                .setDescription('Please upload a screenshot of your chat with this subscriber.')
                .addFields({ name: '⏳ Time Limit', value: '60 seconds — the report will be saved without a screenshot if none is uploaded.' })
                .setFooter({ text: 'Drag and drop or paste your screenshot below' });

            await interaction.editReply({ embeds: [fileEmbed] });

            // Wait for screenshot upload
            const channel = interaction.channel!;
            const filter = (msg: any) =>
                msg.author.id === interaction.user.id && msg.attachments.size > 0;

            let screenshotPath: string | null = null;

            try {
                const collected = await (channel as TextChannel).awaitMessages({
                    filter,
                    max: 1,
                    time: 60_000,
                    errors: ['time'],
                });

                const uploadedMessage = collected.first()!;
                const attachment = uploadedMessage.attachments.first()!;

                // Save screenshot
                const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'milk');
                const fileName = `milk_${discordUserId}_${Date.now()}_${attachment.name}`;
                const filePath = path.join(uploadsDir, fileName);
                await downloadFile(attachment.url, filePath);
                screenshotPath = `milk/${fileName}`;

                // Delete user's upload message for cleanliness
                try { await uploadedMessage.delete(); } catch { }
            } catch {
                // Timeout — continue without screenshot
            }

            // Save milk report to database
            const milkReport = await prisma.milkReport.create({
                data: {
                    userId: user.id,
                    modelId: model.id,
                    guildId: guildDbId,
                    subscriberName,
                    amountSpent,
                    notesCompleted,
                    aftercareDone,
                    hasIssues,
                    issueDescription: hasIssues ? issuesDescription.trim() : null,
                    screenshotPath,
                    status: 'PENDING',
                },
            });

            // Build approve/reject buttons
            const approveButton = new ButtonBuilder()
                .setCustomId(`milk_approve:${milkReport.id}`)
                .setLabel('✅ Approve Milk')
                .setStyle(ButtonStyle.Success);

            const rejectButton = new ButtonBuilder()
                .setCustomId(`milk_reject:${milkReport.id}`)
                .setLabel('❌ Reject Milk')
                .setStyle(ButtonStyle.Danger);

            const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);

            // Post summary embed in #milk channel with buttons
            const summaryEmbed = new EmbedBuilder()
                .setColor(0x6366F1)
                .setTitle(`🥛 Milk Report — ${model.name}`)
                .addFields(
                    { name: '👤 Chatter', value: `<@${discordUserId}>`, inline: true },
                    { name: '📁 Model', value: model.name, inline: true },
                    { name: '🧑 Subscriber', value: subscriberName, inline: true },
                    { name: '💰 Amount Spent', value: `$${amountSpent.toFixed(2)}`, inline: true },
                    { name: '📝 Notes', value: notesCompleted ? '✅ Yes' : '❌ No', inline: true },
                    { name: '💆 Aftercare', value: aftercareDone ? '✅ Yes' : '❌ No', inline: true },
                    { name: '⚠️ Issues', value: hasIssues ? issuesDescription.trim() : 'None', inline: false },
                    { name: '📸 Screenshot', value: screenshotPath ? '✅ Uploaded' : '❌ Not uploaded', inline: true },
                    { name: '📋 Status', value: '⏳ Pending Review', inline: true },
                )
                .setTimestamp()
                .setFooter({ text: `Report #${milkReport.id} • Supervisors/Managers: Use buttons below to approve or reject` });

            const sentMessage = await (channel as TextChannel).send({
                embeds: [summaryEmbed],
                components: [buttonRow],
            });

            // Save the discord message ID so we can update it later
            await prisma.milkReport.update({
                where: { id: milkReport.id },
                data: { discordMessageId: sentMessage.id },
            });

            // DM supervisors, managers, admins, founders
            const rolesToNotify = ['Supervisor', 'Manager', 'Admin', 'Founder'];
            for (const roleName of rolesToNotify) {
                const role = guild.roles.cache.find(r => r.name === roleName);
                if (role) {
                    for (const [, member] of role.members) {
                        try {
                            const dmEmbed = new EmbedBuilder()
                                .setColor(0xF59E0B)
                                .setTitle(`🥛 New Milk Report — ${model.name}`)
                                .addFields(
                                    { name: '👤 Chatter', value: interaction.user.username, inline: true },
                                    { name: '📁 Model', value: model.name, inline: true },
                                    { name: '🧑 Subscriber', value: subscriberName, inline: true },
                                    { name: '💰 Amount Spent', value: `$${amountSpent.toFixed(2)}`, inline: true },
                                    { name: '📝 Notes', value: notesCompleted ? '✅ Yes' : '❌ No', inline: true },
                                    { name: '💆 Aftercare', value: aftercareDone ? '✅ Yes' : '❌ No', inline: true },
                                    { name: '⚠️ Issues', value: hasIssues ? issuesDescription.trim() : 'None', inline: false },
                                )
                                .setTimestamp()
                                .setFooter({ text: `Report #${milkReport.id} • Check the #milk channel to approve/reject` });
                            await member.send({ embeds: [dmEmbed] });
                        } catch (e) { /* Can't DM this member */ }
                    }
                }
            }

            // Confirm to the chatter
            const successEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setDescription(`✅ Your milk report for **${subscriberName}** has been submitted and is pending review!`);
            await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

        } catch (error) {
            console.error('Milk modal error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred processing your milk report.');
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleButton(interaction: ButtonInteraction, action: string, params: string[]) {
        const milkId = parseInt(params[0]);
        const member = interaction.member as any;

        // Check permissions — only Supervisor/Manager/Admin/Founder
        const hasPermission = member.roles.cache.some(
            (r: any) => ['Supervisor', 'Manager', 'Admin', 'Founder'].includes(r.name)
        );
        if (!hasPermission) {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Only Supervisors/Managers/Admins can approve or reject milk reports.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        try {
            const milk = await prisma.milkReport.findUnique({
                where: { id: milkId },
                include: { user: true, model: true },
            });
            if (!milk) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Milk report not found.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            if (milk.status !== 'PENDING') {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription(`❌ This report has already been ${milk.status.toLowerCase()}.`);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (action === 'milk_approve') {
                // Approve directly
                const reviewer = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });

                await prisma.milkReport.update({
                    where: { id: milkId },
                    data: { status: 'APPROVED', reviewedById: reviewer?.id },
                });

                // Update original embed
                const approvedEmbed = new EmbedBuilder()
                    .setColor(0x22C55E)
                    .setTitle(`🥛 Milk Report — ${milk.model.name}`)
                    .addFields(
                        { name: '👤 Chatter', value: `<@${milk.user.discordId}>`, inline: true },
                        { name: '📁 Model', value: milk.model.name, inline: true },
                        { name: '🧑 Subscriber', value: milk.subscriberName, inline: true },
                        { name: '💰 Amount Spent', value: `$${milk.amountSpent.toFixed(2)}`, inline: true },
                        { name: '📝 Notes', value: milk.notesCompleted ? '✅ Yes' : '❌ No', inline: true },
                        { name: '💆 Aftercare', value: milk.aftercareDone ? '✅ Yes' : '❌ No', inline: true },
                        { name: '⚠️ Issues', value: milk.hasIssues ? (milk.issueDescription || 'Yes') : 'None', inline: false },
                        { name: '✅ Approved', value: `by <@${interaction.user.id}>`, inline: true },
                    )
                    .setTimestamp()
                    .setFooter({ text: `Report #${milk.id}` });

                await interaction.update({
                    embeds: [approvedEmbed],
                    components: [], // Remove buttons
                });

                // DM the chatter that their milk was approved
                if (milk.user.discordId) {
                    try {
                        const guild = interaction.guild!;
                        const chatter = await guild.members.fetch(milk.user.discordId);
                        const dmEmbed = new EmbedBuilder()
                            .setColor(0x22C55E)
                            .setTitle('✅ Milk Report Approved!')
                            .addFields(
                                { name: '📁 Model', value: milk.model.name, inline: true },
                                { name: '🧑 Subscriber', value: milk.subscriberName, inline: true },
                                { name: '💰 Amount', value: `$${milk.amountSpent.toFixed(2)}`, inline: true },
                                { name: 'Approved by', value: interaction.user.username, inline: true },
                            )
                            .setDescription('Your milk report has been approved! You can claim this amount.')
                            .setTimestamp();
                        await chatter.send({ embeds: [dmEmbed] });
                    } catch (e) { /* Can't DM */ }
                }
            }

            if (action === 'milk_reject') {
                // Show modal for rejection reason
                const modal = new ModalBuilder()
                    .setCustomId(`milk_reject_modal:${milkId}`)
                    .setTitle('Reject Milk Report');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reject_reason')
                    .setLabel('Reason for rejection')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Explain what needs to be fixed for this milk to be valid...')
                    .setRequired(true)
                    .setMaxLength(1500);

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
                );

                await interaction.showModal(modal);
            }
        } catch (error) {
            console.error('Milk button error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },

    async handleRejectModal(interaction: ModalSubmitInteraction, params: string[]) {
        const milkId = parseInt(params[0]);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const rejectReason = interaction.fields.getTextInputValue('reject_reason');

            const milk = await prisma.milkReport.findUnique({
                where: { id: milkId },
                include: { user: true, model: true },
            });
            if (!milk) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Milk report not found.');
                return interaction.editReply({ embeds: [embed] });
            }

            const reviewer = await prisma.user.findUnique({ where: { discordId: interaction.user.id } });

            await prisma.milkReport.update({
                where: { id: milkId },
                data: {
                    status: 'REJECTED',
                    reviewedById: reviewer?.id,
                    reviewNote: rejectReason,
                },
            });

            // Find the original message and update it
            const channel = interaction.channel!;
            if (milk.discordMessageId) {
                try {
                    const originalMessage = await (channel as TextChannel).messages.fetch(milk.discordMessageId);
                    const rejectedEmbed = new EmbedBuilder()
                        .setColor(0xEF4444)
                        .setTitle(`🥛 Milk Report — ${milk.model.name}`)
                        .addFields(
                            { name: '👤 Chatter', value: `<@${milk.user.discordId}>`, inline: true },
                            { name: '📁 Model', value: milk.model.name, inline: true },
                            { name: '🧑 Subscriber', value: milk.subscriberName, inline: true },
                            { name: '💰 Amount Spent', value: `$${milk.amountSpent.toFixed(2)}`, inline: true },
                            { name: '📝 Notes', value: milk.notesCompleted ? '✅ Yes' : '❌ No', inline: true },
                            { name: '💆 Aftercare', value: milk.aftercareDone ? '✅ Yes' : '❌ No', inline: true },
                            { name: '⚠️ Issues', value: milk.hasIssues ? (milk.issueDescription || 'Yes') : 'None', inline: false },
                            { name: '❌ Rejected', value: `by <@${interaction.user.id}>`, inline: true },
                            { name: '📝 Reason', value: rejectReason, inline: false },
                        )
                        .setTimestamp()
                        .setFooter({ text: `Report #${milk.id}` });

                    await originalMessage.edit({
                        embeds: [rejectedEmbed],
                        components: [], // Remove buttons
                    });
                } catch (e) { console.log('Could not update original message:', e); }
            }

            // DM the chatter that their milk was rejected
            if (milk.user.discordId) {
                try {
                    const guild = interaction.guild!;
                    const chatter = await guild.members.fetch(milk.user.discordId);
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xEF4444)
                        .setTitle('❌ Milk Report Rejected')
                        .addFields(
                            { name: '📁 Model', value: milk.model.name, inline: true },
                            { name: '🧑 Subscriber', value: milk.subscriberName, inline: true },
                            { name: '💰 Amount', value: `$${milk.amountSpent.toFixed(2)}`, inline: true },
                            { name: 'Rejected by', value: interaction.user.username, inline: true },
                            { name: '📝 Reason', value: rejectReason, inline: false },
                        )
                        .setDescription('Please review the reason above and resubmit a corrected milk report.')
                        .setTimestamp();
                    await chatter.send({ embeds: [dmEmbed] });
                } catch (e) { /* Can't DM */ }
            }

            const successEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setDescription(`✅ Milk report #${milkId} has been rejected. The chatter has been notified.`);
            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Milk reject modal error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
