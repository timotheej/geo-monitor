import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const PGLITE_DIR = process.env.PGLITE_DIR ?? "./.data/pglite";

declare global {
  var __geoDb: Promise<Db> | undefined;
}

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    return drizzle(url, { schema }) as unknown as Db;
  }
  // Local : Postgres embarqué, migrations appliquées au démarrage.
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(PGLITE_DIR, { recursive: true });
  const db = drizzle({ connection: { dataDir: PGLITE_DIR }, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as Db;
}

/** Client base unique par process (PGlite n'accepte qu'une connexion par dossier). */
export function getDb(): Promise<Db> {
  if (!globalThis.__geoDb) globalThis.__geoDb = create();
  return globalThis.__geoDb;
}

export { schema };
