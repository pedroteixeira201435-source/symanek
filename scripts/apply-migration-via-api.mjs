// Apply a migration to the Supabase project using the Management API
// (POST /v1/projects/{ref}/database/query). Used when the direct Postgres
// password (SUPABASE_DB_PASSWORD) is not available but SUPABASE_ACCESS_TOKEN is.
import fs from "node:fs";
import { loadEnv, requireEnv } from "./supabase-rest.mjs";

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("Usage: node scripts/apply-migration-via-api.mjs <migration.sql>");
  process.exit(1);
}

loadEnv();
const token = requireEnv("SUPABASE_ACCESS_TOKEN");
const ref = requireEnv("SUPABASE_PROJECT_REF");
const query = fs.readFileSync(file, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`FAILED (${res.status}): ${text}`);
  process.exit(1);
}
console.log(`Applied migration via API: ${file}`);
console.log(text.slice(0, 500));
