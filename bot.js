const { createClient } = require("bedrock-protocol");
const { EventEmitter } = require("events");
const { v4: uuid } = require("uuid");

class Player extends EventEmitter {
  /**
   * @param {object} opts
   * @param {Bot} bot
   */
  constructor(opts, bot) {
    super();
    this.bot = bot;

    this.uuid = opts.uuid;
    this.xuid = opts.xbox_user_id;
    this.username = opts.username;
    this.entity_id = opts.entity_unique_id;
    this.skin = opts.skin_data;
    this.player_data_raw = opts;
  }

  runCommand(command) {
    return new Promise((resolve, reject) =>
      this.bot
        .runCommand(
          `/execute ${this.username} ~~~ ${
            command.startsWith("/") ? command.substring(1) : command
          }`
        )
        .then(resolve)
        .catch(reject)
    );
  }

  /**
   * Teleport the player to a location or entity
   * @param {{x: number, y: number, z: number, target: string, facing: {x: number, y: number, z: number, target: string}}} options
   */
  async teleport({ x, y, z, target, facing }) {
    await this.runCommand(
      `/tp @s ${target ?? (x ?? "~") + " " + (y ?? "~") + " " + (z ?? "~")} ${
        facing
          ? "facing " + facing.target ??
            (facing.x ?? "~") +
              " " +
              (facing.y ?? "~") +
              " " +
              (facing.z ?? "~")
          : ""
      }`
    );
  }

  /**
   * @returns {Promise<{x: number, y: number, z: number, dimension: 0|1|2 }>}
   */
  async getPosition() {
    const {
      output: [
        {
          parameters: [x, y, z],
        },
      ],
    } = await this.runCommand("/testforblock ~~~ air");

    const isOverworld =
      (await this.runCommand("/fill ~ -1 ~ ~ -1 ~ bedrock 0 replace bedrock"))
        .output[0].message_id === "commands.fill.success";

    const isNether =
      (await this.runCommand("/fill ~ 129 ~ ~ 129 ~ bedrock 0 replace bedrock"))
        .output[0].message_id === "commands.fill.outOfWorld";

    return { x, y, z, dimension: isOverworld ? 0 : isNether ? 1 : 2 };
  }

  async sendMessage(message) {
    return typeof message === "string"
      ? await this.runCommand(`/tellraw @s {"rawtext":[{"text":"${message}"}]}`)
      : typeof message === "object" &&
          (await this.runCommand(`/tellraw @s ${JSON.stringify(message)}`));
  }

  _addEntityData(data) {
    this.position = {
      ...data.position,
      velocity: data.velocity,
      pitch: data.pitch,
      yaw: data.yaw,
      head_yaw: data.head_yaw,
    };
    this.runtime_id = data.runtime_entity_id;
    this.held_item = data.held_item;
    this.metadata = Object.fromEntries(
      data.metadata.map((x) => [x.key, x.value])
    );
    this.raw_metadata = data.metadata;

    this.entity_data_raw = data;
  }

  _removeEntityData() {
    this.last_position = this.position;
    delete this.position;
    delete this.runtime_id;
    delete this.held_item;
    delete this.metadata;
    delete this.raw_metadata;
    delete this.entity_data_raw;
  }

  /**
   * Get a player from a username
   * @param {string} name
   * @param {Bot} bot
   * @returns {Player|undefined} The player with the specified name, or undefined if no such player exists
   */
  static fromName(name, bot) {
    return bot.getPlayers().filter((x) => x.username === name)[0];
  }
}

class Message {
  constructor(packet, bot) {
    this.sender = bot
      .getPlayers()
      .filter((x) =>
        packet.source_name
          ? x.username === packet.source_name
          : packet.message.startsWith("* ") &&
            packet.message.substring(2).startsWith(x.username)
      )[0] ?? {
      username:
        packet.source_name ?? packet.message.startsWith("* ")
          ? packet.message.split(" ")[1]
          : undefined,
    };

    this.content =
      packet.type === "announcement"
        ? packet.message.replace("[" + packet.source_name + "] ", "")
        : packet.message.startsWith(`* ${this.sender.username}`)
        ? packet.message.replace(`* ${this.sender.username}`, "")
        : packet.message;
  }
}

