import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

/**
 * Cliente do banco do ShowLive.
 *
 * Produção: Neon via HTTP (uma requisição por consulta, sem pool para gerenciar
 * em ambiente serverless). Use a connection string "-pooler".
 *
 * Desenvolvimento sem Neon: SHOWLIVE_DATABASE_URL=pglite://.pglite roda um
 * Postgres embutido (PGlite) em disco e aplica as migrações sozinho. Serve
 * para testar o fluxo completo localmente; não use em produção.
 *
 * A conexão é criada só no primeiro uso, para o `next build` não exigir banco.
 */

type GlobalDb = { __showliveDb?: Promise<Db> };
const g = globalThis as unknown as GlobalDb;

async function create(): Promise<Db> {
  const url = process.env.SHOWLIVE_DATABASE_URL;
  if (!url) throw new Error("SHOWLIVE_DATABASE_URL não definida");

  if (url.startsWith("pglite://")) {
    const dir = url.slice("pglite://".length) || ".pglite";
    const [{ PGlite }, { drizzle: drizzlePglite }, { migrate }] = await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
      import("drizzle-orm/pglite/migrator"),
    ]);
    const client = new PGlite(dir);
    const pdb = drizzlePglite(client, { schema });
    await migrate(pdb, { migrationsFolder: "./drizzle" });
    return pdb as unknown as Db;
  }

  return drizzle(neon(url), { schema });
}

export function getDb(): Promise<Db> {
  if (!g.__showliveDb) {
    g.__showliveDb = create().catch((err) => {
      g.__showliveDb = undefined;
      throw err;
    });
  }
  return g.__showliveDb;
}

export { schema };
