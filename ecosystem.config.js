module.exports = {
    apps: [
        {
            name: 'crm',
            cwd: './web',
            script: 'npm',
            args: 'start',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            restart_delay: 5000,
            max_restarts: 10,
        },
        {
            name: 'discord-bot',
            cwd: './discord-bot',
            script: 'npx',
            args: 'tsx src/index.ts',
            env: {
                NODE_ENV: 'production',
            },
            restart_delay: 5000,
            max_restarts: 10,
        },
    ],
};
