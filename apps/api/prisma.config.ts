// Prisma config (replaces the deprecated `prisma` key in package.json).
// Note: when a Prisma config file is present, the CLI no longer auto-loads
// .env, so we load it explicitly here to preserve local-dev behaviour
// (DATABASE_URL / DIRECT_URL). In production these come from real env vars.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts"
  }
});
