const mongoose = require("mongoose");
const Schema = mongoose.Schema;

mongoose.set("useCreateIndex", true);

const messageSchema = new Schema({
    sender: { type: String, ref: "User", foreignField: 'id' },
    line: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

messageSchema.set("toObject", { getters: true });
messageSchema.set("toJSON", { getters: false });

module.exports = mongoose.model("Message", messageSchema);