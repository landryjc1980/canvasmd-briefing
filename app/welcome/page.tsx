"use client";

// The capture wall. Shown to anyone hitting the brief without a valid session. Colleague
// share links skip this (they redeem directly); this is for cold / expired visitors, and
// every submit is a lead — a new corporate domain is a sales signal.

import { useEffect, useState } from "react";

export default function Welcome() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [expired, setExpired] = useState(false);
  const [area, setArea] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setExpired(q.get("expired") === "1");
    setArea(q.get("area"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setMsg("");
    try {
      const r = await fetch("/api/brief-request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, area }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setState("error"); setMsg(j.error || "Something went wrong."); return; }
      setState("sent"); setMsg(j.message || "Check your inbox.");
    } catch { setState("error"); setMsg("Network error — try again."); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0e1524", color: "#e9edf6", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
          <span style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 500, fontSize: 28, color: "#fff", letterSpacing: "-.01em" }}>The Readout</span>
          <span style={{ fontWeight: 600, fontSize: 9.5, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginTop: 6 }}>by CanvasMD</span>
        </div>
        <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "#6f7684", marginTop: 8 }}>The Weekly Brief</div>

        {state === "sent" ? (
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: "#f4f7ff" }}>Check your inbox</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#aab2c4", marginTop: 12 }}>{msg}</p>
          </div>
        ) : (
          <>
            <h1 style={{ font: "400 26px/1.25 'Newsreader',Georgia,serif", color: "#f8f9fc", margin: "26px 0 10px" }}>
              What moved this week in oncology — the conversations, papers, and approvals your field is actually discussing.
            </h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#aab2c4", margin: "0 0 22px" }}>
              {expired ? "That link expired. Enter your work email and we'll send a fresh one." : "This brief is invite-only. Enter your work email — if you're on the list we'll send your sign-in link, otherwise we'll pass your request along to join."}
            </p>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" autoComplete="email"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "13px 15px", color: "#f4f7ff", fontSize: 15, outline: "none" }}
              />
              <button type="submit" disabled={state === "sending"}
                style={{ background: "#7aa2ff", color: "#0e1524", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 10, padding: "13px 15px", cursor: "pointer", opacity: state === "sending" ? .6 : 1 }}>
                {state === "sending" ? "Sending…" : expired ? "Send me a fresh link" : "Request access"}
              </button>
            </form>
            {state === "error" && <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{msg}</p>}
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "#6b7280", marginTop: 18 }}>A private benefit for oncology-focused teams. No password — the link signs you in.</p>
          </>
        )}
      </div>
    </div>
  );
}
