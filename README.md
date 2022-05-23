# bedrock-bot
A small extension to `bedrock-protocol`'s Client to make some things easier

## Creating the bot
```js
const { Bot } = require("bedrock-bot");

const bot = new Bot({
  host: "127.0.0.1",
  port: 19130,
  offline: true,
  username: "Bob",
  autoReconnect: true,
  conLog: console.log,
});
```
### Options
- `host` Server IP address to connect to
- `port` Server port - default 19132
- `offline` Connect without authentication - see bedrock-protocol docs - default `false`
- `username` Username to connect with in offline mode, or key for auth cache
- `autoReconnect` Reconnect to the server if the bot gets disconnected
- `conLog` Log function

## Usage
### Chat messages
```js
bot.on("chat", ({ message, sender }) => {
  console.log(`${sender} > ${message}`);

  if(sender === bot.username) return;

  bot.chat(`${sender} says ${message}!`);
});
```
- `bot.chat(message: string)` Send a chat message as the bot
- `bot.on("chat", ({ message, sender }: { message: string, sender: string }) => {})` Event emitted when bot recieves a chat message

### Running commands
```js
await bot.runCommand("/title @a title Hello!");
```
- `bot.runCommand(command: string)` Run a command as the bot

### Players
```js
const players = bot.players.filter(x => x.username !== bot.username);

for (const player of players) {
  const { position: pos } = await player.getPosition();

  player.runCommand(`/say Hi from ${player.username}! I am at ${pos.x}, ${pos.y}, ${pos.z}.`);
}
```
- `bot.players: Player[]` Array of players the bot is aware of, all players in player list
- `Player.runCommand(command: string)` Execute a command as a specific player
- `Player.getPosition()` Get the current position of a specific player

### Packets
```js
bot.queue("", {});

bot.on("", (packet) => {});
```
- `bot.queue(name, params)` Queue a packet to be sent with the next batch
- `bot.write(name, params)` Immediately send a packet
- `bot.on(name, (params) => {})` Listen for specific packets
- `bot.on("packet", ({ data: { name, params }}) => {})` Listen for all packets

## Examples
### Simple custom commands (kind of)
```js
const { Bot } = require("bedrock-bot");

const prefix = ".";

const bot = new Bot({
  host: "127.0.0.1",
  port: 19130,
  username: "Bob",
  offline: true,
  autoReconnect: true,
  conLog: console.log,
});

bot.on("chat", async ({ message, sender }) => {
  if(sender === bot.username) return;

  if(!message.startsWith(prefix)) return;

  const [cmd, ...params] = message.substring(1).split(" ");

  switch(cmd) {
    case "ping":
      return await bot.runCommand(`/tellraw ${sender} {"rawtext":[{"text":"Pong!"}]}`);
    case "announce":
      return await bot.runCommand(`/tellraw @a {"rawtext":[{"text":"§lAnnouncement: ${params.join(" ")}"}]}`);
  }
});
```
