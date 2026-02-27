import {
    ModalSubmitInteraction,
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
                },
            });

            // Post summary embed in #milk channel
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
                )
                .setTimestamp()
                .setFooter({ text: `Report #${milkReport.id}` });

            await (channel as TextChannel).send({ embeds: [summaryEmbed] });

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
                                    { name: '📸 Screenshot', value: screenshotPath ? '✅ Uploaded' : '❌ Not uploaded', inline: true },
                                )
                                .setTimestamp()
                                .setFooter({ text: `Report #${milkReport.id} • Check the #milk channel` });
                            await member.send({ embeds: [dmEmbed] });
                        } catch (e) { /* Can't DM this member */ }
                    }
                }
            }

            // Confirm to the chatter
            const successEmbed = new EmbedBuilder()
                .setColor(0x22C55E)
                .setDescription(`✅ Your milk report for **${subscriberName}** has been submitted!`);
            await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

        } catch (error) {
            console.error('Milk modal error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred processing your milk report.');
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
