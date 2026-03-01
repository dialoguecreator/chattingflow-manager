import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import prisma from '../lib/prisma';
import { canTakeBreak } from '../utils/shifts';

const BREAK_DURATION_MS = 15 * 60 * 1000;
const MAX_BREAKS = 2;

export default {
    data: new SlashCommandBuilder()
        .setName('break')
        .setDescription('Start a 15-minute break (max 2 per shift)'),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.channel!;

        if (!('name' in channel) || channel.name !== 'break') {
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ This command can only be used in a `#break` channel.');
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const guild = interaction.guild!;
        const discordUserId = interaction.user.id;

        try {
            const dbGuild = await prisma.guild.findUnique({ where: { guildId: guild.id } });
            if (!dbGuild) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Guild not set up.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const parentChannel = 'parent' in channel ? channel.parent : null;
            if (!parentChannel) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Cannot determine model.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const model = await prisma.onlyFansModel.findFirst({
                where: { discordCategoryId: parentChannel.id, guildId: dbGuild.id },
            });
            if (!model) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ Model not found.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
            if (!user) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ You need to clock in first.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const clockRecord = await prisma.clockRecord.findFirst({
                where: { userId: user.id, modelId: model.id, status: 'ACTIVE' },
            });
            if (!clockRecord) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ You are not clocked in. Use `/ci` first.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const activeBreak = await prisma.breakRecord.findFirst({
                where: { clockRecordId: clockRecord.id, endTime: null },
            });
            if (activeBreak) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ You are already on a break! Use `/back` to return.'); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const breakCount = await prisma.breakRecord.count({ where: { clockRecordId: clockRecord.id } });
            if (breakCount >= MAX_BREAKS) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription(`❌ You have already used your maximum ${MAX_BREAKS} breaks for this shift.`); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const breakCheck = canTakeBreak(clockRecord.clockIn, clockRecord.shiftType || 'MORNING');
            if (!breakCheck.allowed) { const e = new EmbedBuilder().setColor(0xEF4444).setDescription(`❌ ${breakCheck.reason}`); return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral }); }

            const breakRecord = await prisma.breakRecord.create({
                data: {
                    clockRecordId: clockRecord.id,
                    userId: user.id,
                    discordUserId,
                },
            });

            const timestamp = Math.floor(Date.now() / 1000);
            const returnTimestamp = Math.floor((Date.now() + BREAK_DURATION_MS) / 1000);

            const embed = new EmbedBuilder()
                .setColor(0xF59E0B)
                .setTitle(`☕ Break Started — ${model.name}`)
                .setDescription(`<@${discordUserId}> is now on a **15-minute break**`)
                .addFields(
                    { name: '⏰ Started', value: `<t:${timestamp}:T>`, inline: true },
                    { name: '⏳ Expected Back', value: `<t:${returnTimestamp}:T>`, inline: true },
                    { name: '📊 Breaks Used', value: `${breakCount + 1}/${MAX_BREAKS}`, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: 'OF MGMT Bot' });

            await interaction.reply({ embeds: [embed] });

            // Timeout to check exceeded break
            const breakMsgRef = await interaction.fetchReply();
            const breakJumpUrl = `https://discord.com/channels/${guild.id}/${(channel as any).id}/${breakMsgRef.id}`;

            setTimeout(async () => {
                try {
                    const currentBreak = await prisma.breakRecord.findUnique({ where: { id: breakRecord.id } });
                    if (currentBreak && !currentBreak.endTime) {
                        await prisma.breakRecord.update({ where: { id: breakRecord.id }, data: { exceeded: true } });

                        // Fetch ALL guild members to ensure we don't miss anyone
                        await guild.members.fetch();

                        const rolesToNotify = ['Admin', 'Manager', 'Supervisor'];
                        const notifyMembers = new Map<string, any>();
                        for (const roleName of rolesToNotify) {
                            const role = guild.roles.cache.find(r => r.name === roleName);
                            if (role) {
                                const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(role.id));
                                for (const [id, member] of membersWithRole) {
                                    notifyMembers.set(id, member);
                                }
                            }
                        }

                        for (const [, member] of notifyMembers) {
                            try {
                                const alertEmbed = new EmbedBuilder()
                                    .setColor(0xEF4444)
                                    .setTitle('⚠️ Break Exceeded Alert')
                                    .setDescription(`**${interaction.user.username}** (<@${discordUserId}>) has exceeded their 15-minute break on **${model.name}**.`)
                                    .addFields(
                                        { name: 'Break Started', value: `<t:${timestamp}:T>` },
                                        { name: '🔗 Jump to Break', value: `[Click here](${breakJumpUrl})` },
                                    )
                                    .setTimestamp();
                                await member.send({ embeds: [alertEmbed] });
                            } catch (e) { /* Can't DM */ }
                        }
                    }
                } catch (e) { console.error('Break check error:', e); }
            }, BREAK_DURATION_MS);

        } catch (error) {
            console.error('Break error:', error);
            const embed = new EmbedBuilder().setColor(0xEF4444).setDescription('❌ An error occurred.');
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
