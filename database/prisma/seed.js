// ============================================================
// DineIN — Database Seed Script
// Populates initial data for development
// ============================================================

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...\n");

  // 1. Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@dinein.in" },
    update: {},
    create: {
      email: "admin@dinein.in",
      password: hashedPassword,
      role: "admin",
    },
  });
  console.log(`  ✅ Admin user: ${adminUser.email}`);

  // 2. Create meal types
  const mealTypes = [
    { mealPlan: "Lunch", mealPlanMr: "दुपारचे जेवण", price: 2500 },
    { mealPlan: "Dinner", mealPlanMr: "रात्रीचे जेवण", price: 2500 },
    { mealPlan: "Both", mealPlanMr: "दोन्ही", price: 4500 },
  ];

  for (const mt of mealTypes) {
    await prisma.mealType.upsert({
      where: { mealPlan: mt.mealPlan },
      update: { price: mt.price },
      create: mt,
    });
  }
  console.log(`  ✅ Meal types: ${mealTypes.length} created`);

  // 3. Create default app settings
  const settings = [
    { key: "mess_fee_lunch", numberValue: 2500 },
    { key: "mess_fee_dinner", numberValue: 2500 },
    { key: "mess_fee_both", numberValue: 4500 },
    { key: "late_fee_amount", numberValue: 100 },
    { key: "free_leave_days", numberValue: 3 },
  ];

  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: { numberValue: s.numberValue },
      create: s,
    });
  }
  console.log(`  ✅ App settings: ${settings.length} created`);

  console.log("\n🎉 Seeding complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
