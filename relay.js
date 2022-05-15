const bedrock = require("bedrock-protocol");
const { EventEmitter } = require("events");

class Relay extends EventEmitter {
    constructor(opts) {
        super();

        this.relay = new bedrock.Relay(opts);

        this.relay.on("clientbound", (data) => {
            this.emit("clientbound", {
                ...data,
                cancel() {
                    data.name = "";
                    data.params = {};
                },
            });
        });

        this.relay.on("serverbound", (data) =>
            this.emit("serverbound", {
                ...data,
                cancel() {
                    data.name = "";
                    data.params = {};
                },
            })
        );
    }
}

module.exports = Relay;
