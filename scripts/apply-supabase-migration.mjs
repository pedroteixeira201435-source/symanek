import fs from "node:fs";
import pg from "pg";
import { env, requireEnv } from "./supabase-rest.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-supabase-migration.mjs <migration.sql>");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`Migration not found: ${file}`);
  process.exit(1);
}

const cfg = env();
const projectRef = requireEnv("SUPABASE_PROJECT_REF");
const password = requireEnv("SUPABASE_DB_PASSWORD");
const sql = fs.readFileSync(file, "utf8");
const host = process.env.SUPABASE_DB_HOST || `db.${projectRef}.supabase.co`;
const port = Number(process.env.SUPABASE_DB_PORT || 5432);

const client = new pg.Client({
  host,
  port,
  database: process.env.SUPABASE_DB_NAME || "postgres",
  user: process.env.SUPABASE_DB_USER || "postgres",
  password,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

try {
  await client.connect();
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`Applied migration: ${file}`);
} catch (error) {
  await client.query("rollback").catch(() => null);
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => null);
}
