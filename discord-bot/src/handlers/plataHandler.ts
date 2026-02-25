import { StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../lib/prisma';

function fmt(n: number): string {
    return n.toFixed(2);
}

function fmtDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Belgrade' });
}

export default {
    async handleSelect(interaction: StringSelectMenuInteraction, params: string[]) {
        const userId = parseInt(params[0]);
        const periodId = parseInt(interaction.values[0]);

        await interaction.deferUpdate();

        try {
            // Get the period
            const period = await prisma.payoutPeriod.findUnique({ where: { id: periodId } });
            if (!period) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Period not found.')],
                    components: [],
                });
            }

            // Get the user
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor(0xEF4444).setDescription('❌ User not found.')],
                    components: [],
                });
            }

            // Get payout entry for this user & period
            const entry = await prisma.payoutEntry.findUnique({
                where: { payoutPeriodId_userId: { payoutPeriodId: periodId, userId } },
            });

            // Get invoices in this period for this user
            const invoices = await prisma.invoice.findMany({
                where: {
                    userId,
                    clockRecord: {
                        clockOut: { gte: period.startDate, lte: period.endDate },
                    },
                },
                include: {
                    model: { select: { name: true } },
                    clockRecord: { select: { clockIn: true, clockOut: true } },
                },
                orderBy: { createdAt: 'asc' },
            });

            // Calculate from invoices directly (even if entry doesn't exist yet)
            const totalSales = invoices.reduce((sum, inv) => sum + inv.splitAmount, 0);

            // Get chargebacks for this user in this period
            const chargebacks = await prisma.chargeback.findMany({
                where: { userId, payoutPeriodId: periodId },
            });
            const totalChargebacks = chargebacks.reduce((sum, cb) => sum + cb.amount, 0);

            // Get punishments
            const punishments = await prisma.punishment.findMany({
                where: { userId, payoutPeriodId: periodId },
            });
            const totalPunishments = punishments.reduce((sum, p) => sum + p.amount, 0);

            // Get mass PPVs (bonus)
            const massPPVs = await prisma.massPPV.findMany({
                where: { sentById: userId, payoutPeriodId: periodId },
            });
            const totalBonus = massPPVs.reduce((sum, m) => sum + m.commissionAmount, 0);

            // Commission rate
            const rate = user.commissionGross || 4.0;

            // Formula: (((Total Sales - Chargebacks) × Rate) - Punishments + Bonus) - 5% Fee
            const afterChargebacks = totalSales - totalChargebacks;
            const commission = afterChargebacks * (rate / 100);
            const afterAdjustments = commission - totalPunishments + totalBonus;
            const fee = afterAdjustments > 0 ? afterAdjustments * 0.05 : 0;
            const finalPayout = afterAdjustments - fee;

            // Build shift summary
            const shiftLines = invoices.slice(0, 10).map((inv, i) =>
                `\`${i + 1}.\` **${inv.model.name}** — $${fmt(inv.splitAmount)}`
            ).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x8B5CF6)
                .setTitle(`💰 Payout — Period #${periodId}`)
                .setDescription(
                    `📅 **${fmtDate(period.startDate)}** → **${fmtDate(period.endDate)}**\n` +
                    `👤 **${user.firstName} ${user.lastName}**`
                )
                .addFields(
                    {
                        name: '📊 Breakdown',
                        value: [
                            `**Total Sales:** $${fmt(totalSales)}`,
                            `**Chargebacks:** -$${fmt(totalChargebacks)}`,
                            `**After Chargebacks:** $${fmt(afterChargebacks)}`,
                            ``,
                            `**Commission Rate:** ${parseFloat(rate.toFixed(2))}% gross (${parseFloat((rate / 0.8).toFixed(2))}% net)`,
                            `**Commission:** $${fmt(commission)}`,
                            ``,
                            `**Punishments:** -$${fmt(totalPunishments)}`,
                            `**Bonus (Mass PPV):** +$${fmt(totalBonus)}`,
                            `**Before Fee:** $${fmt(afterAdjustments)}`,
                            ``,
                            `**Fee (5%):** -$${fmt(fee)}`,
                        ].join('\n'),
                    },
                    {
                        name: '💵 Final Payout',
                        value: `# $${fmt(finalPayout)}`,
                    },
                    {
                        name: `📋 Shifts (${invoices.length} total)`,
                        value: shiftLines || '_No shifts recorded_',
                    },
                )
                .setFooter({ text: 'This data is from the CRM payout system' })
                .setTimestamp();

            if (invoices.length > 10) {
                embed.addFields({
                    name: '',
                    value: `_... and ${invoices.length - 10} more shifts_`,
                });
            }

            await interaction.editReply({ embeds: [embed], components: [] });
        } catch (error) {
            console.error('Plata select error:', error);
            await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Failed to load payout data.')],
                components: [],
            });
        }
    },
};