class Packet {
  constructor(raw_packet, packet_type, bot) {
    this.data = raw_packet;
    this.name = packet_type;
    this.bot = bot;
  }
}

class Bot extends EventEmitter {
  /**
   * @param {{
   *  host: string,
   *  port?: number,
   *  username?: string,
   *  offline?: boolean,
   *  autoReconnect?: boolean,
   *  profilesFolder?: string,
   *  conLog?: (...args: any[]) => void | async (...args: any[]) => void
   *  onMsaCode?: (data: object) => void
   * }} opts
   */
  constructor(opts) {
    super();

    this.opts = { port: 19132, ...opts, conLog() {} };
    this.log = opts.conLog ?? console.log;

    this.players = [];

    this._connect();
  }

  _connect() {
    this.log(
      `[${this.opts.username ?? "Bot"}] Connecting to ${this.opts.host}:${
        this.opts.port ?? 19132
      }${this.opts.username && " as " + this.opts.username}...`
    );

    try {
      this.client = createClient(this.opts);
    } catch (err) {
      console.error(err.message);
      return this.opts.autoReconnect && this._connect();
    }

    this.client.once("error", async (err) => {
      await this.log("ERROR " + err.message);
      this.opts.autoReconnect && this._connect();
    });

    if (this.opts.autoReconnect) {
      this.client.once("disconnect", ({ message }) => {
        if (this.status) {
          this.status = 0;
          this.log(
            `[Bot] Disconnected from server for reason: '${
              message.startsWith("%disconnect.kicked.reason")
                ? message.split(" ").slice(1).join(" ").replace(/\n/g, "\\n")
                : message
            }'`
          );
          this._connect();
        }
      });
      this.client.once("close", () => {
        if (this.status) {
          this.status = 0;
          this.log(`[${this.opts.username}] Connection closed.`);
          this._connect();
        }
      });
    }

    this.client.on("status", (s) => (this.status = s));
    this.client.once("spawn", () => {
      this.log(`[${this.opts.username}] Client spawned.`);
      this.username = this.client.profile.name;
      this.emit("spawn");
    });

    this.client.on("packet", (packet) => {
      this.emit(
        "packet",
        new Packet(packet.data.params, packet.data.name, this)
      );
      this.emit(
        packet.data.name,
        new Packet(packet.data.params, packet.data.name, this)
      );

      const {
        data: { name, params: pak },
      } = packet;

      switch (name) {
        case "text":
          (pak.type === "chat" || pak.type === "announcement") &&
            // this.emit("chat", {
            //     message:
            //         pak.type === "announcement"
            //             ? pak.message.replace("[" + pak.source_name + "] ", "")
            //             : pak.message,
            //     sender: pak.source_name || pak.message.replace(/\* (\S+) (.+)/g, (...[, s]) => s),
            // });
            this.emit("chat", new Message(pak, this));
          break;
        case "player_list":
          if (pak.records.type === "add") {
            this.players = [
              ...this.players,
              ...pak.records.records.map((player) => new Player(player, this)),
            ];
          } else if (pak.records.type === "remove") {
            // this.log(
            //     `[Bot] Removing players: ${JSON.stringify(
            //         this.players
            //             .filter((player) => pak.records.records.map((x) => x.uuid).includes(player.uuid))
            //             .map((x) => x.username)
            //     )
            //         .slice(1, -1)
            //         .replace(/"/g, "")}`
            // );
            this.players = this.players.filter(
              (player) =>
                !pak.records.records.map((x) => x.uuid).includes(player.uuid)
            );
          }
          break;
        case "add_player":
          const added_player = this.players.filter(
            (x) => x.uuid === pak.uuid
          )[0];
          if (!added_player) return;

          // this.log(`[${this.opts.username}] Adding entity data to player: ${added_player.username}`);
          added_player._addEntityData(pak);

          break;
        case "remove_entity":
          const removed_player = this.players.filter(
            (x) => x.entity_id === pak.entity_id_self
          )[0];
          if (!removed_player) return;

          // this.log(`[${this.opts.username}] Removing entity data for player: ${removed_player.username}`);
          removed_player._removeEntityData();
          break;
        case "adventure_settings":
          //   this.log(pak);
          this.user_id = pak.user_id;
          // this.log(`[${this.opts.username}] User ID: ${this.user_id}`);
          break;
      }
    });
  }

