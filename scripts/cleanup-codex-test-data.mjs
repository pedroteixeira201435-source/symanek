import { cleanupByEmail, env, rest } from "./supabase-rest.mjs";

const cfg = env();
const patterns = ["codex.*%40example.com"];
const tables = ["applications", "contact_messages", "students"];
const emails = new Set();

for (const table of tables) {
  for (const pattern of patterns) {
    const rows = await rest(cfg, `${table}?email=like.${pattern}&select=email`).catch(() => []);
    for (const row of rows ?? []) if (row.email) emails.add(String(row.email).toLowerCase());
  }
}

for (const email of emails) await cleanupByEmail(cfg, email);
console.log(`Cleaned ${emails.size} codex test email(s)`);
