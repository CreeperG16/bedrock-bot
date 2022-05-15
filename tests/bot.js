const { Bot } = require("..");

const bot = new Bot({
    host: "127.0.0.1",
    port: 25565,
    profilesFolder: "./msa",
    offline: true,
    username: "CreeperG" + Math.floor(Math.random() * 100),
    conLog() {},
    autoReconnect: true,
});

bot.on("chat", async ({ message, sender }) => {
    console.log(`[Bot] Chat | ${sender} > ${message}`);

    if (sender === bot.username) return;

    // bot.chat(`${sender || "Someone"} says ${message}`);

    if (message.startsWith(".exec"))
        console.dir(await bot.runCommand(message.substring(6)).catch(() => {}), { depth: null });

    if (message.startsWith(".tp"))
        await bot.teleport({ x: message.split(" ")[1], y: message.split(" ")[2], z: message.split(" ")[3] });

    if (message === ".players")
        console.dir(
            bot.players,
            // bot.players.map((x) => x.username),
            { depth: 1 }
        );

    if (message === ".sayhi")
        bot.players.forEach(async (player) => player.runCommand(`/say Hi from ${player.username}!`).catch(() => {}));

    if (message.startsWith(".chat")) bot.chat(message.substring(6));
});

bot.on("spawn", async () => {
    const {
        output: [
            {
                parameters: [x, y, z],
            },
        ],
    } = await bot.runCommand("/execute @a ~~~ testforblock ~~~ air");

    console.log("[Bot] Location:", x, y, z);
});
