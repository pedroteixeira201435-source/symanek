"use client";

import { useEffect, useState } from "react";
import { Field, Input, SubmitButton } from "@/components/form";
import {
  signIn,
  signOut,
  currentAdminEmail,
  listApplications,
  approveApplication,
  markPaid,
  type AdminApplication,
} from "@/lib/api";
import { college, formatN, programmeBySlug } from "@/lib/content";

const STAGE_LABEL: Record<AdminApplication["stage"], string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  paid: "Part-paid",
  rejected: "Rejected",
  enrolled: "Enrolled",
};

const STAGE_STYLE: Record<AdminApplication["stage"], string> = {
  submitted: "bg-petrol-100 text-petrol-700",
  under_review: "bg-petrol-100 text-petrol-700",
  approved: "bg-amber-100 text-amber-800",
  paid: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-700",
  enrolled: "bg-accent-soft text-accent",
};

function programmeName(slug: string) {
  return programmeBySlug(slug)?.name ?? slug;
}

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    currentAdminEmail().then((e) => {
      setEmail(e);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-petrol-200 border-t-petrol-600" />
      </div>
    );
  }

  return email ? (
    <Console email={email} onSignedOut={() => setEmail(null)} />
  ) : (
    <LoginForm onSignedIn={(e) => setEmail(e)} />
  );
}

function LoginForm({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const em = String(fd.get("email"));
    const res = await signIn(em, String(fd.get("password")));
    setPending(false);
    if (res.ok) {
      const who = (await currentAdminEmail()) ?? em;
      onSignedIn(who);
    } else {
      setError(res.error ?? "Sign-in failed");
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-petrol-900">Admissions console</h1>
        <p className="mt-1 text-sm text-petrol-500">{college.name} — staff sign in</p>
      </div>
      <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6">
        <Field label="Email" required>
          <Input name="email" type="email" required autoComplete="username" placeholder="admin@symanekacademy.com" />
        </Field>
        <Field label="Password" required>
          <Input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
    </div>
  );
}

function Console({ email, onSignedOut }: { email: string; onSignedOut: () => void }) {
  const [apps, setApps] = useState<AdminApplication[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setApps(await listApplications());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications");
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onApprove(a: AdminApplication) {
    setBusy(a.id);
    setError(null);
    try {
      await approveApplication(a.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(null);
    }
  }

  async function onMarkPaid(a: AdminApplication) {
    const input = window.prompt(`Record EFT payment for ${a.fullName}.\nAmount due: ${formatN(a.amountDue)}\n\nAmount received (N$):`, String(a.amountDue));
    if (input == null) return;
    const amount = Number(input.replace(/[^\d.]/g, ""));
    if (!amount || amount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setBusy(a.id);
    setError(null);
    try {
      await markPaid(a.id, amount);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark-paid failed");
    } finally {
      setBusy(null);
    }
  }

  async function onSignOut() {
    await signOut();
    onSignedOut();
  }

  const groups: { key: AdminApplication["stage"][]; title: string }[] = [
    { key: ["submitted", "under_review"], title: "Needs review" },
    { key: ["approved", "paid"], title: "Awaiting / part payment" },
    { key: ["enrolled"], title: "Enrolled" },
    { key: ["rejected"], title: "Rejected" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-petrol-900">Admissions console</h1>
          <p className="mt-0.5 text-sm text-petrol-500">Signed in as {email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="btn btn-ghost btn-md">Refresh</button>
          <button onClick={onSignOut} className="btn btn-ghost btn-md">Sign out</button>
        </div>
      </div>

      {error && <p className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {apps == null ? (
        <div className="py-16 text-center text-petrol-400">Loading applications…</div>
      ) : apps.length === 0 ? (
        <div className="card p-10 text-center text-petrol-500">No applications yet.</div>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => {
            const rows = apps.filter((a) => g.key.includes(a.stage));
            if (rows.length === 0) return null;
            return (
              <section key={g.title}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-petrol-400">
                  {g.title} <span className="ml-1 text-petrol-300">({rows.length})</span>
                </h2>
                <div className="card divide-y divide-petrol-100 overflow-hidden">
                  {rows.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-petrol-900">{a.fullName}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLE[a.stage]}`}>
                            {STAGE_LABEL[a.stage]}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-sm text-petrol-500">{programmeName(a.programmeSlug)}</div>
                        <div className="mt-0.5 text-xs text-petrol-400">
                          {a.email} · {a.phone} · {a.mode === "distance" ? "Distance" : "Full-time"}
                          {a.reference && <> · <span className="font-mono">{a.reference}</span></>}
                        </div>
                      </div>
                      <div className="text-right">
                        {a.amountDue > 0 && a.stage !== "enrolled" && (
                          <div className="mb-1 font-mono text-sm text-petrol-700">{formatN(a.amountDue)}</div>
                        )}
                        <div className="flex justify-end gap-2">
                          {(a.stage === "submitted" || a.stage === "under_review") && (
                            <button disabled={busy === a.id} onClick={() => onApprove(a)} className="btn btn-primary btn-sm disabled:opacity-60">
                              {busy === a.id ? "…" : "Approve"}
                            </button>
                          )}
                          {(a.stage === "approved" || a.stage === "paid") && (
                            <button disabled={busy === a.id} onClick={() => onMarkPaid(a)} className="btn btn-accent btn-sm disabled:opacity-60">
                              {busy === a.id ? "…" : "Record EFT"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
