import { defineConfig } from "drizzle-kit";

// Migrations are generated against the schema and checked in. They apply to both drivers
// (Neon in prod, PGlite in dev/test) via db/migrate.ts.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
});
