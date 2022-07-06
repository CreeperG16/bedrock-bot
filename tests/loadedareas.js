const { Bot } = require("..");

const botOpts = {
    host: "127.0.0.1",
    port: parseInt(process.argv[2]),
    profilesFolder: "./msa",
    offline: true,
    conLog() {},
    autoReconnect: true,
};

const number = Math.floor(Math.random() * 100);
const control = new Bot({ ...botOpts, username: "AreaLoad_Control" + number });

/**
 * @constant {Map<string, Bot>} bots
 */
const bots = new Map();

control.once("spawn", async () => {
    await new Promise((r) => setTimeout(r, 1000));
    await control.runCommand("/gamemode creative");

    const { dimension, ...pos } = await control.getPosition();
    // await control.teleport({ y: dimension === 1 ? 130 : 322 });

    console.log(`Control bot is at ${pos.x} ${pos.y} ${pos.z}`);

    for (let cx = -1; cx <= 0; cx++) {
        for (let cz = -1; cz <= 0; cz++) {
            (async () =>
                bots.set(
                    `${cx * 16}_${cz * 16}`,
                    new Bot({ ...botOpts, username: `${cx * 16}_${cz * 16}_${number}` /*,skipPing: true*/ })
                ))();

            // const bot = bots.get(`${cx * 16}:${cz * 16}`);

            // await new Promise((r) => bot.once("spawn", r));

            // await bot.teleport({ x: pos.x + cx * 16, y: 320, z: pos.z + cz * 16 });
            // await bot.runCommand("/gamemode creative");

            // console.log(`Bot ${bot.username} loaded.`);
        }
    }

    await Promise.all([...bots].map(([, v]) => new Promise((r) => v.once("spawn", r))));
    await Promise.all(
        [...bots].map(([, v]) =>
            v.teleport({
                x: parseInt(pos.x) + parseInt(v.username.split("_")[0]),
                // y: 320,
                z: parseInt(pos.z) + parseInt(v.username.split("_")[1]),
            })
        )
    );
    await Promise.all([...bots].map(([, v]) => v.runCommand("/gamemode creative")));
    console.log([...bots].length, "Bots loaded");
    // console.log(pos.x + parseInt([...bots][0][1].username.split("_")[0]));
    // console.log(parseInt([...bots][0][1].username.split("_")[0]));
    // console.log(typeof parseInt([...bots][0][1].username.split("_")[0]));
});
