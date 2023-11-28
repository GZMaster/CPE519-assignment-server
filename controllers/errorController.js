// Import the custom error handling utility
const AppError = require("../utils/appError");

// Error handling middleware functions
const handleCastErrorDB = (err) => {
  // Construct a user-friendly error message based on the error object
  const message = `Invalid ${err.path}: ${err.value}.`;
  // Wrap the message in an AppError object with a 400 status code
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  // Extract the duplicate field value from the error message using a regular expression
  const value = err.errmsg.match(/(["'])(?:(?=(\\?))\2.)*?\1/)[0];
  // Construct a user-friendly error message based on the duplicate field value
  const message = `Duplicate field value: ${value}. Please use another value!`;
  // Wrap the message in an AppError object with a 400 status code
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  // Map over the object containing validation errors and extract the error messages
  const errors = Object.values(err.errors).map((el) => el.message);

  // Construct a user-friendly error message based on the validation errors
  const message = `Invalid input data. ${errors.join(". ")}`;
  // Wrap the message in an AppError object with a 400 status code
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError("Invalid token. Please log in again!", 401);

const handleJWTExpiredError = () =>
  new AppError("Your token has expired! Please log in again.", 401);

// Error response functions
const sendErrorDev = (err, res) => {
  // Send a detailed error response in development mode
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Send a generic error response in production mode for operational errors
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Log the error for unknown or programming errors
    console.error("ERROR 💥", err);

    // Send a generic error response without leaking error details
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

// Global error handling middleware function
module.exports = (err, req, res, next) => {
  // Set default values for the error status code and status message
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    // Send detailed error response in development mode
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    // Create a copy of the error object to avoid modifying the original
    let error = { ...err };

    // Handle specific types of errors by calling the appropriate error handling functions
    if (err.name === "CastError") error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(err);
    if (err.name === "ValidationError") error = handleValidationErrorDB(err);
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};
