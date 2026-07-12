const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const config = require("./common/config");
const { errorHandler } = require("./common/middleware");

const app = express();

// ─── Global Middleware ──────────────────────────────────────
app.use(helmet());
app.use(compression());

const corsOriginEnv = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "*";
const allowedOrigins = corsOriginEnv.split(",").map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOriginEnv === "*" || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    // Auto-allow localhost origins in development
    if (config.nodeEnv === "development" && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv !== "production") {
  app.use(morgan("dev"));
}

// ─── Health Check ───────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Module Routes ──────────────────────────────────────────
app.use("/api/auth", require("./modules/auth/routes"));
app.use("/api/members", require("./modules/members/routes"));
app.use("/api/member", require("./modules/members/routes"));
app.use("/api/students", require("./modules/members/routes"));
app.use("/api/menu", require("./modules/menu/routes"));
app.use("/api/meal-types", require("./modules/menu/routes"));
app.use("/api/leave", require("./modules/leave/routes"));
app.use("/api/bills", require("./modules/bills/routes"));
app.use("/api/member-monthly-due", require("./modules/bills/routes"));
app.use("/api/payments", require("./modules/payments/routes"));
app.use("/api/snacks", require("./modules/snacks/routes"));
app.use("/api/snack-products", require("./modules/snacks/routes"));
app.use("/api/snack-orders", require("./modules/snacks/routes"));
app.use("/api/bill-splits", require("./modules/snacks/routes"));
app.use("/api/polls", require("./modules/polls/routes"));
app.use("/api/attendance", require("./modules/attendance/routes"));
app.use("/api/notifications", require("./modules/notifications/routes"));
app.use("/api/dashboard", require("./modules/dashboard/routes"));
app.use("/api/expenses", require("./modules/expenses/routes"));
app.use("/api/pending-registrations", require("./modules/members/routes"));

// ─── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Central Error Handler ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
