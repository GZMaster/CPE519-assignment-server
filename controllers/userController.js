const { promisify } = require("util");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { User } = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

dotenv.config({ path: "./config.env" });

const sendEmail = catchAsync(async (email, otp) => {
  const transporter = nodemailer.createTransport({
    host: `${process.env.EMAIL_HOST}`,
    port: `${process.env.EMAIL_PORT}`,
    secure: true,
    auth: {
      user: `${process.env.EMAIL_USERNAME}`,
      pass: `${process.env.EMAIL_PASSWORD}`,
    },
  });

  const info = await transporter
    .sendMail({
      from: `${process.env.EMAIL_USERNAME}`,
      to: email,
      subject: "OTP for Confirmation",
      html: `<h1>OTP for Confirmation</h1>
      <p>Your OTP is ${otp}</p>`,
    })
    .then((message) => message)
    .catch(() => false);

  if (info !== false) {
    return true;
  }

  return false;
});

const generateOtp = () => {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp;
};

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  return { token, cookieOptions };
};

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // roles[("admin", "user")].role = "user";
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { otp } = req.body;

  const user = await User.findById(id);

  if (!user) {
    return next(new AppError("Invalid user", 400));
  }

  if (user.otp !== otp) {
    return next(new AppError("Invalid OTP", 400));
  }

  if (user.otp === otp && user.verified === true) {
    return next(new AppError("Email already verified", 400));
  }

  if (user.otp === otp) {
    user.otp = undefined;
    user.verified = true;
  }

  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
    message: "Email verified successfully",
  });
});

exports.signup = catchAsync(async (req, res, next) => {
  const otp = generateOtp();

  //check if user already exists
  const user = await User.findOne({ email: req.body.email });

  if (user) {
    await User.findByIdAndDelete(user._id);
  }

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    otp: otp,
  });

  // Remove the password and otp from the output
  newUser.password = undefined;
  newUser.otp = undefined;

  //   const { token, cookieOptions } = createSendToken(newUser);

  //   const sendingMail = await sendEmail(newUser.email, otp);

  //   if (sendingMail === false) {
  //     await User.findByIdAndDelete(newUser._id);
  //     return next(new AppError("Error sending email", 500));
  //   }

  // verify user imidiately
  newUser.verified = true;
  await newUser.save({ validateBeforeSave: false });

  res.status(201).json({
    status: "success",
    message: "OTP sent to email",
    data: {
      user: newUser,
      token,
      cookieOptions,
    },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email: email }).select("+password");

  if (user.verified === false) {
    return next(new AppError("Please verify your email", 400));
  }

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 3) If everything ok, send token to client
  const { token, cookieOptions } = createSendToken(user);

  res.status(200).json({
    status: "success",
    message: "Logged in successfully",
    data: {
      user,
      token,
      cookieOptions,
    },
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  // if (currentUser.changedPasswordAfter(decoded.iat)) {
  //   return next(
  //     new AppError("User recently changed password! Please log in again.", 401)
  //   );
  // }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: "success" });
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const { email } = req.body;

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("No user found with that email");
  }

  // Generate a new password reset token
  const resetToken = generateOtp();

  // Hash the reset token and store it in the database
  // const hashedResetToken = await bcrypt.hash(resetToken, 10);
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = Date.now() + 3600000; // 1 hour from now

  await user.save({ validateBeforeSave: false });

  // Send it to user's email
  const sendmail = await sendEmail(user.email, resetToken);

  if (sendmail === false) {
    throw new Error("There was an error sending the email. Try again later");
  }

  res.status(200).json({
    status: "success",
    message: "Token sent to email",
    data: {
      resetToken,
    },
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { password, passwordConfirm } = req.body;

  // Find user by token
  const user = await User.findOne({
    passwordResetToken: req.params.token,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new Error("Token is invalid or has expired");
  }

  // Set new password
  user.password = password;
  user.passwordConfirm = passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.status(200).json({
    status: "success",
    message: "Password reset successfully",
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // Get user from collection
  const user = await User.findById(req.user.id).select("+password");

  // Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  // If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // Log user in, send JWT
  createSendToken(user, 200, res);
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route is not for password updates. Please use /updateMyPassword.",
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, "name", "email", "phoneNumber");

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.validateToken = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new Error("User not found");
  }

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});
