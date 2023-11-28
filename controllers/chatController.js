const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const multer = require("multer");
const OpenAI = require("openai");
const { Chat, Message, BotResponse, Score } = require("../models/chatModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const ApiFeatures = require("../utils/apiFeatures");

dotenv.config({ path: "./config.env" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, `./public/audio`); // Store audio files in a 'audio' directory
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  // Accept audio files only
  if (
    file.mimetype === "audio/mpeg" || // For MP3 files
    file.mimetype === "audio/wav" || // For WAV files
    file.mimetype === "audio/flac" // For FLAC files
    // Add other audio types if needed
  ) {
    return cb(null, true);
  }
  return cb(
    new AppError("Invalid file type! Please upload only audio files.", 400),
    false
  );
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 50 }, // Adjusted the limit to 50MB for audio files; you can change this based on your needs
  fileFilter: fileFilter,
});

exports.uploadAudio = upload.single("audio");

exports.getChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.id);
  if (!chat) {
    return next(new AppError("No chat found with that ID", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      chat,
    },
  });
});

exports.getChats = catchAsync(async (req, res, next) => {
  const features = new ApiFeatures(Chat.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const chats = await features.query;

  res.status(200).json({
    status: "success",
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.createChat = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { chatDate, chatTime, chatDuration, chatRoomName } = req.body;

  const chat = await Chat.create({
    userId,
    chatDate,
    chatTime,
    chatDuration,
    chatRoomName,
  });

  res.status(201).json({
    status: "success",
    data: {
      chat,
    },
  });
});

exports.updateChat = catchAsync(async (req, res, next) => {
  const { userId, chatDate, chatTime, chatDuration, chatRoomName } = req.body;

  const chat = await Chat.findByIdAndUpdate(
    req.params.id,
    {
      userId,
      chatDate,
      chatTime,
      chatDuration,
      chatRoomName,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!chat) {
    return next(new AppError("No chat found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      chat,
    },
  });
});

exports.deleteChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findByIdAndDelete(req.params.id);

  if (!chat) {
    return next(new AppError("No chat found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.sendText = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const { text, roomId } = req.body;

  if (!text || text.trim().length === 0) {
    return next(new AppError("Text message cannot be empty.", 400));
  }

  // 1. Save the user's text message to the database

  const userMessage = new Message({
    userId,
    roomId,
    text: text,
  });

  await userMessage.save();

  // Get the last 3 messages from the database
  const userMessages = await Message.find({ roomId: roomId });

  const messages = [
    ...userMessages.slice(-3).map((message) => ({
      role: "user",
      content: message.text,
    })),
  ];

  let completion;

  // Check if the user's message is the first message in the room
  if (userMessages.length === 0) {
    completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "you are an assistant answer any question the user asks you",
        },
        ...messages,
      ],
      model: "gpt-4",
    });
  } else {
    // 2. Get a response from OpenAI GPT-4
    completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "you are an assistant answer any question the user asks you",
        },
        ...messages,
      ],
      model: "gpt-4",
    });
  }

  const { content } = await completion.choices[0].message;

  const botResponseText = content;

  // 3. Save the bot's response to the database
  const botResponse = new BotResponse({
    userId: userId, // You may want to use a different ID for the bot or a generic one
    roomId: roomId,
    reply: botResponseText,
    // ... other fields
  });

  await botResponse.save();

  res.status(200).json({
    status: "success",
    data: {
      userMessage,
      botResponse,
    },
  });
});

exports.getResponse = catchAsync(async (req, res, next) => {
  const { userId, reply, roomid } = req.body;

  const botResponse = await BotResponse.create({
    userId,
    reply,
    roomid,
  });

  res.status(201).json({
    status: "success",
    data: {
      botResponse,
    },
  });
});


