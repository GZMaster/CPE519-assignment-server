/* eslint-disable no-console */
// const socket = require("socket.io");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
// const {
//   userJoin,
//   message,
//   userLeave,
// } = require("./controllers/InterviewController");

// Uncaught Exception
process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  process.exit(1);
});

dotenv.config({ path: "./config.env" });
const app = require("./app");

// REMOTE SERVER DATABASE CONNECTION
const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  // .connect(process.env.DATABASE_LOCAL, {
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection successful.....😀"));

const port = process.env.PORT || 8000;

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}.....😀`);
});

process.on("unhandledRejection", (err) => {
  console.log(err.name, err.message);
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  server.close(() => {
    process.exit(1);
  });
});

// const io = socket(server);

// io.on("connection", (newSocket) => {
//   newSocket.on("joinRoom", async ({ token, username, room }) => {
//     try {
//       const { user, interview } = await userJoin(token, username, room);
//       newSocket.join(interview._id);
//       newSocket.emit("message", {
//         userId: user._id,
//         username: user.username,
//         text: `Welcome to ${interview.interviewRoomName} interview room`,
//       });
//       newSocket.broadcast.to(interview._id).emit("message", {
//         userId: user._id,
//         username: user.username,
//         text: `${user.username} has joined the chat`,
//       });
//     } catch (err) {
//       console.log(err);
//     }
//   });

//   //when somebody send text
//   newSocket.on("chat", async ({ token, room, messageText }) => {
//     try {
//       const newMessage = await message(token, room, messageText);
//       io.to(room).emit("message", {
//         userId: newMessage.userId,
//         username: "bot",
//         text: newMessage.reply,
//       });
//     } catch (err) {
//       console.log(err);
//     }
//   });

//   // Disconnect , when user leave room
//   newSocket.on("disconnect", async () => {
//     try {
//       const user = await userLeave(newSocket.id);
//       if (user) {
//         io.to(user.room).emit("message", {
//           userId: user.id,
//           username: user.username,
//           text: `${user.username} has left the chat`,
//         });
//       }
//     } catch (err) {
//       console.log(err);
//     }
//   });
// });
