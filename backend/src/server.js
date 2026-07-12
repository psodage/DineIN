const app = require("./app");
const config = require("./common/config");
const prisma = require("./common/database/prisma");

async function bootstrap() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log("✅ Database connected");

    app.listen(config.port, () => {
      console.log(`🚀 DineIN API running on port ${config.port} [${config.nodeEnv}]`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received. Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received. Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
