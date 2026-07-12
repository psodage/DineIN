const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

/** @type {PrismaClient} */
let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ adapter });
} else {
  // Reuse client in dev to avoid exhausting connections on hot-reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      adapter,
      log: ["warn", "error"],
    });
  }
  prisma = global.__prisma;
}

module.exports = prisma;
