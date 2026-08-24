import { NextRequest, NextResponse } from "next/server";

type RateWindow = { count: number; reset: number };
const requests = new Map<string, RateWindow>();

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(req: NextRequest, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${clientIp(req)}`;
  const current = requests.get(key);
  const value = !current || current.reset <= now ? { count: 0, reset: now + windowMs } : current;
  value.count += 1;
  requests.set(key, value);
  if (value.count <= limit) return null;
  return NextResponse.json({ error: "Too many requests. Please try again later." }, {
    status: 429, headers: { "Retry-After": String(Math.ceil((value.reset - now) / 1000)) },
  });
}
