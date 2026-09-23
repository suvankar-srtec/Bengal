import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env.local first.");
const connection = new URL(process.env.DATABASE_URL);
connection.searchParams.set("sslmode", "verify-full");
const client = new pg.Client({ connectionString: connection.toString(), enableChannelBinding: true, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query("BEGIN");
  const directory = new URL("../db/", import.meta.url);
  for (const file of (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    try {
      await client.query(await readFile(new URL(file, directory), "utf8"));
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      console.error(`Migration failed: ${file}`, error.code ?? "SQL_ERROR", error.message ?? "");
      throw error;
    }
  }
  await client.query("COMMIT");
  console.log("Database connected. Registration and payment demo tables are ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Database setup failed:", error.code ?? "CONNECTION_ERROR");
  process.exitCode = 1;
} finally {
  await client.end();
}
