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

    /**
     * Teleport the player to a location or entity
     * @param {{x: number, y: number, z: number, target: string, facing: {x: number, y: number, z: number, target: string}}} options
     */
    async teleport({ x, y, z, target, facing }) {
        await this.runCommand(
            `/tp @s ${target ?? (x ?? "~") + " " + (y ?? "~") + " " + (z ?? "~")} ${
                facing
                    ? "facing " + facing.target ?? (facing.x ?? "~") + " " + (facing.y ?? "~") + " " + (facing.z ?? "~")
                    : ""
            }`
        );
    }

    /**
     * @returns {Promise<{position: {x: number, y: number, z: number}, dimension: 0|1|2 }>}
     */
    async getPosition() {
        const testforblock_output = await this.runCommand("/testforblock ~~~ air");
        const {
            output: [
                {
                    parameters: [x, y, z],
                },
            ],
        } = testforblock_output;
        // console.log(testforblock_output);

        const isOverworld =
            (await this.runCommand("/fill ~ -1 ~ ~ -1 ~ bedrock 0 replace bedrock")).output[0].message_id ===
            "commands.fill.success";
        // console.log({ isOverworld });

        const isNether =
            (await this.runCommand("/fill ~ 129 ~ ~ 129 ~ bedrock 0 replace bedrock")).output[0].message_id ===
            "commands.fill.outOfWorld";
        // console.log({ isNether });

        return { position: { x, y, z }, dimension: isOverworld ? 0 : isNether ? 1 : 2 };
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
     * @param {{
     *  host: string,
     *  port?: number,
     *  username?: string,
     *  offline?: boolean,
     *  autoReconnect?: boolean,
     *  profilesFolder?: string,
     *  conLog?: (...args: any) => void,
     *  onMsaCode?: (data: object) => void
     * }} opts
     */
    constructor(opts) {
        super();

        this.opts = { port: 19132, ...opts, conLog() {} };
        this.log = opts.conLog;

        this.players = [];

        this._connect();
    }

    _connect() {
        console.log(
            `[Bot] Connecting to ${this.opts.host}:${this.opts.port ?? 19132}${
                this.opts.username && " as " + this.opts.username
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
                    break;
                case "player_list":
                    if (pak.records.type === "add") {
                        this.players = [
                            ...this.players,
                            ...pak.records.records.map((player) => new Player(player, this)),
                        ];
                    } else if (pak.records.type === "remove") {
                        console.log(
                            `[Bot] Removing players: ${JSON.stringify(
                                this.players
                                    .filter((player) => pak.records.records.map((x) => x.uuid).includes(player.uuid))
                                    .map((x) => x.username)
                            )
                                .slice(1, -1)
                                .replace(/"/g, "")}`
                        );
                        this.players = this.players.filter(
                            (player) => !pak.records.records.map((x) => x.uuid).includes(player.uuid)
                        );
                    }
                    break;
                case "add_player":
                    const added_player = this.players.filter((x) => x.uuid === pak.uuid)[0];
                    if (!added_player) return;

                    console.log(`[Bot] Adding entity data to player: ${added_player.username}`);
                    added_player.addEntityData(pak);

                    break;
                case "remove_entity":
                    const removed_player = this.players.filter((x) => x.entity_id === pak.entity_id_self)[0];
                    if (!removed_player) return;

                    console.log(`[Bot] Removing entity data for player: ${removed_player.username}`);
                    removed_player.removeEntityData();
                    break;
                case "adventure_settings":
                    this.user_id = pak.user_id;
                    console.log(`[Bot] User ID: ${this.user_id}`);
                    break;
            }
        });
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
        await this.runCommand(
            `/tp @s ${target ?? (x ?? "~") + " " + (y ?? "~") + " " + (z ?? "~")} ${
                facing
                    ? "facing " + facing.target ?? (facing.x ?? "~") + " " + (facing.y ?? "~") + " " + (facing.z ?? "~")
                    : ""
            }`
        ).catch(() => {});
    }

    close() {
        console.log("[Bot] Closing the connection...");
        this.client.close();
    }

    runCommand(command, origin_type = "player", timeout = 15000) {
        return new Promise((resolve) => {
            console.log(`[Bot] Running command '${command}'`);

            const request_id = uuid();

            const listenterTimeout = setTimeout(() => {
                this.client.removeListener("command_output", listener);
                // reject("Recieved no response from server");
                resolve({ response: false, data: "Timeout reached." });
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
            source_name: this.username ?? "ee",
            xuid: this.client.profile.xuid.toString() ?? "",
            platform_chat_id: "",
            message,
        });
    }
}

module.exports = Bot;
