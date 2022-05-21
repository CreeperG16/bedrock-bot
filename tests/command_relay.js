const { Relay } = require("bedrock-protocol");
const WebSocket = require("ws");

const relay = new Relay({
    host: "127.0.0.1",
    port: 25565,
    destination: {
        host: "127.0.0.1",
        port: 19130,
    },
});

relay.listen();

const wss = new WebSocket.Server({ port: 8080 });

wss.on("listening", () => console.log("WSS Listening..."));

wss.on("connection", (socket) => {
    console.log("Socket connection!");
});

relay.on("join", (player) => {
    console.log(`Player join: ${player.profile.name}`);

    player.on("serverbound", ({ name, params }) => {
        if (name === "command_request") console.log({ [name]: params });
    });

    player.on("clientbound", ({ name, params }) => {
        if (name === "command_output") console.log({ [name]: params });
    });
});
