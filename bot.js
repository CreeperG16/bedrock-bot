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
                .runCommand(`/execute ${this.username} ~~~ ${command.startsWith("/") ? command.substring(1) : command}`)
                .then(resolve)
                .catch(reject)
        );
    }

    async teleport({ x, y, z, target, facing }) {
        await this.runCommand(
            `/tp @s ${target ?? (x ?? "~") + " " + (y ?? "~") + " " + (z ?? "~")} ${
                facing
                    ? "facing " + facing.target ?? (facing.x ?? "~") + " " + (facing.y ?? "~") + " " + (facing.z ?? "~")
                    : ""
            }`
        );
    }

    addEntityData(data) {
        this.position = {
            ...data.position,
            velocity: data.velocity,
            pitch: data.pitch,
            yaw: data.yaw,
            head_yaw: data.head_yaw,
        };
        this.runtime_id = data.runtime_entity_id;
        this.held_item = data.held_item;
        this.metadata = Object.fromEntries(data.metadata.map((x) => [x.key, x.value]));
        this.raw_metadata = data.metadata;

        this.entity_data_raw = data;
    }

    removeEntityData() {
        this.last_position = this.position;
        delete this.position;
        delete this.runtime_id;
        delete this.held_item;
        delete this.metadata;
        delete this.raw_metadata;
        delete this.entity_data_raw;
    }
}

class Bot extends EventEmitter {
    /**
     * @param {object} opts
     */
    constructor(opts) {
        super();
        this.opts = opts;

        this.players = [];

        this._connect();
    }

    _connect() {
        console.log(
            `[Bot] Connecting to ${this.opts?.host}:${this.opts?.port ?? 19132}${
                this.opts?.username && " as " + this.opts?.username
            }...`
        );

        this.client = createClient(this.opts);

        if (this.opts.autoReconnect) {
            this.client.once("disconnect", ({ message }) => {
                if (this.status) {
                    this.status = 0;
                    console.log(
                        `[Bot] Disconnected from server for reason: '${
                            message.startsWith("%disconnect.kicked.reason")
                                ? message.split(" ").slice(1).join(" ")
                                : message
                        }'`
                    );
                    this._connect();
                }
            });
            this.client.once("close", () => {
                if (this.status) {
                    this.status = 0;
                    console.log("[Bot] Connection closed.");
                    this._connect();
                }
            });
        }

        this.client.on("status", (s) => (this.status = s));
        this.client.once("spawn", () => {
            console.log("[Bot] Client spawned.");
            this.username = this.client.profile.name;
            this.emit("spawn");
        });

        this.client.on("packet", (packet) => {
            this.emit("packet", packet);
            this.emit(packet.data.name, packet.data.params);

            const {
                data: { name, params: pak },
            } = packet;

            switch (name) {
                case "text":
                    (pak.type === "chat" || pak.type === "announcement") &&
                        this.emit("chat", {
                            message:
                                pak.type === "announcement"
                                    ? pak.message.replace("[" + pak.source_name + "] ", "")
                                    : pak.message,
                            sender: pak.source_name || pak.message.replace(/\* (\S+) (.+)/g, (...[, s]) => s),
                        });
            }
        });

        this.client.on("player_list", (packet) => {
            // console.dir(packet, { depth: 3 });

            if (packet.records.type === "add") {
                this.players = packet.records.records.map((player) => new Player(player, this));
            } else if (packet.records.type === "remove") {
                console.log(
                    `[Bot] Removing players: ${JSON.stringify(
                        this.players
                            .filter((player) => packet.records.records.map((x) => x.uuid).includes(player.uuid))
                            .map((x) => x.username)
                    )
                        .slice(1, -1)
                        .replace(/"/g, "")}`
                );
                this.players = this.players.filter(
                    (player) => !packet.records.records.map((x) => x.uuid).includes(player.uuid)
                );
            }
        });

        this.client.on("add_player", (packet) => {
            // console.log(packet);

            const player = this.players.filter((x) => x.uuid === packet.uuid)[0];
            if (!player) return;

            console.log(`[Bot] Adding entity data to player: ${player.username}`);
            player.addEntityData(packet);
        });

        this.client.on("remove_entity", (packet) => {
            const player = this.players.filter((x) => x.entity_id === packet.entity_id_self)[0];
            if (!player) return;

            console.log(`[Bot] Removing entity data for player: ${player.username}`);
            player.removeEntityData();
        });

        this.client.on("move_player", () => {});
    }

    queue(...a) {
        this.client.queue(...a);
    }

    write(...a) {
        this.client.write(...a);
    }

    /**
     * Teleport the bot to a location or to an entity, facing a location or entity
     * @param {{x?: number|string, y?: number|string, z?: number|string, target?: string, facing?: {x?: number|string, y?: number|string, z?: number|string, target?: string}}} options
     */
    async teleport({ x, y, z, target, facing }) {
        if (target) {
            await this.runCommand(
                `/tp @s ${target} ${
                    facing
                        ? "facing " + facing.target ??
                          (facing.x ?? "~") + " " + (facing.y ?? "~") + " " + (facing.z ?? "~")
                        : ""
                }`
            );
        } else {
            await this.runCommand(
                `/tp @s ${x ?? "~"} ${y ?? "~"} ${z ?? "~"} ${
                    facing
                        ? "facing " + facing.target ??
                          (facing.x ?? "~") + " " + (facing.y ?? "~") + " " + (facing.z ?? "~")
                        : ""
                }`
            );
        }
    }

    close() {
        console.log("[Bot] Closing the connection...");
        this.client.close();
    }

    runCommand(command, timeout = 15000) {
        return new Promise((resolve, reject) => {
            console.log(`[Bot] Running command '${command}'`);

            const request_id = uuid();

            const listenterTimeout = setTimeout(() => {
                this.client.off("command_output", listener);
                reject("Recieved no response from server");
            }, timeout);

            const listener = (packet) => {
                if (packet.origin.uuid === request_id) {
                    clearTimeout(listenterTimeout);
                    resolve(packet);
                }
            };

            this.client.on("command_output", listener);
            this.client.queue("command_request", {
                command,
                origin: {
                    type: "player",
                    uuid: request_id,
                    request_id: request_id,
                },
            });
        });
    }

    chat(message) {
        this.client.queue("text", {
            type: "chat",
            needs_translation: false,
            source_name: this.username ?? "ee",
            xuid: this.client.profile.xuid.toString() ?? "",
            platform_chat_id: "",
            message,
        });
    }
}

module.exports = Bot;
