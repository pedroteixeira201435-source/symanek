import { cleanupByEmail, createSuiteUser, env, rest, rpc, signIn } from "./supabase-rest.mjs";

const cfg = env();
const stamp = Date.now();
const email = `codex.public.${stamp}@example.com`;
const adminEmail = `codex.public.admin.${stamp}@example.com`;
const password = `Codex-${stamp}-Pass!`;
const programmeSlug = `codex-public-${stamp}`;
let programmeId = null;
let appId = null;

async function postJson(path, body) {
  const res = await fetch(`${cfg.siteUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${json.error || res.statusText}`);
  return json;
}

async function step(label, fn) {
  try {
    return await fn();
  } catch (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
}

async function main() {
  console.log(`Public site validation started: ${cfg.siteUrl}`);
  await step("cleanup admin", () => cleanupByEmail(cfg, adminEmail));
  await step("cleanup applicant", () => cleanupByEmail(cfg, email));
  await step("create admin", () => createSuiteUser(cfg, { email: adminEmail, password, role: "admin", suiteRole: "registrar" }));
  const adminSession = await step("admin sign-in", () => signIn(cfg, adminEmail, password));

  const created = await step("create programme", () => rest(cfg, "programmes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{
      slug: programmeSlug,
      name: "Codex Public Validation Programme",
      category: "Validation",
      duration: "1 year",
      fee: 1234,
      modes: "Full-Time",
      description: "Temporary public site validation programme",
      active: true,
    }],
  }));
  programmeId = created[0].id;

  const submitted = await step("submit public application", () => postJson("/api/public/application", {
    fullName: "Codex Public Applicant",
    email,
    phone: "+264810000001",
    programmeSlug,
    mode: "full_time",
    message: "Temporary automated public validation",
  }));
  appId = submitted.applicationId;

  const initial = await step("lookup submitted application", () => postJson("/api/public/application-status", { ref: email }));
  if (!initial.data?.found && !(Array.isArray(initial.data) && initial.data[0]?.found)) throw new Error("Status lookup did not find submitted application");

  const reference = await step("approve application", () => rpc(cfg, "approve_application", { p_app: appId }, { token: adminSession.access_token, key: cfg.anon }));
  const approved = await step("lookup approved application", () => postJson("/api/public/application-status", { ref: email }));
  const row = Array.isArray(approved.data) ? approved.data[0] : approved.data;
  if (!row?.found || row.reference !== reference) throw new Error("Approved status lookup did not return expected reference");

  await step("submit public contact", () => postJson("/api/public/contact", {
    name: "Codex Public Contact",
    email,
    subject: "Validation",
    message: "Temporary contact validation",
  }));

  console.log(`OK: public application/status/contact validated with ${reference}`);
}

async function cleanup() {
  await cleanupByEmail(cfg, adminEmail).catch(() => null);
  await cleanupByEmail(cfg, email).catch(() => null);
  if (programmeId) await rest(cfg, `programmes?id=eq.${programmeId}`, { method: "DELETE" }).catch(() => null);
}

main()
  .finally(cleanup)
  .catch((err) => {
    console.error(`FAILED: ${err.message}`);
    process.exitCode = 1;
  });
