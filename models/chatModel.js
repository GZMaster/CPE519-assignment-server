const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    userId: String,
    text: String,
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

const botResponseSchema = new mongoose.Schema(
  {
    userId: String,
    reply: String,
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

const chatSchema = new mongoose.Schema(
  {
    userId: String,
    chatRoomName: String,
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchema);
const Message = mongoose.model("Message", messageSchema);
const BotResponse = mongoose.model("BotResponse", botResponseSchema);

module.exports = { Chat, Message, BotResponse };
