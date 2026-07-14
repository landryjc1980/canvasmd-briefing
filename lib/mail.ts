// Brief Gate email — sends the personalized magic-link via Resend's REST API (no SDK dep,
// same pattern as the canvasmd send-episode-email function). Pharma-facing B2B, so we keep a
// plain CAN-SPAM footer + one-click unsubscribe link.

const RESEND_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";
const FROM_NAME = process.env.BRIEF_FROM_NAME ?? "The Readout";
const PHYSICAL = process.env.MAIL_PHYSICAL_ADDRESS ?? "CanvasMD";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function magicHtml(opts: { name: string | null; link: string; unsubUrl: string; areaLabel: string }): string {
  const hi = opts.name ? `Hi ${esc(opts.name.split(" ")[0])},` : "Hi,";
  return `<!doctype html><html><body style="margin:0;background:#0e1524;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e9edf6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1524;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">
        <tr><td style="padding:0 28px">
          <div style="letter-spacing:-.01em"><span style="font-family:Georgia,serif;font-weight:bold;font-size:22px;color:#fff">The Readout</span> <span style="font-size:9px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:#9aa6c0">by CanvasMD</span></div>
          <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6f7684;margin-top:6px">The Weekly Brief</div>
          <div style="height:1px;background:rgba(255,255,255,.12);margin:22px 0"></div>
          <p style="font-size:15px;line-height:1.55;color:#cfd6e6;margin:0 0 14px">${hi}</p>
          <p style="font-size:15px;line-height:1.55;color:#cfd6e6;margin:0 0 22px">Here's what moved this week in ${esc(opts.areaLabel)} — the podcast conversations, KOL posts, papers, and approvals your field is actually talking about.</p>
          <a href="${opts.link}" style="display:inline-block;background:#7aa2ff;color:#0e1524;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px">Read this week's brief →</a>
          <p style="font-size:12.5px;line-height:1.5;color:#8b93a4;margin:26px 0 0">This link signs you in automatically. It's just for you — but if a colleague would find it useful, there's a "share" option inside.</p>
          <div style="height:1px;background:rgba(255,255,255,.1);margin:26px 0 14px"></div>
          <p style="font-size:11px;line-height:1.5;color:#6b7280;margin:0">${esc(PHYSICAL)} · <a href="${opts.unsubUrl}" style="color:#8b93a4">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export async function sendMagicLink(opts: {
  email: string; name: string | null; link: string; unsubUrl: string; areaLabel: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_KEY || !FROM_EMAIL) return { ok: false, error: "RESEND_API_KEY / RESEND_FROM_EMAIL not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [opts.email],
      subject: `Your Weekly Brief — ${opts.areaLabel}`,
      html: magicHtml(opts),
      headers: {
        "List-Unsubscribe": `<${opts.unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) return { ok: false, error: `resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
  return { ok: true };
}
