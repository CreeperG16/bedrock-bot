const bedrock = require("bedrock-protocol");
const { EventEmitter } = require("events");

class Relay extends EventEmitter {
    constructor(opts) {
        super();

        this.relay = new bedrock.Relay(opts);

        this.relay.on("join", (player) => {
            this.emit("join", player);

            player.prependListener("clientbound", (data) => {
                data = {
                    ...data,
                    cancel() {
                        data.name = "";
                        data.params = {};
                    },
                };
            });

            player.prependListener("serverbound", (data) => {
                data = {
                    ...data,
                    cancel() {
                        data.name = "";
                        data.params = {};
                    },
                };
                // console.log("serverbound", data.name);
            });
        });

        this.relay.listen();
        console.log("Listening...");
    }
}

module.exports = Relay;
