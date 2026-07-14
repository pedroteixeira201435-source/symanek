// Generates supabase/seed_programmes.sql from lib/content.ts (single source of truth).
// Run: npx tsx scripts/gen-seed.ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { categories } from "../lib/content";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const orNull = (s?: string) => (s ? q(s) : "NULL");
const arr = (a?: string[]) =>
  a && a.length ? `ARRAY[${a.map(q).join(", ")}]` : "ARRAY[]::text[]";

const rows: string[] = [];
for (const c of categories) {
  for (const p of c.programmes) {
    rows.push(
      `  (${q(p.slug)}, ${q(p.name)}, ${q(c.slug)}, ${orNull(p.level)}, ${q(p.duration)}, ` +
        `${p.fee ?? "NULL"}, ${orNull(p.modes)}, ${q(p.description)}, ${orNull(p.requirements)}, ${arr(p.careers)})`
    );
  }
}

const sql =
  `-- AUTO-GENERATED from lib/content.ts — do not edit by hand. Run: npx tsx scripts/gen-seed.ts\n` +
  `insert into public.programmes\n` +
  `  (slug, name, category, level, duration, fee, modes, description, requirements, careers)\n` +
  `values\n${rows.join(",\n")}\n` +
  `on conflict (slug) do update set\n` +
  `  name = excluded.name, category = excluded.category, level = excluded.level,\n` +
  `  duration = excluded.duration, fee = excluded.fee, modes = excluded.modes,\n` +
  `  description = excluded.description, requirements = excluded.requirements,\n` +
  `  careers = excluded.careers, active = true, updated_at = now();\n`;

const out = fileURLToPath(new URL("../../supabase/seed_programmes.sql", import.meta.url));
writeFileSync(out, sql);
console.log(`Wrote ${rows.length} programmes to ${out}`);
