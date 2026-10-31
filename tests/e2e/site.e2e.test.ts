/**
 * End-to-end functional and security tests against a running LOCAL instance.
 *
 *   E2E_BASE_URL=http://127.0.0.1:3000 DATABASE_URL=<local db> npm run test:e2e
 *
 * The server must run with TRUSTED_IP_HEADER=x-real-ip (so each test client can
 * have its own address) and be a production build (`npm run build && npm start`)
 * for the cookie and error-handling checks. Test accounts and rows are removed at the end.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import sharp from "sharp";
import { hashPassword } from "../../src/lib/password";
import { assertLocalTarget, BASE, Client, db, freshIp, sleep, text } from "./helpers";

assertLocalTarget();

const RUN = Date.now().toString(36);
const ADMIN = { email: `e2e-admin-${RUN}@e2e.test`, password: `E2e-admin-${RUN}-pass` };
const MOD = { email: `e2e-mod-${RUN}@e2e.test`, password: `E2e-mod-${RUN}-pass` };
const MARK = `e2e-${RUN}`;

type Entry = { ballotNo: string | null; post: string | null; name: string; membershipNo: string | null };
const source: { sections: { name: string; entries: Entry[] }[] } = JSON.parse(
  readFileSync(join(__dirname, "../../data/candidates.json"), "utf8"),
);

let candidate: { id: string; slug: string; fullName: string };
let original: Record<string, unknown>;
let originalContent: { key: string; value: string }[];

before(async () => {
  const c = await db.candidate.findFirstOrThrow({ where: { isPublished: true }, orderBy: { slug: "asc" } });
  candidate = c;
  const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, ...editable } = c;
  original = editable;
  originalContent = await db.siteContent.findMany({ select: { key: true, value: true } });
  await db.admin.create({ data: { email: ADMIN.email, name: "E2E Admin", role: "admin", passwordHash: await hashPassword(ADMIN.password) } });
  await db.admin.create({ data: { email: MOD.email, name: "E2E Moderator", role: "moderator", passwordHash: await hashPassword(MOD.password) } });
});

after(async () => {
  await db.candidate.update({ where: { id: candidate.id }, data: original });
  await db.siteContent.deleteMany({});
  if (originalContent.length) await db.siteContent.createMany({ data: originalContent });
  await db.comment.deleteMany({ where: { body: { contains: MARK } } });
  const admins = await db.admin.findMany({ where: { email: { endsWith: `${RUN}@e2e.test` } }, select: { id: true, email: true } });
  await db.auditLog.deleteMany({ where: { adminId: { in: admins.map((a) => a.id) } } });
  await db.loginAttempt.deleteMany({
    where: { key: { in: [...admins.map((a) => `email:${a.email}`), ...admins.map((a) => `password-change:${a.id}`)] } },
  });
  await db.admin.deleteMany({ where: { id: { in: admins.map((a) => a.id) } } });
  await db.$disconnect();
});

async function signIn(who: { email: string; password: string }) {
  const c = new Client(freshIp());
  const { res } = await c.submit("/admin/login", (f) => f.includes('name="password"'), { email: who.email, password: who.password });
  assert.equal(res.status, 303, "successful sign-in redirects");
  assert.ok(c.cookies.has("ieb_admin_session"), "session cookie set");
  return c;
}

/** Fills and submits the comment form, waiting out the minimum fill time first. */
async function comment(c: Client, fields: Record<string, string>, opts: { wait?: boolean; slug?: string } = {}) {
  const page = await c.get(`/candidates/${opts.slug ?? candidate.slug}`);
  if (opts.wait !== false) await sleep(3100);
  return c.submit(`/candidates/${opts.slug ?? candidate.slug}`, (f) => f.includes('name="token"'), fields, { html: page.html });
}