  queuePacket(...a) {
    this.client.queue(...a);
  }

  writePacket(...a) {
    this.client.write(...a);
  }

  getPlayers() {
    return [...this.players];
  }

  /**
   * Teleport the bot to a location or to an entity, facing a location or entity
   * @param {{x?: number|string, y?: number|string, z?: number|string, target?: string, facing?: {x?: number|string, y?: number|string, z?: number|string, target?: string}}} options
   * @returns {Promise<Bot>}
   */
  async teleport({ x, y, z, target, facing }) {
    await this.runCommand(
      `/tp @s ${target ?? (x ?? "~") + " " + (y ?? "~") + " " + (z ?? "~")} ${
        facing
          ? "facing " + facing.target ??
            (facing.x ?? "~") +
              " " +
              (facing.y ?? "~") +
              " " +
              (facing.z ?? "~")
          : ""
      }`
    ).catch(() => {});
    return this;
  }

  close() {
    this.log(`[${this.opts.username}] Closing the connection...`);
    this.client.close();
  }

  runCommand(
    command,
    { origin_type, timeout, log } = {
      origin_type: "player",
      timeout: 15000,
      log: true,
    }
  ) {
    return new Promise((resolve) => {
      log && this.log(`[${this.opts.username}] Running command '${command}'`);

      const request_id = uuid();

      const listenterTimeout = setTimeout(() => {
        this.client.removeListener("command_output", listener);
        // reject("Recieved no response from server");
        resolve({ response: false, data: "Timeout reached." });
      }, timeout);

      const listener = (packet) => {
        if (packet.origin.uuid === request_id) {
          clearTimeout(listenterTimeout);
          this.client.removeListener("command_output", listener);
          return resolve(packet);
        }
      };

      this.client.on("command_output", listener);
      this.client.queue("command_request", {
        command,
        origin: {
          type: origin_type,
          player_entity_id: this.user_id,
          uuid: request_id,
          request_id,
        },
      });
    });
  }

  chat(message) {
    this.client.queue("text", {
      type: "chat",
      needs_translation: false,
      source_name: this.username ?? this.opts.username ?? "ee",
      xuid: this.client.profile.xuid.toString() ?? "",
      platform_chat_id: "",
      message,
    });
  }

  async tellraw(message, selector = "@a") {
    if (typeof message === "string")
      return await this.runCommand(
        `/tellraw ${selector} {"rawtext":[{"text":"${message}"}]}`,
        { log: false }
      );
    else if (typeof message === "object")
      return await this.runCommand(
        `/tellraw ${selector} ${JSON.stringify(message)}`,
        { log: false }
      );
  }

  async getPosition() {
    const {
      output: [
        {
          parameters: [x, y, z],
        },
      ],
    } = await this.runCommand("/testforblock ~~~ air");

    const isOverworld =
      (await this.runCommand("/fill ~ -1 ~ ~ -1 ~ bedrock 0 replace bedrock"))
        .output[0].message_id === "commands.fill.success";

    const isNether =
      (await this.runCommand("/fill ~ 129 ~ ~ 129 ~ bedrock 0 replace bedrock"))
        .output[0].message_id === "commands.fill.outOfWorld";

    return { x, y, z, dimension: isOverworld ? 0 : isNether ? 1 : 2 };
  }
}

module.exports = Bot;
