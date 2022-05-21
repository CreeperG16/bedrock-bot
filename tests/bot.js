const { Bot } = require("..");

const bot = new Bot({
    host: "127.0.0.1",
    port: parseInt(process.argv[2]),
    profilesFolder: "./msa",
    offline: true,
    username: "CreeperG" + Math.floor(Math.random() * 100),
    conLog() {},
    autoReconnect: true,
});

bot.on("chat", async ({ message, sender }) => {
    console.log(`[Bot] Chat | ${sender} > ${message}`);

    if (sender === bot.username) return;

    bot.chat(`${sender || "Someone"} says ${message}`);

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

    if (message === ".querytarget")
        bot.queue("command_request", {
            command: "/querytarget @s",
            origin: {
                type: "dev_console",
                uuid: "",
                player_entity_id: bot.user_id,
                request_id: "",
            },
            interval: false,
        });

    if (message === ".getpos")
        bot.runCommand(
            `/${sender === "Server" ? "say" : "w " + sender} ${JSON.stringify(
                await bot.players.filter((x) => x.username === "CreeperG16")[0]?.getPosition?.()
            )}`
        );
});

// bot.on("command_output", (p) => {
//     console.dir(p, { depth: null });
// });

// bot.on("adventure_settings", (advset) => console.log({ advset }));

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

bot.on("automation_client_connect", console.log);
