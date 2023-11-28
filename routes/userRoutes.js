const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

router.post("/signup", userController.signup);

router.post("/login", userController.login);

router.post("/verifyEmail/:id", userController.verifyEmail);

router.get("/logout", userController.protect, userController.logout);

router.post("/forgotPassword", userController.forgotPassword);

router.post("/resetPassword/:token", userController.resetPassword);

router.patch(
  "/updateMyPassword",
  userController.protect,
  userController.updatePassword
);

router.patch("/updateMe", userController.protect, userController.updateMe);

router.post(
  "/validateToken",
  userController.protect,
  userController.validateToken
);

module.exports = router;
