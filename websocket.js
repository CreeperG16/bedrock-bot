const { WebSocketServer } = require("ws");
const { v4: uuid } = require("uuid");

class MinecraftWebsocket extends WebSocketServer {
  /**
   * @param {number} port
   */
  constructor(port) {
    super({ port });

    this._socket = null;
    this.events = {};
    this.commands = {};
  }

  /**
   * @returns {Promise<void>}
   */
  onceConnected() {
    return new Promise((resolve) => {
      this.on("connection", (socket) => {
        if (this._socket) {
          return socket.close(
            1,
            '{"message":"There is already a client connected to this server."}'
          );
        }

        this._socket = socket;

        this._socket.on("message", (packet) => {
          const message = JSON.parse(packet.toString());

          if (message.header.messagePurpose === "event") {
            this.events[message.body.eventName].forEach((event) =>
              event(message)
            );
          }

          if (message.header.messagePurpose === "commandResponse") {
            this.commands[message.header.requestId](message);
            delete this.commands[message.header.requestId];
          }
        });

        resolve();
      });
    });
  }

  /**
   * @param {string} eventName
   * @param {(event: object) => void} callback
   */
  subscribe(eventName, callback) {
    if (!this._socket) throw new Error("Not connected to Minecraft yet.");

    if (!this.events[eventName])
      this._socket.send(
        JSON.stringify({
          header: {
            version: 1,
            requestId: uuid(),
            messageType: "commandRequest",
            messagePurpose: "subscribe",
          },
          body: { eventName },
        })
      );

    this.events[eventName] = [...this.events[eventName], callback];
  }

  /**
   * @param {string} eventName
   */
  unsubscribe(eventName) {
    if (!this.socket) throw new Error("Not connected to Minecraft yet.");

    delete this.events[eventName];

    this._socket.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId: uuid(),
          messageType: "commandRequest",
          messagePurpose: "unsubscribe",
        },
        body: { eventName },
      })
    );
  }

  /**
   * @param {string} command
   * @param {(commandResponse: object) => void} callback
   */
  exec(command, callback = () => {}) {
    if (!this.socket) throw new Error("Not connected to Minecraft yet.");

    const requestId = uuid();

    this._socket.send(
      JSON.stringify({
        header: {
          version: 1,
          requestId,
          messageType: "commandRequest",
          messagePurpose: "commandRequest",
        },
        body: {
          version: 1,
          commandLine: command,
        },
      })
    );

    this.commands[requestId] = callback;
  }
}

module.exports = MinecraftWebsocket;
