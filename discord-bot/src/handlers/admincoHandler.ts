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
    // Step 1: Admin selects which chatter to clock out
    async handleSelectMenu(interaction: StringSelectMenuInteraction, params: string[]) {
        const [modelId, guildDbId] = params.map(Number);
        const clockRecordId = parseInt(interaction.values[0]);

        // Show modal for sales + summary (Step 2)
        const modal = new ModalBuilder()
            .setCustomId(`adminco_modal:${clockRecordId}:${modelId}:${guildDbId}`)
            .setTitle('Admin Clock Out — Enter Sales');

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
            .setPlaceholder('Summary of the shift + notes...')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(totalSalesInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(shiftSummaryInput),
        );

        await interaction.showModal(modal);
    },

    // Step 2: Handle modal submission → ask for file → complete clock-out
    async handleModal(interaction: ModalSubmitInteraction, params: string[]) {
        const [clockRecordId, modelId, guildDbId] = params.map(Number);

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
                .setDescription('**Step 3 of 3:** Upload the Sales Tracker file (Excel, CSV, or image) in this channel now.')
                .addFields({ name: '⏳ Time Limit', value: '60 seconds — clock-out will be cancelled if no file is uploaded.' })
                .setFooter({ text: 'Drag and drop or paste the file below' });

            await interaction.editReply({ embeds: [fileEmbed] });

            // Wait for file upload from the ADMIN (interaction.user)
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
                    .setTitle('❌ Admin Clock-Out Cancelled')
                    .setDescription('No sales tracker file was uploaded in time.\nUse `/adminco` again to retry.');
                return interaction.followUp({ embeds: [cancelEmbed], flags: MessageFlags.Ephemeral });
            }

            const uploadedMessage = collected.first()!;
            const attachment = uploadedMessage.attachments.first()!;

            // Save file — use the CHATTER's discord ID for the filename (as if they uploaded it)
            const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads');
            const fileName = `${clockRecord.discordUserId}_${clockRecordId}_${Date.now()}_${attachment.name}`;
            const filePath = path.join(uploadsDir, fileName);
            await downloadFile(attachment.url, filePath);

            const now = new Date();
            const shiftDuration = now.getTime() - clockRecord.clockIn.getTime();

            // No split for admin clock-out — always solo
            const splitCount = 1;
            const splitAmount = totalSales;

            const activePeriod = await prisma.payoutPeriod.findFirst({
                where: { status: 'ACTIVE' },
                orderBy: { startDate: 'desc' },
            });

            // Clock out the chatter
            await prisma.clockRecord.update({
                where: { id: clockRecordId },
                data: { clockOut: now, status: 'COMPLETED' },
            });

            // Create invoice (attributed to the chatter, not the admin)
            await prisma.invoice.create({
                data: {
                    clockRecordId,
                    userId: clockRecord.userId,
                    modelId: clockRecord.modelId,
                    totalGross: totalSales,
                    splitCount,
                    splitAmount,
                    shiftSummary: `[Admin Clock-Out by @${interaction.user.username}] ${shiftSummary}`,
                    salesTrackerPath: fileName,
                    payoutPeriodId: activePeriod?.id,
                },
            });

            // Delete admin's upload message
            try { await uploadedMessage.delete(); } catch { }

            // Build clock-out EMBED (looks identical to a normal clock-out)
            const timestamp = Math.floor(now.getTime() / 1000);
            const clockOutEmbed = new EmbedBuilder()
                .setColor(0xEF4444)
                .setTitle(`🔴 CLOCK OUT — ${clockRecord.model.name}`)
                .setDescription(`<@${clockRecord.discordUserId}> has been clocked out.`)
                .addFields(
                    { name: '💰 Total Sales', value: `**$${totalSales.toFixed(2)}**`, inline: true },
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
                            { name: '👤 Chatter', value: `<@${clockRecord.discordUserId}>`, inline: true },
                            { name: '💰 Total', value: `$${totalSales.toFixed(2)}`, inline: true },
                            { name: '⏰ Date', value: `<t:${timestamp}:F>`, inline: true },
                            { name: '📝 Summary', value: shiftSummary },
                        )
                        .setTimestamp();

                    const fileAttachment = new AttachmentBuilder(filePath, { name: attachment.name });
                    await salesChannel.send({ embeds: [salesEmbed], files: [fileAttachment] });
                }
            }

            // Confirm to admin
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setTitle('✅ Admin Clock-Out Complete')
                .setDescription(`**${clockRecord.user.firstName} ${clockRecord.user.lastName}** has been clocked out from **${clockRecord.model.name}**.`);
            await interaction.followUp({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });

            // DM the chatter about the clock-out
            try {
                const chatterMember = await guild.members.fetch(clockRecord.discordUserId);
                const dmEmbed = new EmbedBuilder()
                    .setColor(0x6366F1)
                    .setTitle(`📋 Shift Report — ${clockRecord.model.name}`)
                    .setDescription(`You were clocked out by an admin.`)
                    .addFields(
                        { name: '💰 Total Sales', value: `**$${totalSales.toFixed(2)}**`, inline: true },
                        { name: '⏱️ Duration', value: formatDuration(shiftDuration), inline: true },
                        { name: '⏰ Clock Out', value: `<t:${timestamp}:F>`, inline: true },
                        { name: '📎 Sales Tracker', value: '✅ Saved' },
                    )
                    .setTimestamp();
                await chatterMember.send({ embeds: [dmEmbed] });
            } catch { console.log('Could not DM chatter'); }

        } catch (error) {
            console.error('Admin clock-out modal error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred processing the admin clock out.');
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
