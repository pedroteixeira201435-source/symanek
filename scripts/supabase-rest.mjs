import fs from "node:fs";

export function loadEnv(file = process.env.VALIDATION_ENV || ".env.codex-handoff") {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

export function requireEnv(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  throw new Error(`Missing environment variable: ${name}`);
}

export function env() {
  loadEnv();
  return {
    url: requireEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"]),
    anon: requireEnv("SUPABASE_ANON_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]),
    service: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    siteUrl: process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://symanek-site.vercel.app",
  };
}

export async function supaFetch(cfg, path, { method = "GET", body, token = cfg.service, key = cfg.service, headers = {} } = {}) {
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      ...(body == null ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = json?.message || json?.error_description || json?.error || text || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

export async function rest(cfg, tableAndQuery, options = {}) {
  return supaFetch(cfg, `/rest/v1/${tableAndQuery}`, options);
}

export async function rpc(cfg, name, body = {}, options = {}) {
  return supaFetch(cfg, `/rest/v1/rpc/${name}`, { method: "POST", body, ...options });
}

export async function authAdmin(cfg, path, options = {}) {
  return supaFetch(cfg, `/auth/v1/admin${path}`, { key: cfg.service, token: cfg.service, ...options });
}

export async function signIn(cfg, email, password) {
  return supaFetch(cfg, "/auth/v1/token?grant_type=password", {
    method: "POST",
    key: cfg.anon,
    token: cfg.anon,
    body: { email, password },
  });
}

export async function cleanupByEmail(cfg, email) {
  const lower = email.toLowerCase();
  const apps = await rest(cfg, `applications?email=eq.${encodeURIComponent(lower)}&select=id,reference`);
  const appIds = (apps ?? []).map((a) => a.id);
  const refs = (apps ?? []).map((a) => a.reference).filter(Boolean);
  const students = await rest(cfg, `students?email=eq.${encodeURIComponent(lower)}&select=id,user_id`);
  const studentIds = (students ?? []).map((s) => s.id);
  const userIds = (students ?? []).map((s) => s.user_id).filter(Boolean);

  for (const sid of studentIds) {
    await rest(cfg, `holds?student_id=eq.${sid}`, { method: "DELETE" }).catch(() => null);
    await rest(cfg, `invoices?student_id=eq.${sid}`, { method: "DELETE" }).catch(() => null);
  }
  await rest(cfg, `contact_messages?email=eq.${encodeURIComponent(lower)}`, { method: "DELETE" }).catch(() => null);
  for (const sid of studentIds) await rest(cfg, `students?id=eq.${sid}`, { method: "DELETE" }).catch(() => null);
  for (const appId of appIds) await rest(cfg, `payments?application_id=eq.${appId}`, { method: "DELETE" }).catch(() => null);
  for (const appId of appIds) await rest(cfg, `applications?id=eq.${appId}`, { method: "DELETE" }).catch(() => null);
  for (const ref of refs) await rest(cfg, `applications?reference=eq.${encodeURIComponent(ref)}`, { method: "DELETE" }).catch(() => null);

  const users = await authAdmin(cfg, `/users?email=${encodeURIComponent(lower)}`).catch(() => null);
  const authUsers = Array.isArray(users?.users) ? users.users : [];
  for (const id of [...new Set([...userIds, ...authUsers.map((u) => u.id).filter(Boolean)])]) {
    await authAdmin(cfg, `/users/${id}`, { method: "DELETE" }).catch(() => null);
  }
}

export async function createSuiteUser(cfg, { email, password, role = "admin", suiteRole = "admin", name = "Codex Validation" }) {
  const user = await authAdmin(cfg, "/users", {
    method: "POST",
    body: { email, password, email_confirm: true, user_metadata: { full_name: name } },
  });
  await rest(cfg, "profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: [{ id: user.id, full_name: name, role, suite_role: suiteRole }],
  });
  return user;
}
