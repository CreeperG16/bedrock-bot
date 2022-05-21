const { Relay } = require("bedrock-protocol");
const { Server } = require("ws");

const fs = require("fs");

let wss;

const relay = new Relay({
    host: "127.0.0.1",
    port: 25565,
    profilesFolder: "./msa",
    offline: true,
    destination: {
        host: "127.0.0.1",
        port: 19130,
    },
});

relay.listen();
console.log("[Relay] Listening...");

relay.on("join", async (player) => {
    console.log(
        `[Relay] Player joined: ${
            player.username ?? player.profile.name ?? player.upstream.username ?? player.upstream.profile.name
        }`
    );

    player.on("clientbound", async ({ name, params: packet }) => {
        switch (name) {
            case "tick_sync":
            case "level_chunk":
            case "network_chunk_publisher_update":
            case "move_entity_delta":
            case "set_entity_data":
            case "update_attributes":
            case "add_entity":
            case "mob_equipment":
                break;
            case "player_list":
                // console.log(skindata);
                // console.log(skindata.skin_data.data);

                // const { width, height, data } = packet.records.records[0].skin_data.skin_data;
                // // console.log({ width, height, data });

                // await new Promise((resolve) => fs.writeFile("test.bin", data, resolve));

                // for (let x = 0; x < width; x++) {
                //     for (let y = 0; y < height; y++) {
                //         console;
                //     }
                // }

                // skindata.skin_data.data = Buffer.from(skindata.skin_data.data.data);

                // console.dir(skindata, { depth: 1 });

                // await new Promise((resolve) =>
                //     fs.writeFile(
                //         "./skinData.json",
                //         JSON.stringify(
                //             packet.records.records[0].skin_data,
                //             null,
                //             4
                //         ),
                //         resolve
                //     )
                // );
                // console.log("Wrote file");

                break;
            default:
                console.log("[Relay] Clientbound |", { name });
        }

        if (name === "text") {
            console.log(
                `[Relay] Chat | ${packet.source_name} > ${packet.message} ${JSON.stringify(packet.parameters)}`
            );
            if (packet.message === ".wss") {
                console.log("[Relay] Attempting WSS connection...");
                wss = new Server({ port: 8080 });

                wss.on("connection", (socket) => {
                    console.log("[Relay] WSS | Connection.");
                });

                player.queue("automation_client_connect", {
                    address: "127.0.0.1:8080",
                });
            }
        }
    });

    player.on("serverbound", ({ name, params: packet }) => {
        switch (name) {
            case "tick_sync":
                break;
            case "login":
                console.dir(packet, { depth: null });
            default:
                console.log("[Relay] Serverbound |", { name });
        }
    });
});
