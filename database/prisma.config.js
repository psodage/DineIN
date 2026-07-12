"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { defineConfig } = require("prisma/config");

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "node prisma/seed.js",
  },
});
