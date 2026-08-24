"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "error-callback": () => void; "expired-callback": () => void }) => void };
  }
}

const SCRIPT_ID = "cf-turnstile-script";

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !host.current || rendered.current) return;
    const render = () => {
      if (!host.current || rendered.current || !window.turnstile) return;
      rendered.current = true;
      window.turnstile.render(host.current, {
        sitekey: siteKey,
        callback: onToken,
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener("load", render); render(); return () => existing.removeEventListener("load", render); }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", render);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", render);
  }, [onToken, siteKey]);

  if (!siteKey) return null;
  return <div ref={host} aria-label="Human verification" />;
}
