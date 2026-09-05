import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canvasmdFile } from "./paired-repo.mjs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const reader = read("app/ReaderView.tsx");
const flat = read("app/ReaderViewFlat.tsx");
const stance = read("app/StanceBlock.tsx");
const hero = read("app/HeroCards.tsx");
const css = read("app/globals.css");
const gate = read("lib/gateServer.ts");
const middleware = read("middleware.ts");
const sharePage = read("app/r/[slug]/page.tsx");
const nativeStoryEvidence = fs.readFileSync(canvasmdFile("components/readout/StoryEvidence.tsx"), "utf8");
const nativeCards = fs.readFileSync(canvasmdFile("components/readout/cards.tsx"), "utf8");
const nativeHero = fs.readFileSync(canvasmdFile("components/readout/HeroCards.tsx"), "utf8");
const nativeSections = fs.readFileSync(canvasmdFile("components/readout/sections.tsx"), "utf8");
const nativeBriefing = fs.readFileSync(canvasmdFile("app/(tabs)/briefing.tsx"), "utf8");
const editorial = read("app/briefing-preview/EditorialReadout.tsx");
const editorialCss = read("app/briefing-preview/preview.css");

test("signed sessions are revalidated before API access or middleware renewal", () => {
  assert.match(gate, /export async function activeContactId/);
  assert.match(gate, /contact\?\.status === "active" \? contact\.id : null/);
  assert.match(gate, /const contactId = await readSession[\s\S]+return activeContactId\(contactId\)/);
  assert.match(middleware, /import \{ activeContactId \} from "\.\/lib\/gateServer"/);
  assert.match(middleware, /const contactId = session \? await activeContactId\(session\.contactId\) : null/);
  assert.ok(middleware.indexOf("if (session && contactId)") < middleware.indexOf("await mintSession(contactId)"));
  assert.match(middleware, /if \(session && !contactId\)[\s\S]+maxAge: 0/);
  assert.match(middleware, /const isSharePage = pathname === "\/r" \|\| pathname\.startsWith\("\/r\/"\)/);
  assert.match(middleware, /if \(isSharePage && !\(session && contactId\)\)[\s\S]+NextResponse\.next\(\)[\s\S]+maxAge: 0/);
  assert.match(sharePage, /import \{ activeContactId \} from "@\/lib\/gateServer"/);
  assert.match(sharePage, /const signedContactId = await readSession[\s\S]+const contactId = await activeContactId\(signedContactId\)/);
  assert.ok(sharePage.indexOf("await activeContactId(signedContactId)") < sharePage.indexOf("if (contactId)"));
  assert.match(sharePage, /why: evidenceBackedHeroWhy\(card\.why, !!ev\)/);
  for (const route of ["app/api/briefing/route.ts", "app/api/daily/route.ts"]) {
    const source = read(route);
    assert.match(source, /currentContactId verifies both the signature and the contact's current active status/);
    assert.match(source, /if \(!\(await currentContactId\(req\)\)\)[\s\S]+status: 401/);
  }
});

test("embedded paper clinician receipts are hoisted into the containing drawer on web and native", () => {
  for (const source of [reader, nativeStoryEvidence]) {
    assert.match(source, /function mergeReceiptPosts/);
    assert.match(source, /story\.papers\.map\(\(paper\) => paper\.posts\?\.length \? paper\.posts : paper\.sharers\)/);
    assert.match(source, /mergeReceiptPosts\(story\.publisherPosts, \.\.\.story\.papers\.map\(\(paper\) => paper\.publisherPosts\)\)/);
    assert.match(source, /mergeReceiptPosts\(story\.otherPosts, \.\.\.story\.papers\.map\(\(paper\) => paper\.otherPosts\)\)/);
    assert.doesNotMatch(source, /story\.(?:publisherPosts|otherPosts) \?\?/);
    assert.match(source, /Capped items=\{clinicianPosts\}/);
    assert.match(source, /showSources=\{false\}/);
  }
  assert.match(flat, /mergeReceiptPosts\(s\.posts, \.\.\.s\.papers\.map/);
  assert.match(flat, /mergeReceiptPosts\(s\.publisherPosts, \.\.\.s\.papers\.map/);
  assert.match(flat, /mergeReceiptPosts\(s\.otherPosts, \.\.\.s\.papers\.map/);
});

test("unusable podcast evidence is labeled without a dead timestamp promise", () => {
  for (const source of [reader, flat, nativeCards]) {
    assert.match(source, /Audio unavailable/);
    assert.doesNotMatch(source, />clip \{clipTs\(p\.startMs\)\}</);
  }
});

test("web evidence controls meet target and contrast contracts", () => {
  assert.match(stance, /S_MUT = "#696c71"/);
  assert.equal((stance.match(/minHeight: 44/g) ?? []).length >= 3, true);
  assert.match(hero, /c\.url[\s\S]{0,260}minHeight: 44/);
  assert.match(hero, /sb\.url[\s\S]{0,240}minHeight: 44/);
  assert.match(reader, /hasSources &&[\s\S]{0,520}minHeight: 44/);
  assert.match(reader, /\[\[`\$\{data\.windowDays\}-day brief`, false\][\s\S]{0,420}minHeight: 44/);
  assert.match(editorialCss, /\.er-window-tabs button \{[^}]*min-height: 44px/);
  assert.match(editorialCss, /\.er-disclose \{[^}]*min-height: 44px/);
  assert.match(editorialCss, /--er-link: #9b451f/);
  assert.match(nativeHero, /sibling\.url![\s\S]{0,180}minHeight: 44/);
  assert.match(css, /\.aq-range\s*\{[\s\S]*?height: 44px/);
  assert.match(css, /\.aq-range::-(?:webkit-slider-runnable-track|moz-range-track)\s*\{[\s\S]*?height: 5px/);
});

test("reader surfaces describe each payload's rolling window consistently", () => {
  assert.match(reader, /Recent guests/);
  assert.match(reader, /\{g\.thisWeek\}[\s\S]{0,180}>\{data\.windowDays\}-day</);
  assert.match(flat, /\{g\.thisWeek\}[\s\S]{0,280}>14-day</);
  assert.doesNotMatch(reader, />This wk</);
  assert.doesNotMatch(flat, />This wk/);
  assert.match(reader, /Podcasts from the past \{data\.windowDays\} days/);
  assert.match(flat, /Podcasts from the past 14 days/);
  const story = read("app/StoryView.tsx");
  assert.match(story, /Past \{data\.windowDays\} days in/);
  assert.match(story, /Guests from the past \$\{data\.windowDays\} days/);
  assert.match(story, /Podcasts from the past \$\{data\.windowDays\} days/);
  assert.doesNotMatch(story, />Wk</);
  assert.match(read("app/AllView.tsx"), /current rolling brief/);
  assert.match(read("app/heroPost.ts"), /current 14-day/);
  assert.match(sharePage, /current contact[\s\S]+activeContactId/);
  assert.match(nativeSections, /Podcasts from the past \{windowDays\} days/);
  assert.match(editorial, /aria-label="Readout window"/);
  assert.match(editorial, /READOUT_WINDOWS\.map/);
  assert.match(editorial, /aria-selected=\{requestedWindow === candidate\}/);
  assert.match(editorial, /Edition: \{displayedEditionDate\}/);
});

test("web receipts preserve quoted context and primary event provenance", () => {
  const story = read("app/StoryView.tsx");
  assert.match(reader, /t\.quotedContext/);
  assert.match(story, /t\.quotedContext/);
  assert.match(reader, /event\.sourceUrl/);
  assert.match(reader, /Clinical field updates/);
  assert.doesNotMatch(reader, /data\.events\.slice\(0, ?8\)/);
  assert.match(reader, /Publisher provenance/);
});

test("flat zero receipts and no-rail desktop measure stay honest", () => {
  assert.match(flat, /meta=\{paperClinicianMeta\(revealableClinicians, a\.kolSharers\)\}/);
  assert.doesNotMatch(flat, /revealableClinicians\} shown in sources/);
  assert.match(reader, /className="rv-editorial-column"[\s\S]{0,180}maxWidth: EDITORIAL_MEASURE/);
  assert.match(reader, /margin: railHasContent \? 0 : "0 auto"/);
});
