// Brief Gate — stateless signed tokens (magic-link + session cookie) and their crypto.
// Deliberately edge-safe: only Web Crypto + btoa/atob, no Node APIs, so `middleware.ts`
// (edge runtime) can verify a session with the exact same code the Node API routes use.
//
// A token is `base64url(json).base64url(hmac)`. The magic link in the email and the session
// cookie are the SAME shape, distinguished by `t` ("m" | "s"). The link IS the credential —
// no passwords, ever. Blast radius of a leaked token is "someone reads the free brief", so a
// generous expiry is fine; revocation is enforced separately by checking contact.status.

export const SESSION_COOKIE = "brief_sess";
const MAGIC_TTL_DAYS = 60; // how long an emailed link stays good
const SESS_TTL_DAYS = 90; // how long a click keeps them signed in

export type TokenPayload = { t: "m" | "s" | "u"; c: string; e: number }; // type, contactId, expEpochSecs
// t: m = magic link (email), s = session cookie, u = unsubscribe link

const enc = new TextEncoder();
const dec = new TextDecoder();

function secret(): string {
  const s = process.env.BRIEF_SIGNING_SECRET;
  if (!s) throw new Error("BRIEF_SIGNING_SECRET is not set");
  return s;
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(str: string): Uint8Array {
  const b = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(payload: TokenPayload): Promise<string> {
  const body = bytesToB64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${bytesToB64url(new Uint8Array(sig))}`;
}

async function verify(token: string | undefined | null): Promise<TokenPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(), b64urlToBytes(sig), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(dec.decode(b64urlToBytes(body))) as TokenPayload;
    if (!payload?.c || !payload?.e) return null;
    if (Date.now() > payload.e * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

const daysFromNow = (d: number) => Math.floor(Date.now() / 1000) + d * 86400;

export const mintMagicToken = (contactId: string) => sign({ t: "m", c: contactId, e: daysFromNow(MAGIC_TTL_DAYS) });
export const mintSession = (contactId: string) => sign({ t: "s", c: contactId, e: daysFromNow(SESS_TTL_DAYS) });
export const mintUnsubToken = (contactId: string) => sign({ t: "u", c: contactId, e: daysFromNow(365) });

export async function readUnsubToken(token: string | undefined | null): Promise<string | null> {
  const p = await verify(token);
  return p && p.t === "u" ? p.c : null;
}

/** Returns the contactId if the token is a valid magic-link token, else null. */
export async function readMagicToken(token: string | undefined | null): Promise<string | null> {
  const p = await verify(token);
  return p && p.t === "m" ? p.c : null;
}

/** Returns the contactId if the cookie is a valid session, else null. */
export async function readSession(cookie: string | undefined | null): Promise<string | null> {
  const p = await verify(cookie);
  return p && p.t === "s" ? p.c : null;
}

/** Same check, but keeps the expiry so the caller can decide whether to renew. */
export async function readSessionExpiry(cookie: string | undefined | null): Promise<{ contactId: string; exp: number } | null> {
  const p = await verify(cookie);
  return p && p.t === "s" ? { contactId: p.c, exp: p.e } : null;
}

// A session was minted from a FIXED instant and never renewed, so a reader who opened the brief
// every Monday was hard-logged-out on day 90 regardless. Renew once a session is past its halfway
// point: active readers stay signed in indefinitely, someone genuinely gone for 90 days still lapses.
export const SESSION_RENEW_AFTER_SECS = (SESS_TTL_DAYS / 2) * 86400;

// A boolean "you have been here before" marker, deliberately carrying no identity. The session
// cookie dies at the same moment its token expires, so on an ordinary lapse nothing is sent and
// the wall could not tell a returning member from a stranger — it greeted a lapsed reader with
// "invite-only, we'll pass your request along" instead of offering a fresh link. This outlives
// the session so that branch is actually reachable.
//
// NOT httpOnly, on purpose. The gate REWRITES to /welcome rather than redirecting (so the reader
// keeps the URL they asked for), which means the `?expired=1` hint the middleware adds never
// reaches the browser — the wall reads location.search and would never see it. A cookie survives
// the rewrite. The value is the literal "1": no id, no token, nothing worth reading.
export const RETURNING_COOKIE = "brief_returning";
export const RETURNING_MAX_AGE = 730 * 86400; // 2 years
export const returningCookieOpts = { httpOnly: false, secure: true, sameSite: "lax" as const, path: "/", maxAge: RETURNING_MAX_AGE };

export const SESSION_MAX_AGE = SESS_TTL_DAYS * 86400;
