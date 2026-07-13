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

export const SESSION_MAX_AGE = SESS_TTL_DAYS * 86400;
