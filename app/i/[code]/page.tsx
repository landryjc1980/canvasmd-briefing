"use client";

// Colleague invite landing (/i/<code>). A reader shared the brief; the colleague enters their
// work email once, we redeem the invite (attributing them to the sharer), set a session, and
// send them straight into the brief. Low friction on purpose — one field, then they're in.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InviteLanding() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [msg, setMsg] = useState("");
  // Focus pre-highlights the sharer's area (the ?area= on the share link) but stays the
  // colleague's own answer — it becomes their default edition for the brief and The Daily.
  const [focus, setFocus] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [daily, setDaily] = useState(false);
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("area");
    if (a && ["GU", "Breast", "Lung", "GI", "Heme", "Gyn"].includes(a)) setFocus(a);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setMsg("");
    try {
      const r = await fetch("/api/brief-invite", {
        method: "POST", headers: { "content-type": "application/json" },
        // A pre-filled (sharer's) focus counts as chosen if they submit with it visibly selected.
        body: JSON.stringify({ code, email, name, area: focus, chosen: touched || focus !== null, daily }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setState("error"); setMsg(j.error || "Couldn't open the invite."); return; }
      // Land on the edition they chose (focus pre-fills from the sharer's ?area=, so an
      // untouched picker still carries the colleague into the same edition that was shared).
      router.push(focus ? `/?area=${encodeURIComponent(focus)}` : "/"); // session cookie is set → the brief renders
    } catch { setState("error"); setMsg("Network error — try again."); }
  };

  // Two layers on purpose: the fixed layer SCROLLS, the inner layer centers — centering on the
  // fixed layer clips the overflow beyond reach on a small phone or at high zoom.
  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#0e1524", color: "#e9edf6", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ minHeight: "100%", boxSizing: "border-box", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
          <span style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 500, fontSize: 28, color: "#fff", letterSpacing: "-.01em" }}>The Readout</span>
          <span style={{ fontWeight: 600, fontSize: 9.5, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginTop: 6 }}>by CanvasMD</span>
        </div>
        <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "#6f7684", marginTop: 8 }}>The Weekly Brief</div>
        <h1 style={{ font: "400 25px/1.25 'Newsreader',Georgia,serif", color: "#f8f9fc", margin: "26px 0 10px" }}>A colleague shared this week's brief with you.</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#aab2c4", margin: "0 0 22px" }}>Enter your work email to open it. No password — this signs you in.</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" autoComplete="name"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "13px 15px", color: "#f4f7ff", fontSize: 15, outline: "none" }} />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "13px 15px", color: "#f4f7ff", fontSize: 15, outline: "none" }} />
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#6f7684", margin: "2px 0 8px" }}>Your focus</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {[["GU", "GU"], ["Breast", "Breast"], ["Lung", "Lung"], ["GI", "GI"], ["Heme", "Heme"], ["Gyn", "Gyn"], ["All", "All of oncology"]].map(([v, label]) => {
                const on = focus === v || (v === "All" && focus === null && touched);
                return (
                  <button key={v} type="button" onClick={() => { setFocus(v === "All" ? null : v); setTouched(true); }}
                    style={{ background: on ? "#7aa2ff" : "rgba(255,255,255,.06)", color: on ? "#0e1524" : "#c3cadb", fontWeight: on ? 700 : 500, fontSize: 12.5, border: `1px solid ${on ? "#7aa2ff" : "rgba(255,255,255,.16)"}`, borderRadius: 999, padding: "7px 13px", cursor: "pointer" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", fontSize: 12.5, lineHeight: 1.45, color: "#aab2c4" }}>
            <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} style={{ marginTop: 2, accentColor: "#7aa2ff" }} />
            <span>Also email me <strong style={{ color: "#dbe2f2" }}>The Daily</strong> — a short morning read of what moved, only on days something did.</span>
          </label>
          <button type="submit" disabled={state === "sending"}
            style={{ background: "#7aa2ff", color: "#0e1524", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 10, padding: "13px 15px", cursor: "pointer", opacity: state === "sending" ? .6 : 1 }}>
            {state === "sending" ? "Opening…" : "Open the brief"}
          </button>
        </form>
        {state === "error" && <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{msg}</p>}
      </div>
      </div>
    </div>
  );
}
