"use client";

// Colleague invite landing (/i/<code>). A reader shared the brief; the colleague enters their
// work email once, we redeem the invite (attributing them to the sharer), set a session, and
// send them straight into the brief. Low friction on purpose — one field, then they're in.
//
// Paper/ink styling to match the product and the welcome wall (John 2026-08-18).

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const INK = "#17181a", INK2 = "#4f5257", MUT2 = "#85878c";
const LINE = "#cfd0cb", PAPER = "#f4f4f1", ACCENT = "#475569";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f", Skin: "#6d28d9", All: "#475569",
};

export default function InviteLanding() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [msg, setMsg] = useState("");
  // Focus pre-highlights the sharer's area (the ?area= on the share link) but stays the
  // colleague's own answer — it becomes their default edition for the brief.
  const [focus, setFocus] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("area");
    if (a && ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"].includes(a)) setFocus(a);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setMsg("");
    try {
      const r = await fetch("/api/brief-invite", {
        method: "POST", headers: { "content-type": "application/json" },
        // A pre-filled (sharer's) focus counts as chosen if they submit with it visibly selected.
        body: JSON.stringify({ code, email, name, area: focus, chosen: touched || focus !== null }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setState("error"); setMsg(j.error || "Couldn't open the invite."); return; }
      // Land on the edition they chose (focus pre-fills from the sharer's ?area=, so an
      // untouched picker still carries the colleague into the same edition that was shared).
      router.push(focus ? `/?area=${encodeURIComponent(focus)}` : "/"); // session cookie is set → the brief renders
    } catch { setState("error"); setMsg("Network error — try again."); }
  };

  const input: React.CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "13px 15px", color: INK, fontSize: 15, outline: "none" };

  // Two layers on purpose: the fixed layer SCROLLS, the inner layer centers — centering on the
  // fixed layer clips the overflow beyond reach on a small phone or at high zoom.
  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: PAPER, color: INK, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ minHeight: "100%", boxSizing: "border-box", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: ACCENT }}>CanvasMD</div>
          <div style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 400, fontSize: 30, color: INK, letterSpacing: "-.01em", marginTop: 2 }}>The Readout</div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: MUT2, marginTop: 8 }}>The Weekly Brief</div>
        <h1 style={{ font: "400 25px/1.28 'Newsreader',Georgia,serif", color: INK, margin: "24px 0 10px" }}>A colleague shared this week&rsquo;s brief with you.</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: INK2, margin: "0 0 20px" }}>Enter your work email to open it. No password — this signs you in.</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" autoComplete="name" style={input} />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" style={input} />
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: MUT2, margin: "2px 0 8px" }}>Your focus</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {[["GU", "GU"], ["Breast", "Breast"], ["Lung", "Lung"], ["GI", "GI"], ["Heme", "Heme"], ["Gyn", "Gyn"], ["Skin", "Skin"], ["All", "All of oncology"]].map(([v, label]) => {
                const on = focus === v || (v === "All" && focus === null && touched);
                const c = AREA_ACCENTS[v] ?? ACCENT;
                return (
                  <button key={v} type="button" onClick={() => { setFocus(v === "All" ? null : v); setTouched(true); }}
                    style={{ background: on ? c : "#fff", color: on ? "#fff" : INK2, fontWeight: on ? 700 : 500, fontSize: 12.5, border: `1px solid ${on ? c : LINE}`, borderRadius: 999, padding: "7px 13px", cursor: "pointer" }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="submit" disabled={state === "sending"}
            style={{ background: INK, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 10, padding: "13px 15px", cursor: "pointer", opacity: state === "sending" ? .6 : 1 }}>
            {state === "sending" ? "Opening…" : "Open the brief"}
          </button>
        </form>
        {state === "error" && <p style={{ color: AREA_ACCENTS.Heme, fontSize: 13, marginTop: 10 }}>{msg}</p>}
      </div>
      </div>
    </div>
  );
}
