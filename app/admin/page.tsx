"use client";

// Brief Gate admin console (MVP). Protected by a shared token (BRIEF_ADMIN_TOKEN) entered
// once and kept in localStorage, sent as x-admin-token. Three jobs: upload the send list
// (CSV), send the brief, and read the "who's hot" engagement signal for sales.

import { useEffect, useState } from "react";

type Row = {
  contact_id: string; email: string; name: string | null; org: string | null; role: string | null;
  default_area: string | null; source: string; status: string; invited_by_email: string | null;
  opens: number; views: number; story_views: number; shares: number; active_weeks: number; last_event_at: string | null;
};

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [csv, setCsv] = useState("email,name,org,role,area\n");
  const [out, setOut] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [requests, setRequests] = useState<{ id: string; email: string; default_area: string | null; created_at?: string }[]>([]);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("brief_admin_key") || new URLSearchParams(window.location.search).get("key") || "";
    setKey(saved);
    loadSignal(saved); // try the saved token, else the brief session cookie (admin-email login)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hdr = () => ({ "x-admin-token": key, "content-type": "application/json" });

  const loadRequests = async (k = key) => {
    const r = await fetch("/api/admin/requests", { headers: { "x-admin-token": k } });
    if (r.ok) { const j = await r.json(); setRequests(j.requests || []); }
  };
  const loadSignal = async (k = key) => {
    // send the token only if we have one; otherwise the request rides the brief session cookie
    const r = await fetch("/api/admin/signal", { headers: k ? { "x-admin-token": k } : {} });
    if (r.ok) { const j = await r.json(); setRows(j.rows || []); setAuthed(true); if (k) localStorage.setItem("brief_admin_key", k); loadRequests(k); }
    else { setAuthed(false); if (k) setOut("Bad admin token."); } // silent when just probing the session
  };
  const decide = async (id: string, action: "approve" | "decline") => {
    setRequests((rs) => rs.filter((x) => x.id !== id)); // optimistic
    await fetch("/api/admin/requests", { method: "POST", headers: hdr(), body: JSON.stringify({ id, action }) });
    loadSignal();
  };

  const upload = async () => {
    setOut("Uploading…");
    const r = await fetch("/api/admin/upload", { method: "POST", headers: hdr(), body: JSON.stringify({ csv }) });
    const j = await r.json();
    setOut(JSON.stringify(j, null, 2));
    if (j.ok) loadSignal();
  };
  const send = async (test?: string) => {
    setOut(test ? `Sending test to ${test}…` : "Sending to full list…");
    const r = await fetch("/api/admin/send", { method: "POST", headers: hdr(), body: JSON.stringify(test ? { test } : {}) });
    setOut(JSON.stringify(await r.json(), null, 2));
    loadSignal();
  };

  const box: React.CSSProperties = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: 18, marginBottom: 18 };
  const btn: React.CSSProperties = { background: "#7aa2ff", color: "#0e1524", fontWeight: 700, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 14 };
  const input: React.CSSProperties = { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 8, padding: "9px 12px", color: "#f4f7ff", fontSize: 14, outline: "none" };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#0e1524", color: "#e9edf6", fontFamily: "system-ui", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: 340 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 8 }}>Brief Gate · Admin</div>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#8b93a4", marginBottom: 16 }}>Sign into the brief with an admin email (landryjc@gmail.com) and you&rsquo;ll be let in here automatically. Or enter the admin token below.</p>
          <input style={{ ...input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} type="password" placeholder="Admin token" value={key} onChange={(e) => setKey(e.target.value)} />
          <button style={{ ...btn, width: "100%" }} onClick={() => loadSignal()}>Enter</button>
          {out && <p style={{ color: "#ff8a8a", fontSize: 13, marginTop: 10 }}>{out}</p>}
        </div>
      </div>
    );
  }

  const hot = [...rows].sort((a, b) => (b.views + b.story_views + b.shares * 3) - (a.views + a.story_views + a.shares * 3));

  return (
    <div style={{ minHeight: "100vh", background: "#0e1524", color: "#e9edf6", fontFamily: "system-ui", padding: "28px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 20 }}>Brief Gate · Admin</div>

      <div style={{ ...box, ...(requests.length ? { border: "1px solid rgba(122,162,255,.5)" } : {}) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>Access requests {requests.length ? <span style={{ background: "#7aa2ff", color: "#0e1524", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "1px 9px", marginLeft: 6 }}>{requests.length}</span> : null}</div>
          <button style={{ ...btn, background: "rgba(255,255,255,.14)", color: "#f4f7ff" }} onClick={() => loadRequests()}>Refresh</button>
        </div>
        {requests.length === 0
          ? <div style={{ fontSize: 13, color: "#8b93a4" }}>No pending requests. People you add or who arrive via a share link are approved automatically; anyone else who enters their email shows up here to approve.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {requests.map((q) => (
                <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "rgba(255,255,255,.04)", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f4f7ff", fontSize: 14 }}>{q.email}</div>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : ""}{q.default_area ? ` · viewed ${q.default_area}` : ""}</div>
                  </div>
                  <button style={btn} onClick={() => decide(q.id, "approve")}>Approve</button>
                  <button style={{ ...btn, background: "transparent", color: "#8b93a4", border: "0.5px solid rgba(255,255,255,.2)" }} onClick={() => decide(q.id, "decline")}>Decline</button>
                </div>
              ))}
            </div>}
      </div>

      <div style={box}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>1 · Add people (CSV)</div>
        <div style={{ fontSize: 12.5, color: "#8b93a4", marginBottom: 10 }}>Header row required: <code>email,name,org,role,area</code> — area optional (GU, Breast, Lung, GI, Heme, Gyn). <span style={{ color: "#a9b6d6" }}>Each newly-added person is emailed a sign-in link automatically;</span> re-uploading won&rsquo;t re-email existing people.</div>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} style={{ ...input, width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12.5, resize: "vertical" }} />
        <div style={{ marginTop: 10 }}><button style={btn} onClick={upload}>Upload</button></div>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>2 · Send the brief</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input style={input} placeholder="test@company.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <button style={{ ...btn, background: "rgba(255,255,255,.14)", color: "#f4f7ff" }} onClick={() => send(testEmail)} disabled={!testEmail}>Send test</button>
          <button style={btn} onClick={() => { if (confirm("Send to the entire active list?")) send(); }}>Send to full list</button>
        </div>
      </div>

      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>3 · Who's hot <span style={{ color: "#8b93a4", fontWeight: 400 }}>· {rows.length} contacts</span></div>
          <button style={{ ...btn, background: "rgba(255,255,255,.14)", color: "#f4f7ff" }} onClick={() => loadSignal()}>Refresh</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ textAlign: "left", color: "#8b93a4" }}>
              {["Contact", "Org", "Area", "Src", "Opens", "Views", "Stories", "Shares", "Wks", "Invited by", "Last seen"].map((h) => <th key={h} style={{ padding: "7px 9px", borderBottom: "1px solid rgba(255,255,255,.12)", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {hot.map((r) => (
                <tr key={r.contact_id} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <td style={{ padding: "7px 9px" }}><div style={{ color: "#f4f7ff" }}>{r.name || r.email}</div><div style={{ color: "#6b7280", fontSize: 11 }}>{r.email}</div></td>
                  <td style={{ padding: "7px 9px", whiteSpace: "nowrap" }}>{r.org || "—"}</td>
                  <td style={{ padding: "7px 9px" }}>{r.default_area || "—"}</td>
                  <td style={{ padding: "7px 9px" }}>{r.source}{r.status !== "active" ? ` · ${r.status}` : ""}</td>
                  <td style={{ padding: "7px 9px", textAlign: "right" }}>{r.opens}</td>
                  <td style={{ padding: "7px 9px", textAlign: "right" }}>{r.views}</td>
                  <td style={{ padding: "7px 9px", textAlign: "right" }}>{r.story_views}</td>
                  <td style={{ padding: "7px 9px", textAlign: "right", color: r.shares ? "#7aa2ff" : undefined }}>{r.shares}</td>
                  <td style={{ padding: "7px 9px", textAlign: "right" }}>{r.active_weeks}</td>
                  <td style={{ padding: "7px 9px", color: "#8b93a4", whiteSpace: "nowrap" }}>{r.invited_by_email || "—"}</td>
                  <td style={{ padding: "7px 9px", color: "#8b93a4", whiteSpace: "nowrap" }}>{r.last_event_at ? new Date(r.last_event_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {out && <pre style={{ ...box, whiteSpace: "pre-wrap", fontSize: 12, color: "#aab2c4" }}>{out}</pre>}
    </div>
  );
}
