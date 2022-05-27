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

-   `host` Server IP address to connect to
-   `port` Server port - default 19132
-   `offline` Connect without authentication - see bedrock-protocol docs - default `false`
-   `username` Username to connect with in offline mode, or key for auth cache
-   `autoReconnect` Reconnect to the server if the bot gets disconnected
-   `conLog` Log function

## Usage

### Chat messages

```js
bot.on("chat", ({ message, sender }) => {
    console.log(`${sender} > ${message}`);

    if (sender === bot.username) return;

    bot.chat(`${sender} says ${message}!`);
});
```

-   `bot.chat(message: string)` Send a chat message as the bot
-   `bot.on("chat", ({ message, sender }: { message: string, sender: string }) => {})` Event emitted when bot recieves a chat message

### Raw chat messages

Sends a raw chat message. Default selector is `@a`. You can also use a raw JSON text object - click [here](https://minecraft.fandom.com/wiki/Raw_JSON_text_format#Bedrock_Edition) to learn more

```js
await bot.tellraw("This is a raw chat message!");
await bot.tellraw("Congrats, random player!", "@r");
await bot.tellraw({ rawtext: [{ text: "Hello to a random player called " }, { selector: "@r" }, { text: "!" }] });
```

### Running commands

```js
await bot.runCommand("/title @a title Hello!");
```

-   `bot.runCommand(command: string)` Run a command as the bot

### Teleport

#### Specific location

```js
await bot.teleport({ x: 0, y: 64, z: 0 });
```

#### Specify one or two axes

```js
await bot.teleport({ y: 100 }); // Teleport to Y=100 at current X and Z
await bot.teleport({ x: 20, z: 20 }); // Teleport to X=20, Z=20 at current Y
```

#### Relative teleportation

```js
await bot.teleport({ x: "~10", y: "~20", z: "~-10" }); // Teleport 10 blocks towards positive X, 20 blocks higher, and 10 blocks north
await bot.teleport({ y: "~100" }); // Teleport 100 blocks into the air
await bot.teleport({ z: "^10" }); // Teleport 10 blocks in the direction the bot is looking
```

#### Teleport to an entity selector

```js
await bot.teleport({ target: "@r" }); // Teleport to a random player
await bot.teleport({ target: "@a[c=1]" }); // Teleport to the first player choice
await bot.teleport({ target: "@e[r=20,tag=TARGET]" }); // Teleport to the entity in a 20 block radius around the bot which has got the tag "TARGET"
await bot.teleport({ target: "CreeperG16" }); // Can be a playername
```

#### Facing a block or entity

```js
await bot.teleport({ x: 0, y: 64, z: 0, facing: { x: 1, y: 64.5, z: 0 } });
await bot.teleport({ y: 100, facing: { y: 0 } });
await bot.teleport({ x: 20, facing: { target: "@p" } });
await bot.teleport({ target: "@p", facing: { target: "@r[type=item]" } });
```

### Players

```js
const players = bot.getPlayers().filter((x) => x.username !== bot.username);

for (const player of players) {
    const { position: pos } = await player.getPosition();

    player.runCommand(`/say Hi from ${player.username}! I am at ${pos.x}, ${pos.y}, ${pos.z}.`);

    if (player.username === "CreeperG16") await player.teleport({ y: 200 });
}
```

-   `bot.getPlayers() => Player[]` Array of players the bot is aware of, all players in player list
-   `Player.runCommand(command: string)` Execute a command as a specific player
-   `Player.getPosition()` Get the current position of a specific player
-   `Player.teleport(location)` Teleport the player - see `bot.teleport()`

### Packets

```js
bot.queue("", {});

bot.on("", (packet) => {});
```

-   `bot.queue(name, params)` Queue a packet to be sent with the next batch
-   `bot.write(name, params)` Immediately send a packet
-   `bot.on(name, (params) => {})` Listen for specific packets
-   `bot.on("packet", ({ data: { name, params }}) => {})` Listen for all packets

## Examples

### Simple custom commands

The bot responds to certain "commands". These don't work the same way as normal commands, as the "command" the player ran will still show up as a chat message.

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
    if (sender === bot.username) return;

    if (!message.startsWith(prefix)) return;

    const [cmd, ...params] = message.substring(1).split(" ");

    switch (cmd) {
        case "ping":
            return await bot.runCommand(`/tellraw ${sender} {"rawtext":[{"text":"Pong!"}]}`);
        case "announce":
            return await bot.runCommand(`/tellraw @a {"rawtext":[{"text":"§lAnnouncement: ${params.join(" ")}"}]}`);
    }
});
```
