import {
    ModalSubmitInteraction, StringSelectMenuInteraction,
    ChannelType, TextChannel, EmbedBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    ActionRowBuilder, AttachmentBuilder, MessageFlags
} from 'discord.js';
import prisma from '../lib/prisma';
import { formatDuration } from '../utils/shifts';
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

export default {
    // Step 1: Handle split partner select menu
    async handleSelectMenu(interaction: StringSelectMenuInteraction, params: string[]) {
        const [clockRecordId, modelId, guildDbId] = params.map(Number);
        const selectedValue = interaction.values[0]; // 'solo' or discordId
        const splitPartner = selectedValue === 'solo' ? '' : selectedValue;

        // Show modal for sales + summary (Step 2)
        const modal = new ModalBuilder()
            .setCustomId(`co_modal:${clockRecordId}:${modelId}:${guildDbId}:${splitPartner}`)
            .setTitle('Clock Out — Enter Sales');

        const totalSalesInput = new TextInputBuilder()
            .setCustomId('total_sales')
            .setLabel('Total Sales ($)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 1000')
            .setRequired(true);

        const shiftSummaryInput = new TextInputBuilder()
            .setCustomId('shift_summary')
            .setLabel('Shift Summary & Notes')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('What happened during your shift + notes for next chatter...')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(totalSalesInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(shiftSummaryInput),
        );

        await interaction.showModal(modal);
    },

    // Step 2: Handle modal submission → ask for file → complete clock-out
    async handleModal(interaction: ModalSubmitInteraction, params: string[]) {
        const [clockRecordId, modelId, guildDbId] = params.slice(0, 3).map(Number);
        const splitPartnerDiscordId = params[3] || null;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const totalSalesStr = interaction.fields.getTextInputValue('total_sales');
            const shiftSummary = interaction.fields.getTextInputValue('shift_summary');

            const totalSales = parseFloat(totalSalesStr);
            if (isNaN(totalSales) || totalSales < 0) {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Invalid total sales amount.');
                return interaction.editReply({ embeds: [embed] });
            }

            const clockRecord = await prisma.clockRecord.findUnique({
                where: { id: clockRecordId },
                include: { user: true, model: true },
            });
            if (!clockRecord || clockRecord.status !== 'ACTIVE') {
                const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Clock record not found or already completed.');
                return interaction.editReply({ embeds: [embed] });
            }

            // Step 3: Ask for file upload
            const fileEmbed = new EmbedBuilder()
                .setColor(0xF59E0B)
                .setTitle('📎 Upload Sales Tracker')
                .setDescription('**Step 3 of 3:** Upload your Sales Tracker file (Excel, CSV, or image) in this channel now.')
                .addFields({ name: '⏳ Time Limit', value: '60 seconds — clock-out will be cancelled if no file is uploaded.' })
                .setFooter({ text: 'Drag and drop or paste your file below' });

            await interaction.editReply({ embeds: [fileEmbed] });

            // Wait for file upload
            const channel = interaction.channel!;
            const filter = (msg: any) =>
                msg.author.id === interaction.user.id && msg.attachments.size > 0;

            let collected: any;
            try {
                collected = await (channel as TextChannel).awaitMessages({
                    filter,
                    max: 1,
                    time: 60_000,
                    errors: ['time'],
                });
            } catch {
                const cancelEmbed = new EmbedBuilder()
                    .setColor(0xEF4444)
                    .setTitle('❌ Clock-Out Cancelled')
                    .setDescription('You did not upload a sales tracker file in time.\nUse `/co` again to retry.');
                return interaction.followUp({ embeds: [cancelEmbed], flags: MessageFlags.Ephemeral });
            }

            const uploadedMessage = collected.first()!;
            const attachment = uploadedMessage.attachments.first()!;

            // Save file
            const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads');
            const fileName = `${clockRecord.discordUserId}_${clockRecordId}_${Date.now()}_${attachment.name}`;
            const filePath = path.join(uploadsDir, fileName);
            await downloadFile(attachment.url, filePath);

            const now = new Date();
            const shiftDuration = now.getTime() - clockRecord.clockIn.getTime();

            // Determine split
            let splitCount = 1;
            let splitPartnerClockRecord: any = null;
            let splitPartnerUser: any = null;

            if (splitPartnerDiscordId) {
                splitPartnerUser = await prisma.user.findUnique({ where: { discordId: splitPartnerDiscordId } });
                if (splitPartnerUser) {
                    splitPartnerClockRecord = await prisma.clockRecord.findFirst({
                        where: {
                            userId: splitPartnerUser.id,
                            modelId: clockRecord.modelId,
                            status: 'ACTIVE',
                        },
                    });
                    if (splitPartnerClockRecord) splitCount = 2;
                }
            }

            const splitAmount = totalSales / splitCount;

            const activePeriod = await prisma.payoutPeriod.findFirst({
                where: { status: 'ACTIVE' },
                orderBy: { startDate: 'desc' },
            });

            // Clock out main user
            await prisma.clockRecord.update({
                where: { id: clockRecordId },
                data: { clockOut: now, status: 'COMPLETED' },
            });

            // Create invoice
            await prisma.invoice.create({
                data: {
                    clockRecordId,
                    userId: clockRecord.userId,
                    modelId: clockRecord.modelId,
                    totalGross: totalSales,
                    splitCount,
                    splitAmount,
                    shiftSummary,
                    salesTrackerPath: fileName,
                    payoutPeriodId: activePeriod?.id,
                },
            });

            // If split partner, clock them out too
            if (splitPartnerClockRecord && splitPartnerUser) {
                await prisma.clockRecord.update({
                    where: { id: splitPartnerClockRecord.id },
                    data: { clockOut: now, status: 'COMPLETED' },
                });
                await prisma.invoice.create({
                    data: {
                        clockRecordId: splitPartnerClockRecord.id,
                        userId: splitPartnerUser.id,
                        modelId: clockRecord.modelId,
                        totalGross: totalSales,
                        splitCount,
                        splitAmount,
                        shiftSummary: `Split with ${clockRecord.user.discordUsername}. ${shiftSummary}`,
                        salesTrackerPath: fileName,
                        payoutPeriodId: activePeriod?.id,
                    },
                });
            }

            // Delete user's upload message
            try { await uploadedMessage.delete(); } catch { }

            // Build clock-out EMBED
            const timestamp = Math.floor(now.getTime() / 1000);
            const clockOutEmbed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle(`🔴 CLOCK OUT — ${clockRecord.model.name}`)
                .setDescription(
                    splitCount > 1 && splitPartnerUser
                        ? `<@${clockRecord.discordUserId}> and <@${splitPartnerUser.discordId}> have successfully clocked out!`
                        : `<@${clockRecord.discordUserId}> has successfully clocked out!`
                )
                .addFields(
                    { name: '💰 Total Sales', value: `**$${totalSales.toFixed(2)}**`, inline: true },
                    ...(splitCount > 1 ? [{ name: '👥 Split', value: `$${splitAmount.toFixed(2)}/person (${splitCount}-way)`, inline: true }] : []),
                    { name: '⏰ Clock Out', value: `<t:${timestamp}:F>`, inline: true },
                    { name: '⏱️ Duration', value: formatDuration(shiftDuration), inline: true },
                    { name: '📎 Sales Tracker', value: '✅ Uploaded', inline: true },
                    { name: '📝 Shift Summary', value: shiftSummary },
                )
                .setTimestamp()
                .setFooter({ text: 'OF MGMT Bot' });

            // Send public embed
            await (channel as TextChannel).send({ embeds: [clockOutEmbed] });

            // Send to #sales-file with file attachment
            const guild = interaction.guild!;
            const category = guild.channels.cache.get(clockRecord.model.discordCategoryId || '');
            if (category && category.type === ChannelType.GuildCategory) {
                const salesChannel = category.children.cache.find(
                    ch => ch.name === 'sales-file' && ch.type === ChannelType.GuildText
                ) as TextChannel | undefined;

                if (salesChannel) {
                    const salesEmbed = new EmbedBuilder()
                        .setColor(0x6366F1)
                        .setTitle(`📊 Sales Report — ${clockRecord.model.name}`)
                        .addFields(
                            { name: '👤 Chatter', value: `<@${clockRecord.discordUserId}>${splitPartnerUser ? ` & <@${splitPartnerUser.discordId}>` : ''}`, inline: true },
                            { name: '💰 Total', value: `$${totalSales.toFixed(2)}${splitCount > 1 ? ` ($${splitAmount.toFixed(2)}/ea)` : ''}`, inline: true },
                            { name: '⏰ Date', value: `<t:${timestamp}:F>`, inline: true },
                            { name: '📝 Summary', value: shiftSummary },
                        )
                        .setTimestamp();

                    const fileAttachment = new AttachmentBuilder(filePath, { name: attachment.name });
                    await salesChannel.send({ embeds: [salesEmbed], files: [fileAttachment] });
                }
            }

            // Confirm to user
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle('✅ Clock-Out Complete')
                .setDescription('Your sales tracker has been saved and sent to the sales-file channel.');
            await interaction.followUp({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });

            // DM earnings
            try {
                const mainUser = await guild.members.fetch(clockRecord.discordUserId);
                const dmEmbed = new EmbedBuilder()
                    .setColor(0x6366F1)
                    .setTitle(`📋 Shift Report — ${clockRecord.model.name}`)
                    .addFields(
                        { name: '💰 Your Earnings', value: `**$${splitAmount.toFixed(2)}**${splitCount > 1 ? ` (split from $${totalSales.toFixed(2)})` : ''}`, inline: true },
                        { name: '⏱️ Duration', value: formatDuration(shiftDuration), inline: true },
                        { name: '⏰ Clock Out', value: `<t:${timestamp}:F>`, inline: true },
                        { name: '📎 Sales Tracker', value: '✅ Saved' },
                    )
                    .setTimestamp();
                await mainUser.send({ embeds: [dmEmbed] });
            } catch { console.log('Could not DM main user'); }

            if (splitPartnerUser) {
                try {
                    const partnerMember = await guild.members.fetch(splitPartnerUser.discordId!);
                    const partnerEmbed = new EmbedBuilder()
                        .setColor(0x6366F1)
                        .setTitle(`📋 Shift Report — ${clockRecord.model.name}`)
                        .addFields(
                            { name: '💰 Your Earnings', value: `**$${splitAmount.toFixed(2)}** (split from $${totalSales.toFixed(2)})`, inline: true },
                            { name: '👥 Split With', value: clockRecord.user.discordUsername || 'Unknown', inline: true },
                            { name: '⏰ Clock Out', value: `<t:${timestamp}:F>`, inline: true },
                        )
                        .setTimestamp();
                    await partnerMember.send({ embeds: [partnerEmbed] });
                } catch { console.log('Could not DM split partner'); }
            }

        } catch (error) {
            console.error('Clock-out modal error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred processing your clock out.');
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
