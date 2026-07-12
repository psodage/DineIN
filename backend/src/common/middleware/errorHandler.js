const { Prisma } = require("@prisma/client");

/**
 * Central error handler middleware.
 * Catches all errors forwarded via next(err) and returns consistent JSON.
 */
function errorHandler(err, req, res, _next) {
  // Default to 500
  let status = err.status || err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = undefined;

  // Zod validation errors
  if (err.name === "ZodError" || err.issues) {
    status = 400;
    message = "Validation error";
    errors = (err.issues || []).map((issue) => ({
      path: issue.path?.join("."),
      message: issue.message,
    }));
  }

  // Prisma known request errors (e.g. unique constraint violations)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      const field = err.meta?.target?.[0] || "field";
      message = `A record with this ${field} already exists.`;
    } else if (err.code === "P2025") {
      status = 404;
      message = "Record not found.";
    }
  }

  // Log server errors in development
  if (status >= 500 && process.env.NODE_ENV !== "production") {
    console.error("🔴 Server Error:", err);
  }

  res.status(status).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
}

module.exports = errorHandler;
