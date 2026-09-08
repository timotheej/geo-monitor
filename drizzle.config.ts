import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

// Sur Vercel, les migrations tournent au build : sans base Postgres configurée, on s'arrête avec un message clair
// plutôt que de retomber sur PGlite (qui échoue en essayant de créer un dossier).
if (!url && process.env.VERCEL) {
  throw new Error("DATABASE_URL manquant au build : ajouter une base Postgres (Neon) au projet Vercel avant de déployer");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  ...(url
    ? { dbCredentials: { url } }
    : { driver: "pglite", dbCredentials: { url: process.env.PGLITE_DIR ?? "./.data/pglite" } }),
});
