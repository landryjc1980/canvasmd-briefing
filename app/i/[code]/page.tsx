"use client";

// Colleague invite landing (/i/<code>). A reader shared the brief; the colleague enters their
// work email once, we redeem the invite (attributing them to the sharer), set a session, and
// send them straight into the brief. Low friction on purpose — one field, then they're in.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InviteLanding() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setMsg("");
    try {
      const r = await fetch("/api/brief-invite", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, email, name }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setState("error"); setMsg(j.error || "Couldn't open the invite."); return; }
      router.push("/"); // session cookie is set → the brief renders
    } catch { setState("error"); setMsg("Network error — try again."); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0e1524", color: "#e9edf6", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 500, fontSize: 24, color: "#fff", letterSpacing: "-.01em" }}>The Readout</span>
          <span style={{ fontWeight: 600, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>by CanvasMD</span>
        </div>
        <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "#6f7684", marginTop: 8 }}>The Weekly Brief</div>
        <h1 style={{ font: "400 25px/1.25 'Newsreader',Georgia,serif", color: "#f8f9fc", margin: "26px 0 10px" }}>A colleague shared this week's brief with you.</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#aab2c4", margin: "0 0 22px" }}>Enter your work email to open it. No password — this signs you in.</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" autoComplete="name"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "13px 15px", color: "#f4f7ff", fontSize: 15, outline: "none" }} />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "13px 15px", color: "#f4f7ff", fontSize: 15, outline: "none" }} />
          <button type="submit" disabled={state === "sending"}
            style={{ background: "#7aa2ff", color: "#0e1524", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 10, padding: "13px 15px", cursor: "pointer", opacity: state === "sending" ? .6 : 1 }}>
            {state === "sending" ? "Opening…" : "Open the brief"}
          </button>
        </form>
        {state === "error" && <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{msg}</p>}
      </div>
    </div>
  );
}
