import { spawnSync } from "node:child_process";

for (const script of ["scripts/validate-supabase.mjs", "scripts/validate-public-site.mjs"]) {
  const run = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
