const { Bot } = require("..");

const bot = new Bot({
  host: "127.0.0.1",
  port: parseInt(process.argv[2]),
  profilesFolder: "./msa",
  offline: true,
  username: "Tickingarea" + Math.floor(Math.random() * 100),
  conLog() {},
  autoReconnect: true,
});

bot.once("spawn", async () => {
  // await bot.teleport({ x: 0, z: 0 });

  console.log("Spawn");

  const [x, , z] = Object.entries(await bot.getPosition()).map(([k, v]) =>
    ["x", "z"].includes(k) ? Math.floor(v / 16) * 16 : v
  );

  await bot.teleport({ x, y: 320, z });

  const areas = [];

  for (let cx = -4; cx < 4; cx++) {
    for (let cz = -4; cz < 4; cz++) {
      areas.push([
        { x: x + cx * 256, z: z + cz * 256 },
        { x: x + cx * 256 + 128, z: z + cz * 256 + 128 },
      ]);
    }
  }

  console.log(areas);
});
