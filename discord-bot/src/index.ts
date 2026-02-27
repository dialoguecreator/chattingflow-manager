import { Client, GatewayIntentBits, Collection, Events, Partials } from 'discord.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

// Extend client with commands collection
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
    }
}

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        const cmd = command.default || command;
        if (cmd.data && cmd.execute) {
            client.commands.set(cmd.data.name, cmd);
            console.log(`✅ Loaded command: /${cmd.data.name}`);
        }
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        const evt = event.default || event;
        if (evt.once) {
            client.once(evt.name, (...args: any[]) => evt.execute(...args));
        } else {
            client.on(evt.name, (...args: any[]) => evt.execute(...args));
        }
        console.log(`✅ Loaded event: ${evt.name}`);
    }
}

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing /${interaction.commandName}:`, error);
            const reply = { content: '❌ An error occurred while executing this command.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    // Button interactions
    if (interaction.isButton()) {
        const [action, ...params] = interaction.customId.split(':');

        // MMA approve/reject
        if (action === 'mma_approve' || action === 'mma_reject') {
            const handler = require('./handlers/mmaHandler');
            await (handler.default || handler).handleButton(interaction, action, params);
        }

        // Ticket approve/reject
        if (action === 'ticket_approve' || action === 'ticket_reject') {
            const handler = require('./handlers/ticketHandler');
            await (handler.default || handler).handleButton(interaction, action, params);
        }

        // Milk approve/reject
        if (action === 'milk_approve' || action === 'milk_reject') {
            const handler = require('./handlers/milkHandler');
            await (handler.default || handler).handleButton(interaction, action, params);
        }
    }

    // Modal submissions
    if (interaction.isModalSubmit()) {
        const [action, ...params] = interaction.customId.split(':');

        if (action === 'co_modal') {
            const handler = require('./handlers/clockOutHandler');
            await (handler.default || handler).handleModal(interaction, params);
        }

        if (action === 'mma_modal') {
            const handler = require('./handlers/mmaHandler');
            await (handler.default || handler).handleModal(interaction, params);
        }

        if (action === 'ticket_modal') {
            const handler = require('./handlers/ticketHandler');
            await (handler.default || handler).handleModal(interaction, params);
        }

        if (action === 'milk_modal') {
            const handler = require('./handlers/milkHandler');
            await (handler.default || handler).handleModal(interaction, params);
        }

        if (action === 'milk_reject_modal') {
            const handler = require('./handlers/milkHandler');
            await (handler.default || handler).handleRejectModal(interaction, params);
        }
    }

    // Select menu interactions
    if (interaction.isStringSelectMenu()) {
        const [action, ...params] = interaction.customId.split(':');

        if (action === 'co_split') {
            const handler = require('./handlers/clockOutHandler');
            await (handler.default || handler).handleSelectMenu(interaction, params);
        }

        if (action === 'plata_period') {
            const handler = require('./handlers/plataHandler');
            await (handler.default || handler).handleSelect(interaction, params);
        }

        if (interaction.customId === 'ticket_purpose') {
            const handler = require('./handlers/ticketHandler');
            await (handler.default || handler).handleSelect(interaction);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

console.log('🤖 Bot is starting...');
