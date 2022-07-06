const { Relay } = require("bedrock-protocol");
const WebSocket = require("ws");

const relay = new Relay({
  host: "127.0.0.1",
  port: 25565,
  version: "1.19.1",
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

  setInterval(async () => {
    const uuid = require("uuid").v4();

    // console.log(uuid);

    socket.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid,
          messageType: "commandRequest",
          messagePurpose: "commandRequest",
        },
        body: { version: 1, commandLine: "/querytarget @s" },
      })
    );

    const msg = await new Promise((r) => {
      const listener = (p) => {
        // console.log(JSON.parse(p).header.requestId, uuid);
        if (JSON.parse(p).header.requestId === uuid) {
          socket.off("message", listener);
          r(JSON.parse(p));
        }
      };

      socket.on("message", listener);
    });

    let locData = "{}";
    try {
      locData = JSON.parse(msg.body.details);
    } catch (e) {}

    socket.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: `${Math.floor(Math.random() * 10000)}`,
          messageType: "commandRequest",
          messagePurpose: "commandRequest",
        },
        body: {
          version: 1,
          commandLine: `/say Hello! ${JSON.stringify(locData)}`,
        },
      })
    );
  }, 5000);

  // socket.on("message", (msg) => console.log({ wssmsg: JSON.parse(msg) }));
});

relay.on("join", (player) => {
  console.log(`Player join: ${player.profile.name}`);

  player.on("serverbound", ({ name, params }) => {
    if (name === "command_request")
      console.dir({ [name]: params }, { depth: null });
    if (name === "map_info_request" || name.includes("map"))
      console.dir({ [name]: params }, { depth: null });
  });

  player.on("clientbound", ({ name, params }) => {
    if (name === "command_output")
      console.dir({ [name]: params }, { depth: null });
    // if (name === "clientbound_map_item_data")
    //    console.dir({ [name]: params }, { depth: null });
  });
});
