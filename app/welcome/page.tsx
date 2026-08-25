"use client";

// The capture wall. Shown to anyone hitting the brief without a valid session. Colleague
// share links skip this (they redeem directly); this is for cold / expired visitors, and
// every submit is a lead — a new corporate domain is a sales signal.
//
// Styled on the paper/ink system the product itself uses (John 2026-08-18: the old navy
// gate no longer matched the brand) — same tokens as ReaderView/AllView.

import { useEffect, useState } from "react";

const INK = "#17181a", INK2 = "#4f5257", MUT = "#696c71", MUT2 = "#85878c";
const LINE = "#cfd0cb", PAPER = "#f4f4f1", ACCENT = "#475569";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f", Skin: "#6d28d9", All: "#475569",
};

export default function Welcome() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [expired, setExpired] = useState(false);
  const [area, setArea] = useState<string | null>(null);
  const [chosen, setChosen] = useState(false); // true once they TAP a focus chip (vs URL-derived)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // The gate REWRITES here rather than redirecting, so the reader keeps the URL they asked for
    // — which also means the middleware's `?expired=1` never reaches the browser and this check
    // alone was always false. The returning marker is what actually survives a rewrite, so a
    // lapsed member finally gets "here's a fresh link" instead of "this brief is invite-only".
    const returning = /(?:^|;\s*)brief_returning=1/.test(document.cookie);
    setExpired(q.get("expired") === "1" || returning);
    setArea(q.get("area"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setMsg("");
    try {
      const r = await fetch("/api/brief-request", {
        method: "POST", headers: { "content-type": "application/json" },
        // Submitting with a visibly highlighted chip counts as an answer, even if it was
        // pre-filled from the URL they arrived on and they never tapped it.
        body: JSON.stringify({ email, area, chosen: chosen || area !== null }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setState("error"); setMsg(j.error || "Something went wrong."); return; }
      setState("sent"); setMsg(j.message || "Check your inbox.");
    } catch { setState("error"); setMsg("Network error — try again."); }
  };

  const input: React.CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "13px 15px", color: INK, fontSize: 15, outline: "none" };

  // Two layers on purpose: the fixed layer SCROLLS, the inner layer centers. Centering on the
  // fixed layer itself clips the overflow beyond reach — and this is the only place in the
  // product where a reader can convert, so the button has to survive a small phone at 200% zoom.
  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: PAPER, color: INK, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ minHeight: "100%", boxSizing: "border-box", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: ACCENT }}>CanvasMD</div>
          <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 400, fontSize: 30, color: INK, letterSpacing: "-.01em", marginTop: 2 }}>The Readout</div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: MUT2, marginTop: 8 }}>The Weekly Brief</div>

        {state === "sent" ? (
          <div style={{ marginTop: 30 }}>
            <div style={{ font: "500 20px/1.3 'Newsreader',Georgia,serif", color: INK }}>Check your inbox</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: INK2, marginTop: 12 }}>{msg}</p>
          </div>
        ) : (
          <>
            <h1 style={{ font: "400 26px/1.28 'Newsreader',Georgia,serif", color: INK, margin: "24px 0 10px" }}>
              What moved this week in oncology — the conversations, papers, and approvals your field is actually discussing.
            </h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: INK2, margin: "0 0 20px" }}>
              {expired ? "Your sign-in expired. Enter your work email and we'll send a fresh link." : "This brief is invite-only. Enter your work email — if you're on the list we'll send your sign-in link, otherwise we'll pass your request along to join."}
            </p>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" autoComplete="email" style={input}
              />
              {/* The specialty question, asked ONCE at the door — it decides which edition of the
                  brief this reader gets, so it can't stay an accident of which link
                  they arrived on. Pre-highlighted from the URL when they came via an area link. */}
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: MUT2, margin: "2px 0 8px" }}>Your focus</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {[["GU", "GU"], ["Breast", "Breast"], ["Lung", "Lung"], ["GI", "GI"], ["Heme", "Heme"], ["Gyn", "Gyn"], ["Skin", "Skin"], ["All", "All of oncology"]].map(([v, label]) => {
                    const on = area === v || (v === "All" && area === null && chosen);
                    const c = AREA_ACCENTS[v] ?? ACCENT;
                    return (
                      <button key={v} type="button" onClick={() => { setArea(v === "All" ? null : v); setChosen(true); }}
                        style={{ background: on ? c : "#fff", color: on ? "#fff" : INK2, fontWeight: on ? 700 : 500, fontSize: 12.5, border: `1px solid ${on ? c : LINE}`, borderRadius: 999, padding: "7px 13px", cursor: "pointer" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="submit" disabled={state === "sending"}
                style={{ background: INK, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 10, padding: "13px 15px", cursor: "pointer", opacity: state === "sending" ? .6 : 1 }}>
                {state === "sending" ? "Sending…" : expired ? "Send me a fresh link" : "Request access"}
              </button>
            </form>
            {state === "error" && <p style={{ color: AREA_ACCENTS.Heme, fontSize: 13, marginTop: 10 }}>{msg}</p>}
            <p style={{ fontSize: 12, lineHeight: 1.5, color: MUT, marginTop: 18 }}>A private benefit for oncology-focused teams. No password — the link signs you in.</p>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
