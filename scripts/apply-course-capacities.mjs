import fs from "node:fs";
import { env, rest } from "./supabase-rest.mjs";

const file = process.argv[2] || "supabase/templates/course-capacities.csv";
if (process.env.APPLY_COURSE_CAPACITIES !== "1") {
  console.error("Refusing to update courses. Re-run with APPLY_COURSE_CAPACITIES=1 after filling real registrar-approved values.");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`CSV not found: ${file}`);
  process.exit(1);
}

const cfg = env();
const rows = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).slice(1).filter(Boolean);
let updated = 0;
for (const line of rows) {
  const [courseCode, capacityRaw, enrolledRaw] = line.split(",").map((v) => v.trim());
  if (!courseCode) continue;
  const capacity = Number(capacityRaw);
  const enrolled = enrolledRaw === "" ? null : Number(enrolledRaw);
  if (!Number.isInteger(capacity) || capacity < 0) throw new Error(`Invalid capacity for ${courseCode}`);
  if (enrolled !== null && (!Number.isInteger(enrolled) || enrolled < 0)) throw new Error(`Invalid enrolled for ${courseCode}`);
  await rest(cfg, `courses?code=eq.${encodeURIComponent(courseCode)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: enrolled === null ? { capacity } : { capacity, enrolled },
  });
  updated += 1;
}

console.log(`Updated ${updated} course capacity rows`);
