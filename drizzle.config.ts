import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Banco PRÓPRIO do ShowLive (projeto Neon separado do RoboStage).
// Para gerar migrações não é preciso banco; para aplicar, sim.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SHOWLIVE_DATABASE_URL ?? "postgres://localhost/showlive",
  },
});
