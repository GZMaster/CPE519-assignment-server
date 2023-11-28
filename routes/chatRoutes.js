const express = require("express");
const chatController = require("../controllers/chatController");
const userController = require("../controllers/userController");

const router = express.Router();

router.get("/getChat/:id", userController.protect, chatController.getChat);

router.get("/getChats", userController.protect, chatController.getChats);

router.post("/createChat", chatController.createChat);

router.patch("/updateChat/:id", chatController.updateChat);

router.delete("/deleteChat/:id", chatController.deleteChat);

router.post(
  "/sendMessage",
  userController.protect,
  chatController.uploadAudio,
  chatController.sendMessage
);

router.post("/sendText", userController.protect, chatController.sendText);

router.post("/getResponse", userController.protect, chatController.getResponse);

module.exports = router;