describe("public pages", () => {
  test("health check reports the database is reachable", async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  test("home page shows the title, actions and the headquarters ballot", async () => {
    const { res, html } = await new Client(freshIp()).get("/");
    assert.equal(res.status, 200);
    const t = text(html);
    assert.match(t, /Vote 4 BUETian/);
    assert.match(t, /Explore candidates/);
    for (const e of source.sections[0].entries) assert.ok(t.includes(e.name), `home lists ${e.name}`);
  });

  test("every spreadsheet entry appears on its candidate's profile with the same ballot number", async () => {
    const candidates = await db.candidate.findMany({ include: { candidacies: true } });
    const byMember = new Map(candidates.map((c) => [c.membershipNo, c]));
    const pages = new Map<string, string>();
    const client = new Client(freshIp());
    let checked = 0;
    for (const section of source.sections) {
      for (const e of section.entries) {
        const c = byMember.get(e.membershipNo);
        assert.ok(c, `candidate ${e.membershipNo} exists`);
        if (!c.isPublished) continue;
        if (!pages.has(c.slug)) {
          const { res, html } = await client.get(`/candidates/${c.slug}`);
          assert.equal(res.status, 200, `profile ${c.slug} loads`);
          pages.set(c.slug, text(html));
        }
        const page = pages.get(c.slug)!;
        assert.ok(page.includes(c.fullName), `${c.slug} shows its name`);
        if (e.ballotNo) assert.ok(page.includes(`Ballot No. ${e.ballotNo}`), `${c.slug} shows ballot ${e.ballotNo}`);
        if (e.membershipNo) assert.ok(page.includes(e.membershipNo), `${c.slug} shows ${e.membershipNo}`);
        for (const heading of ["Background", "Manifesto", "Voter comments", "Leave a comment"]) {
          assert.ok(page.includes(heading), `${c.slug} has the ${heading} section`);
        }
        checked++;
      }
    }
    assert.ok(checked >= 150, `checked ${checked} entries`);
  });

  test("directory lists every entry, searches case-insensitively and filters by position", async () => {
    const c = new Client(freshIp());
    const all = text((await c.get("/candidates")).html);
    assert.match(all, /Showing 153 ballot entries for 103 candidates/);

    const search = text((await c.get("/candidates?q=rahman")).html);
    assert.match(search, /RAHMAN/);
    assert.match(search, /matching your filters/);

    const byNumber = text((await c.get("/candidates?q=F%2F04266")).html);
    assert.match(byNumber, /SYED MAHFUZ AHMAD/);

    const filtered = text((await c.get("/candidates?position=headquarters-executive--president")).html);
    assert.match(filtered, /Showing 2 ballot entries for 2 candidates/);

    const none = text((await c.get("/candidates?q=zzzz-no-such-name")).html);
    assert.match(none, /No candidates match your search/);
  });

  test("unknown pages return 404 and other public pages render", async () => {
    const c = new Client(freshIp());
    assert.equal((await c.get("/candidates/no-such-candidate")).res.status, 404);
    assert.equal((await c.get("/definitely-missing")).res.status, 404);
    assert.match(text((await c.get("/manifestos")).html), /Manifestos/);
    assert.match(text((await c.get("/about")).html), /How comments work/);
    const robots = await (await fetch(`${BASE}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/admin/);
  });

  test("responses carry the security headers", async () => {
    const res = await fetch(`${BASE}/`);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

describe("comments", () => {
  test("a submission made instantly after page load is rejected and nothing is stored", async () => {
    const body = `Too fast ${MARK}`;
    const { html } = await comment(new Client(freshIp()), { visibility: "public", name: "Fast Person", body }, { wait: false });
    assert.match(text(html), /very fast/);
    assert.equal(await db.comment.count({ where: { body } }), 0);
  });

  test("a valid comment is stored as pending and is not public", async () => {
    const body = `Pending comment ${MARK}`;
    const { html } = await comment(new Client(freshIp()), { visibility: "public", name: "Rahim Uddin", body });
    assert.match(text(html), /submitted for review and will appear after administrator approval/);
    const row = await db.comment.findFirstOrThrow({ where: { body } });
    assert.equal(row.status, "pending");
    assert.equal(row.displayName, "Rahim Uddin");
    assert.ok(!text((await new Client(freshIp()).get(`/candidates/${candidate.slug}`)).html).includes(body));
  });

  test("an anonymous comment never stores the name typed into the form", async () => {
    const body = `Anonymous comment ${MARK}`;
    await comment(new Client(freshIp()), { visibility: "anonymous", name: "Secret Person", body });
    const row = await db.comment.findFirstOrThrow({ where: { body } });
    assert.equal(row.isAnonymous, true);
    assert.equal(row.displayName, null);
  });

  test("invalid input is rejected with field messages", async () => {
    const cases: [Record<string, string>, RegExp][] = [
      [{ visibility: "public", name: "Valid Name", body: `<script>alert(1)</script> ${MARK}` }, /HTML or code is not allowed/],
      [{ visibility: "public", name: "Valid Name", body: `http://a.com http://b.com http://c.com ${MARK}` }, /no more than two links/],
      [{ visibility: "public", name: "Valid Name", body: "hi" }, /at least 5 characters/],
      [{ visibility: "public", name: "<b>bad</b>", body: `Name check ${MARK}` }, /letters, spaces/],
      [{ visibility: "public", name: "", body: `Missing name ${MARK}` }, /at least 2 characters/],
    ];
    for (const [fields, message] of cases) {
      const { html } = await comment(new Client(freshIp()), fields);
      assert.match(text(html), message);
    }
    assert.equal(await db.comment.count({ where: { body: { contains: "script" } } }), 0);
  });

  test("duplicates, forged tokens and the honeypot are handled", async () => {
    const body = `Duplicate check ${MARK}`;
    await comment(new Client(freshIp()), { visibility: "anonymous", body });
    const dup = await comment(new Client(freshIp()), { visibility: "anonymous", body });
    assert.match(text(dup.html), /already been submitted/);

    const forged = await comment(new Client(freshIp()), { visibility: "anonymous", body: `Forged ${MARK}`, token: `${Date.now() - 10_000}.deadbeef` });
    assert.match(text(forged.html), /form has expired/);

    const honey = `Honeypot ${MARK}`;
    const bot = await comment(new Client(freshIp()), { visibility: "anonymous", body: honey, website: "http://spam.example" });
    assert.match(text(bot.html), /submitted for review/, "bots see the normal success message");
    assert.equal(await db.comment.count({ where: { body: honey } }), 0, "but nothing is stored");
  });

  test("one address can submit at most 3 comments in 10 minutes", async () => {
    const c = new Client(freshIp());
    for (let i = 1; i <= 3; i++) {
      const { html } = await comment(c, { visibility: "anonymous", body: `Rate ${i} ${MARK}` });
      assert.match(text(html), /submitted for review/, `comment ${i} accepted`);
    }
    const { html } = await comment(c, { visibility: "anonymous", body: `Rate 4 ${MARK}` });
    assert.match(text(html), /submitted several comments recently/);
  });

  test("moderation: approved comments appear oldest first, anonymity holds, rejected ones disappear", async () => {
    const admin = await signIn(ADMIN);
    const named = await db.comment.findFirstOrThrow({ where: { body: `Pending comment ${MARK}` } });
    const anon = await db.comment.findFirstOrThrow({ where: { body: `Anonymous comment ${MARK}` } });
    for (const row of [named, anon]) {
      const { res } = await admin.submit(`/admin/comments?candidate=${candidate.id}&status=pending`, (f) => f.includes(`value="${row.id}"`), { op: "approve" });
      assert.ok(res.status < 400, "moderation accepted");
    }
    const page = text((await new Client(freshIp()).get(`/candidates/${candidate.slug}`)).html);
    assert.ok(page.includes(named.body) && page.includes(anon.body), "approved comments are public");
    assert.ok(page.indexOf(named.body) < page.indexOf(anon.body), "oldest first");
    assert.ok(page.includes("Rahim Uddin"));
    assert.ok(!page.includes("Secret Person"), "anonymous author name never shown");

    await admin.submit(`/admin/comments?candidate=${candidate.id}&status=approved`, (f) => f.includes(`value="${anon.id}"`), { op: "reject" });
    const after = text((await new Client(freshIp()).get(`/candidates/${candidate.slug}`)).html);
    assert.ok(!after.includes(anon.body), "rejected comment is hidden");
    assert.equal((await db.comment.findUniqueOrThrow({ where: { id: anon.id } })).status, "rejected");
  });
});

describe("administration security", () => {
  test("admin pages redirect when signed out or with a forged session", async () => {
    for (const path of ["/admin", "/admin/comments", "/admin/candidates", "/admin/positions", "/admin/content", "/admin/account"]) {
      const anon = await new Client(freshIp()).get(path);
      assert.equal(anon.res.status, 307, `${path} redirects`);
      assert.match(anon.res.headers.get("location") ?? "", /\/admin\/login$/);
      const forged = new Client(freshIp());
      forged.cookies.set("ieb_admin_session", "forged-token-value");
      const res = await forged.get(path);
      assert.ok([303, 307].includes(res.res.status), `${path} rejects a forged session`);
      assert.doesNotMatch(text(res.html), /Sign out/);
    }
  });

  test("the session cookie is HttpOnly, SameSite=Lax and Secure", async () => {
    const c = new Client(freshIp());
    const { res } = await c.submit("/admin/login", (f) => f.includes('name="password"'), ADMIN);
    const cookie = res.headers.getSetCookie().find((s) => s.startsWith("ieb_admin_session="))!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=lax/i);
    assert.match(cookie, /Secure/i, "Secure flag (production build)");
    assert.match(cookie, /Path=\//);
  });

  test("wrong passwords are rejected and the account locks after 5 failures", async () => {
    const victim = { email: `e2e-lock-${RUN}@e2e.test`, password: `E2e-lock-${RUN}-pass` };
    await db.admin.create({ data: { email: victim.email, name: "Lock", role: "admin", passwordHash: await hashPassword(victim.password) } });
    for (let i = 0; i < 5; i++) {
      const { html } = await new Client(freshIp()).submit("/admin/login", (f) => f.includes('name="password"'), { email: victim.email, password: `wrong-${i}` });
      assert.match(text(html), /email or password is incorrect/);
    }
    const locked = await new Client(freshIp()).submit("/admin/login", (f) => f.includes('name="password"'), victim);
    assert.match(text(locked.html), /Too many sign-in attempts/, "even the right password is refused while locked");
  });

  test("signing out ends the session on the server", async () => {
    const c = await signIn(ADMIN);
    const stolen = c.cookies.get("ieb_admin_session")!;
    await c.submit("/admin", (f) => f.includes("Sign out"), {});
    const replay = new Client(freshIp());
    replay.cookies.set("ieb_admin_session", stolen);
    assert.ok([303, 307].includes((await replay.get("/admin")).res.status), "old session token no longer works");
  });

  test("a moderator cannot open or use candidate management", async () => {
    const mod = await signIn(MOD);
    const page = await mod.get("/admin/candidates");
    assert.ok([303, 307].includes(page.res.status));
    assert.match(page.res.headers.get("location") ?? "", /denied=1/);

    // Replay the admin-only update form (captured by an admin) with the moderator's session.
    const admin = await signIn(ADMIN);
    const { html } = await admin.get(`/admin/candidates/${candidate.id}`);
    await mod.submit(`/admin/candidates/${candidate.id}`, (f) => f.includes('name="manifesto"'), { manifesto: `Moderator edit ${MARK}` }, { html });
    const after = await db.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
    assert.ok(!(after.manifesto ?? "").includes("Moderator edit"), "moderator could not change the candidate");
  });

  test("captured admin forms do nothing without a session, or from another origin", async () => {
    const body = `Replay target ${MARK}`;
    await comment(new Client(freshIp()), { visibility: "anonymous", body });
    const row = await db.comment.findFirstOrThrow({ where: { body } });
    const admin = await signIn(ADMIN);
    const { html } = await admin.get(`/admin/comments?candidate=${candidate.id}&status=pending`);

    await new Client(freshIp()).submit("/admin/comments", (f) => f.includes(`value="${row.id}"`), { op: "delete" }, { html });
    assert.ok(await db.comment.findUnique({ where: { id: row.id } }), "signed-out replay changed nothing");

    const cross = await admin.submit("/admin/comments", (f) => f.includes(`value="${row.id}"`), { op: "approve" }, { html, origin: "https://evil.example" });
    assert.ok(cross.res.status >= 400, `cross-origin action refused (status ${cross.res.status})`);
    assert.equal((await db.comment.findUniqueOrThrow({ where: { id: row.id } })).status, "pending");
  });

  test("admin responses are not cacheable", async () => {
    const admin = await signIn(ADMIN);
    const { res } = await admin.get("/admin");
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  });
});

describe("candidate management", () => {
  test("manifesto formatting renders as text, never as HTML", async () => {
    const admin = await signIn(ADMIN);
    const manifesto = `## Vision\nPlain text ${MARK}\n\n- First <img src=x onerror=alert(1)>\n- Second`;
    await admin.submit(`/admin/candidates/${candidate.id}`, (f) => f.includes('name="manifesto"'), { manifesto });
    const { html } = await new Client(freshIp()).get(`/candidates/${candidate.slug}`);
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "markup is escaped");
    assert.ok(!/<img src=x/i.test(html));
    assert.match(html, /<li>Second<\/li>/);
  });

  test("hiding a candidate removes the profile and directory entries", async () => {
    const admin = await signIn(ADMIN);
    const pick = (f: string) => f.includes('name="manifesto"');
    await admin.submit(`/admin/candidates/${candidate.id}`, pick, { visibility: "hidden" });
    assert.equal((await new Client(freshIp()).get(`/candidates/${candidate.slug}`)).res.status, 404);
    assert.ok(!(await new Client(freshIp()).get("/candidates")).html.includes(`/candidates/${candidate.slug}"`));
    await admin.submit(`/admin/candidates/${candidate.id}`, pick, { visibility: "published" });
    assert.equal((await new Client(freshIp()).get(`/candidates/${candidate.slug}`)).res.status, 200);
  });

  test("photo upload rejects non-images and processes real ones to 4:5 WebP", async () => {
    const admin = await signIn(ADMIN);
    const pick = (f: string) => f.includes('name="photo"');
    const fake = await admin.submit(`/admin/candidates/${candidate.id}`, pick, { photo: new File(["<script>alert(1)</script>"], "x.jpg", { type: "image/jpeg" }) });
    assert.match(text(fake.html), /not a readable image/);

    const jpeg = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#7a8a9a" } }).jpeg().toBuffer();
    await admin.submit(`/admin/candidates/${candidate.id}`, pick, { photo: new File([new Uint8Array(jpeg)], "p.jpg", { type: "image/jpeg" }) });
    const { photoKey } = await db.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
    assert.ok(photoKey, "photo stored");
    if (!photoKey.startsWith("https://")) {
      const img = await fetch(`${BASE}/media/candidates/${photoKey}-400.webp`);
      assert.equal(img.headers.get("content-type"), "image/webp");
      const meta = await sharp(Buffer.from(await img.arrayBuffer())).metadata();
      assert.deepEqual([meta.width, meta.height, meta.format], [400, 500, "webp"]);
    }
    await admin.submit(`/admin/candidates/${candidate.id}`, (f) => f.includes("Remove photo"), {});
    assert.equal((await db.candidate.findUniqueOrThrow({ where: { id: candidate.id } })).photoKey, null);
  });

  test("the media route only serves generated photo names", async () => {
    for (const path of ["..%2F..%2F.env", "..%2Fpackage.json", "x.webp", "%2Fetc%2Fpasswd"]) {
      assert.equal((await fetch(`${BASE}/media/candidates/${path}`)).status, 404, path);
    }
  });

  test("site text appears on the homepage", async () => {
    const admin = await signIn(ADMIN);
    await admin.submit("/admin/content", (f) => f.includes('name="campaignVision"'), { campaignVision: `Shared vision ${MARK}` });
    assert.match(text((await new Client(freshIp()).get("/")).html), new RegExp(`Shared vision ${MARK}`));
  });
});

describe("audit regressions (security-audit run-1)", () => {
  async function newAccount(label: string) {
    const who = { email: `e2e-${label}-${RUN}@e2e.test`, password: `E2e-${label}-${RUN}-pass` };
    await db.admin.create({ data: { email: who.email, name: label, role: "moderator", passwordHash: await hashPassword(who.password) } });
    return who;
  }
  const loginForm = (f: string) => f.includes('name="password"');

  test("a concurrent burst of login guesses verifies at most 5 passwords per account", async () => {
    const victim = await newAccount("burst");
    const c = new Client(freshIp());
    const { html } = await c.get("/admin/login");
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => c.submit("/admin/login", loginForm, { email: victim.email, password: `wrong-${i}` }, { html })),
    );
    const checked = results.filter((r) => /email or password is incorrect/.test(text(r.html))).length;
    const limited = results.filter((r) => /Too many sign-in attempts/.test(text(r.html))).length;
    assert.ok(checked <= 5, `only ${checked} of 12 guesses may be verified`);
    assert.equal(checked + limited, 12);
  });

  test("strangers' failed guesses cannot lock the owner out of a browser they already used", async () => {
    const owner = await newAccount("owner");
    const ownerBrowser = new Client(freshIp());
    const first = await ownerBrowser.submit("/admin/login", loginForm, owner);
    assert.equal(first.res.status, 303);
    assert.ok(ownerBrowser.cookies.has("ieb_admin_device"), "known-device cookie issued");
    ownerBrowser.cookies.delete("ieb_admin_session");

    for (let i = 0; i < 6; i++) {
      await new Client(freshIp()).submit("/admin/login", loginForm, { email: owner.email, password: `attacker-${i}` });
    }
    const stranger = await new Client(freshIp()).submit("/admin/login", loginForm, owner);
    assert.match(text(stranger.html), /Too many sign-in attempts/, "unknown browsers are still limited");

    ownerBrowser.ip = freshIp();
    const again = await ownerBrowser.submit("/admin/login", loginForm, owner);
    assert.equal(again.res.status, 303, "the owner's known browser still signs in");
  });

  test("a concurrent burst of comments from one address stores at most 3", async () => {
    const c = new Client(freshIp());
    const { html } = await c.get(`/candidates/${candidate.slug}`);
    await sleep(3100);
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        c.submit(`/candidates/${candidate.slug}`, (f) => f.includes('name="token"'), { visibility: "anonymous", body: `Burst ${i} ${MARK}` }, { html }),
      ),
    );
    const stored = await db.comment.count({ where: { body: { startsWith: "Burst ", contains: MARK } } });
    assert.equal(stored, 3);
  });

  test("guessing the current password on the change-password form is limited", async () => {
    const who = await newAccount("pwchange");
    const c = await signIn(who);
    const pick = (f: string) => f.includes('name="current"');
    let last = "";
    for (let i = 0; i < 6; i++) {
      last = text((await c.submit("/admin/account", pick, { current: `wrong-${i}`, next: "Another-long-pass-1", confirm: "Another-long-pass-1" })).html);
    }
    assert.match(last, /Too many attempts/);
    const ok = await c.submit("/admin/account", pick, { current: who.password, next: "Another-long-pass-1", confirm: "Another-long-pass-1" });
    assert.match(text(ok.html), /Too many attempts/, "even the right password is refused while limited");
  });
});
