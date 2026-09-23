import "server-only";
import { Pool } from "pg";

const globalDatabase = globalThis as unknown as { registrationPool?: Pool };

export function getDatabase() {
  if (globalDatabase.registrationPool) return globalDatabase.registrationPool;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");

  const connection = new URL(process.env.DATABASE_URL);
  // Keep TLS certificate validation enabled, including with newer pg versions.
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({
    connectionString: connection.toString(),
    enableChannelBinding: true,
    max: 5,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });
  pool.on("error", () => console.error("An idle database connection failed."));
  globalDatabase.registrationPool = pool;
  return pool;
}
