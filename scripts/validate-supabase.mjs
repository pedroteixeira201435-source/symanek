import { cleanupByEmail, createSuiteUser, env, rest, rpc, signIn, supaFetch } from "./supabase-rest.mjs";

const cfg = env();
const stamp = Date.now();
const adminEmail = `codex.admin.${stamp}@example.com`;
const studentEmail = `codex.student.${stamp}@example.com`;
const password = `Codex-${stamp}-Pass!`;
const programmeSlug = `codex-uat-${stamp}`;
let programmeId = null;
let courseId = null;

async function main() {
  console.log("Supabase validation started");
  await cleanupByEmail(cfg, adminEmail);
  await cleanupByEmail(cfg, studentEmail);

  await createSuiteUser(cfg, { email: adminEmail, password, role: "admin", suiteRole: "registrar" });
  const adminSession = await signIn(cfg, adminEmail, password);
  const adminToken = adminSession.access_token;

  const programmes = await rest(cfg, `programmes?slug=eq.${programmeSlug}&select=id`);
  if (programmes.length) programmeId = programmes[0].id;
  else {
    const created = await rest(cfg, "programmes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: [{
        slug: programmeSlug,
        name: "Codex UAT Programme",
        category: "Validation",
        duration: "1 year",
        fee: 1000,
        modes: "Full-Time",
        description: "Temporary validation programme",
        active: true,
      }],
    });
    programmeId = created[0].id;
  }

  const createdCourse = await rpc(cfg, "course_upsert", {
    p_id: null,
    p_code: `COD-${String(stamp).slice(-6)}`,
    p_title: "Codex UAT Course",
    p_programme: programmeId,
    p_credits: 8,
    p_semester: "S1",
    p_capacity: 5,
    p_lecturer: null,
  }, { token: adminToken, key: cfg.anon });
  courseId = createdCourse;

  const appId = await rpc(cfg, "submit_application", {
    p_full_name: "Codex Validation Student",
    p_email: studentEmail,
    p_phone: "+264810000000",
    p_programme_slug: programmeSlug,
    p_mode: "full_time",
    p_message: "Temporary automated validation",
  }, { token: cfg.service, key: cfg.service });

  const reference = await rpc(cfg, "approve_application", { p_app: appId }, { token: adminToken, key: cfg.anon });
  await rpc(cfg, "mark_paid", { p_app: appId, p_amount: 1000, p_method: "EFT" }, { token: adminToken, key: cfg.anon });

  const students = await rest(cfg, `students?email=eq.${encodeURIComponent(studentEmail)}&select=id,reference,user_id`);
  if (students.length !== 1) throw new Error("Student was not created after payment");
  const studentId = students[0].id;

  const grant = await supaFetch(cfg, "/functions/v1/grant-student-access", {
    method: "POST",
    key: cfg.anon,
    token: adminToken,
    body: { student_id: studentId },
  });
  if (!grant?.password) throw new Error("Student access function did not return credentials");

  const studentSession = await signIn(cfg, studentEmail, grant.password);
  const registration = await rpc(cfg, "register_course", { p_course_id: courseId }, { token: studentSession.access_token, key: cfg.anon });
  if (registration?.status !== "registered") throw new Error(`Expected registered, got ${JSON.stringify(registration)}`);

  await rpc(cfg, "hold_place", {
    p_student: studentId,
    p_type: "advising",
    p_reason: "Temporary validation hold",
    p_blocks: ["registration"],
  }, { token: adminToken, key: cfg.anon });

  console.log(`OK: admissions/payment/access/course registration/holds validated with ${reference}`);
}

async function cleanup() {
  await cleanupByEmail(cfg, adminEmail).catch(() => null);
  await cleanupByEmail(cfg, studentEmail).catch(() => null);
  if (courseId) await rest(cfg, `courses?id=eq.${courseId}`, { method: "DELETE" }).catch(() => null);
  if (programmeId) await rest(cfg, `programmes?id=eq.${programmeId}`, { method: "DELETE" }).catch(() => null);
}

main()
  .finally(cleanup)
  .catch((err) => {
    console.error(`FAILED: ${err.message}`);
    process.exitCode = 1;
  });
