import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const commands: any[] = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    const cmd = command.default || command;
    if (cmd.data) {
        commands.push(cmd.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log(`🔄 Deploying ${commands.length} commands...`);

        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            { body: commands },
        );

        console.log(`✅ Successfully deployed ${commands.length} commands globally!`);
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();
