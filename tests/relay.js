const { Relay } = require("..");

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

relay.relay.on("join", (player) => {
    console.log("Join");

    player.on("serverbound", (data) => {
        // console.log(data.name);
        if (data.name === "text") {
            if (data.params.message.startsWith(".canceled")) data.cancel();
            console.log(data.params.message);
        }
    });

    player.on("clientbound", ({ name, params, cancel }) => {
        if (name === "command_output") {
            if (params.output[0].parameters[1] === "test") {
                cancel();
                console.log("Test command!");

                player.upstream.queue("text", {
                    needs_translation: false,
                    type: "chat",
                    source_name: "e",
                    xuid: "",
                    platform_chat_id: "",
                    message: "Tested!",
                });
            }
        }
    });
});
