import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the discussion route proxies readout-discussion behind the reader gate with a short memo", () => {
  const route = read("app/api/readout-discussion/route.ts");
  assert.match(route, /currentContactId\(req\)/, "production callers must hold a reader session");
  assert.match(route, /\/functions\/v1\/readout-discussion/);
  assert.match(route, /supabaseApiKeyHeaders\(key\)/, "the project key stays server-side");
  assert.match(route, /DISCUSSION_TTL_MS = 60_000/);
  assert.match(route, /\.slice\(0, MAX_ARTICLES\)/, "at most 12 article ids per call");
  assert.doesNotMatch(route, /Cache-Control/, "no shared cache past the session gate");
});

test("replies join the card as clinician comments with whom they answered, never as shares", () => {
  const code = read("app/briefing-preview/EditorialReadout.tsx");
  assert.match(code, /function loadDiscussion\(articleIds: string\[\]\)/);
  assert.match(code, /fetch\("\/api\/readout-discussion"/);
  assert.match(code, /function withDiscussion\(article: BriefingArticle \| null, discussion: ReadoutDiscussionArticle \| null\)/);
  assert.match(code, /sourceLane: "clinician" as const,\s*replyTo: reply\.replyTo,/, "a quoted reply is a clinician post that remembers its target");
  assert.match(code, /posts: \[\.\.\.\(article\.posts \?\? \[\]\), \.\.\.replies\]/, "replies extend the comment pool; kolSharers is untouched");
  assert.doesNotMatch(code, /kolSharers: [^\n]*discussion/, "replies never change the clinician count");
  assert.match(code, /`\$\{total\} repl\$\{total === 1 \? "y" : "ies"\}\$\{clinicians > 0 \? `, \$\{clinicians\} from clinician/, "the collapsed line shows every reply, and how many came from clinicians");
  assert.match(code, /replies=\{discussion\?\.replyCount \?\? 0\} clinicianReplies=\{discussion\?\.clinicianReplyCount \?\? 0\}/);
  assert.match(code, /usefulPosts\(article\)\.filter\(\(post\) => !post\.replyTo\)\.length/, "'wrote about it' counts authored posts, not replies");
  assert.match(code, /from outside the panel, counted not quoted/);
  assert.match(code, /const article = withDiscussion\(articleWithLiveEvidence\(item, briefs, overlay, window\), discussion\);/);
});

test("a quoted reply shows whom it answered above the quote", () => {
  const voice = read("components/ReadoutVoice.tsx");
  assert.match(voice, /replyTo\?: \{ handle: string \| null; name: string \| null \} \| null;/);
  assert.match(voice, /className="er-reply-to">Replying to \{replyTargetLabel\(post\.replyTo\)\}/);
  const css = read("app/briefing-preview/preview.css");
  assert.match(css, /\.er-reply-to \{/);
  assert.match(css, /\.er-discussion-note \{/);
});

test("the discussion types carry counts and quotes separately", () => {
  const types = read("lib/types.ts");
  assert.match(types, /export type ReadoutDiscussionArticle = \{\s*articleId: string;\s*replyCount: number;\s*clinicianReplyCount: number;\s*quoted: ReadoutDiscussionReply\[\];/);
  assert.match(types, /replyTo\?: \{ handle: string \| null; name: string \| null \} \| null;/, "BriefingSharer can be a reply");
});
