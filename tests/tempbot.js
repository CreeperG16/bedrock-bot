const { Bot } = require("..");

const bot = new Bot({
  host: "127.0.0.1",
  port: parseInt(process.argv[2]),
  profilesFolder: "./msa",
  offline: true,
  username: "Temp " + Math.floor(Math.random() * 100),
  conLog() {},
  autoReconnect: true,
});

bot.once("spawn", () => console.log("Temp bot spawned"));
