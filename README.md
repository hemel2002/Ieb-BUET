# BUETians in IEB Election: 2027-2028 campaign site

A website for the BUET alumni candidates in the Institution of Engineers, Bangladesh (IEB) election. Voters can browse
candidates by ballot section and post, read profiles and manifestos, and leave comments. Comments are published only
after an administrator approves them.

- **Public site:** home, candidate directory (search and filter), individual profiles, manifestos, about.
- **Admin area** (`/admin`): candidate editing, photo upload, positions, comment moderation, site text, audit log.
- **Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Prisma 6 with PostgreSQL (Neon),
  Vercel Blob for photos, sharp for image processing.

---

## 1. Candidate data

The source is `data/BUETian_IEB_Election_Candidates.xlsx`, which has one sheet. It lists the **Ballot No, Name of the
Post, Candidate Name and F/M (IEB membership number)** only. It has no education, designations, backgrounds,
manifestos or photos, so every profile starts with those sections clearly marked "not provided yet". Administrators
fill them in from the dashboard.

| | |
|---|---|
| Ballot entries | 153 |
| Unique candidates (by membership no.) | 103 |
| Positions / ballot sections | 30 / 12 |
| Candidates on more than one ballot | 37 |

**Data model.** A **Candidate** is one person, unique by membership number. A **Candidacy** is that person's ballot
entry for one **Position**, with its ballot number. A **PositionGroup** is a ballot section, such as "Headquarters
Executive". Each candidacy keeps the name **exactly as printed** for that entry.

**Inconsistencies found in the sheet.** These are kept as-is, flagged on the admin overview, and noted on each
record:

1. **Same membership no., different spelling:**
   - F/14140: "MD. AHSANUL RASEL" / "MUHAMMAD AHSANUL RASEL"
   - F/04482: "(KAZI OBAID)" added in one entry
   - F/04984: "GOLAM MD." / "GOLAM MOHAMMAD"
   - F/14252: "MD." / "MOHAMMAD" BADRUL ALAM
   - F/05432: with and without "MD."

   The profile uses the first spelling in the sheet and shows "Also listed as …".
2. **Same name, different membership no.:** ENGR. MD. SADEQUR RAHMAN appears as both F/06517 and M/24579. These are
   treated as two people. Please confirm.
3. **Two posts in one chapter:** ENGR. ASIF HOSSAIN (M/44741) is listed as Chairman (ballot 4) *and* Secretary
   (ballot 2) of the Young Engineers Chapter. Please confirm.

**Re-importing.** The import is idempotent. It creates missing sections, positions, candidates and ballot entries, and
never overwrites existing rows or anything an administrator has edited. A conflicting ballot number is reported,
not applied.

```bash
npm run data:extract   # xlsx -> data/candidates.json   (needs python3 with openpyxl)
npm run db:seed        # import data/candidates.json
npm run data:verify    # check every spreadsheet entry against the database
```

---

## 2. Local installation

Requirements: **Node.js 20.9+** (tested on Node 26) and npm. You need Python 3 + `openpyxl` only to re-extract the
spreadsheet.

```bash
npm install                          # install scripts for prisma/esbuild are pre-approved in package.json
cp .env.example .env                 # set APP_SECRET and the two database URLs (see below)
npm run db:setup                     # apply migrations and import the candidates
npm run admin:create -- --email you@example.org --name "Your Name"   # prompts for a password (12+ chars)
npm run dev                          # http://localhost:3000, admin at /admin/login
```

**A database for local development:**
- **Neon:** create a *development branch* of the project database in the Neon console, and paste its pooled and
  direct URLs into `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- **Offline:** run `npx prisma dev` (a local Postgres bundled with Prisma), and use the `postgres://…` URL it prints
  for both variables, with `&connection_limit=1&pgbouncer=true` added to the end.

Without `BLOB_READ_WRITE_TOKEN`, uploaded photos are saved to `storage/uploads` and served from `/media/candidates/…`.

Other commands:

| Command | What it does |
|---|---|
| `npm run build && npm start` | production build and server |
| `npm run typecheck` | TypeScript check |
| `npm test` | unit tests (formatting parser, slugs, password hashing) |
| `npm run admin:create -- --email … --role moderator` | create a comment-only moderator, or reset an existing account's password and role |

---

## 3. Database

- Schema: `prisma/schema.prisma` (PostgreSQL). Migration: `prisma/migrations/*/migration.sql`.
- The migration adds **CHECK constraints** that Prisma cannot express, so the database itself rejects bad data:
  - comment `status` must be `pending`, `approved` or `rejected`
  - an anonymous comment cannot have a stored name, and a public one must have a name
  - admin `role` must be `admin` or `moderator`
- Unique constraints: membership number; one entry per candidate per position; one ballot number per position.
- Failed sign-in attempts are stored in the `LoginAttempt` table, so the limit holds across serverless instances.
- **Backups:** Neon keeps point-in-time history (see the Neon console). For a manual copy, run
  `pg_dump "$DATABASE_URL_UNPOOLED" > backup.sql`.

---

## 4. Deploying to Vercel

The repository is ready for Vercel. The `vercel-build` script does the following on every deploy:
1. generates the Prisma client
2. applies pending migrations
3. imports the spreadsheet **only if the database is empty**, so candidates an administrator deleted are not
   re-imported
4. builds the site

**One-time setup in the Vercel dashboard:**

1. **Add New → Project →** import the GitHub repository `hemel2002/Ieb-BUET`. The framework is detected as Next.js;
   leave the build settings as they are.
2. Before deploying, open **Environment Variables** and add:
   - `APP_SECRET`: a random 64-character hex string. Generate it with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `TRUSTED_IP_HEADER` = `x-real-ip`
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters): creates the first administrator on the first deploy.
3. **Deploy.** The first build fails at the migration step because there is no database yet. That is expected.
4. **Storage → Create Database → Neon** (Postgres). Connect it to the project for all environments. This adds
   `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
5. **Storage → Create → Blob.** Connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
6. **Deployments → … → Redeploy.** The build creates the tables, imports the 103 candidates and creates your admin
   account.
7. Sign in at `https://<your-project>.vercel.app/admin/login`. Then **delete `ADMIN_PASSWORD`** from the environment
   variables. It is only read when no administrator exists, but it should not be left there.

After that, every push to `main` deploys automatically.

**Notes:**
- Photo uploads are limited to 4 MB, because Vercel rejects request bodies over 4.5 MB.
- Preview deployments share the production database unless you give the Preview environment its own Neon branch.
- If you see `prepared statement "s0" already exists` in the logs, add `&pgbouncer=true` to `DATABASE_URL`.

**Hosting elsewhere instead.** Any Node host with PostgreSQL works:
1. `npm ci && npm run vercel-build`
2. `npm start`, behind HTTPS
3. Set `TRUSTED_IP_HEADER` to whatever header your proxy sets with the client IP.
4. Without Blob, set `UPLOAD_DIR` to a persistent directory.

**HTTPS is required in production.** The admin session cookie is marked `Secure`.

---

## 5. Updating content later

All of this is done from the admin area (`/admin`):

- **Candidate details and background:** Candidates → pick a name. The fields are designation, organisation,
  education, experience, institutional roles, achievements, contributions and other information. Empty sections are
  hidden on the public profile, and the first line of *Educational background* is shown as the academic
  qualification.
- **Manifesto:** on the same page. Enter the text as the candidate provided it. Formatting:
  - a blank line starts a new paragraph
  - `- ` at the start of a line makes a bullet point, `1. ` a numbered item
  - `## ` makes a heading (e.g. Vision, Commitments, Key priorities)

  The public page shows the "last updated" date.
- **Photo:** Upload or Replace (JPEG/PNG/WebP, up to 4 MB). The image is checked, auto-rotated, cropped to a 4:5
  portrait, re-encoded to WebP at 400 and 800 px, stripped of metadata, and stored in Vercel Blob. Remove photo brings back the
  placeholder.
- **Positions:** assign or remove ballot entries on a candidate's page. Positions → rename, reorder or add posts
  and sections.
- **Hide a candidate:** set *Public visibility* to Hidden.
- **Site text:** an optional "shared vision" for the homepage and an "about the campaign" section. Neither appears
  until text is entered.
- **Comments:** Comments → Pending (oldest first). Approve, Reject, Return to pending, or Delete. You can filter by
  status and candidate.

Roles: **admin** has full access. **moderator** can only see Overview, Comments and Account.

---

## 6. How comments are protected

- Every comment is stored as `pending`. Public pages query **only** `status = 'approved'`, so nothing is published
  without an administrator.
- Anonymous comments **never store a name**, and the database enforces this. The public query has no field that
  could identify an author. IPs are kept only as a keyed HMAC for rate limiting, and are never shown.
- Spam and abuse controls:
  - a hidden honeypot field
  - a signed form token that rejects submissions made under 3 seconds after page load, and forged tokens
  - at most 3 comments per 10 minutes and 20 per day per IP, counted in the database
  - duplicate text for the same candidate is rejected
  - HTML, more than two links, and control or bidi-override characters are rejected or stripped
  - length limits on name and comment
- Comments are rendered as plain text, so there is no HTML injection path.

**Admin security:**
- Passwords are hashed with scrypt (N=2¹⁷).
- Sessions use random tokens; only their SHA-256 is stored. Cookies are httpOnly, SameSite=Lax and Secure, with a
  12-hour lifetime. Changing your password signs out your other sessions.
- Login is rate-limited in the database (5 failed attempts per email and 10 per IP every 15 minutes), and wrong
  passwords take as long to reject as unknown emails.
- **Every admin page and Server Action checks the session and role on the server.** The edge proxy only redirects
  people without a session cookie, as a convenience.
- Server Actions get Next.js's built-in same-origin check.
- Security headers: frame-ancestors none, nosniff, referrer policy. `/admin` is marked noindex and no-store.

---

## 7. What was tested

- **Automated:**
  - `npm test`: 9 unit tests pass
  - `npm run data:verify`: 153/153 spreadsheet entries match the database
  - `npm run typecheck` and `npm run build` succeed
- **Manually in a browser** (desktop 1280 px and phone 375 px; dev and production builds):
  - search and position filtering
  - mobile menu, with no horizontal scrolling
  - placeholders for missing photos, and automatic fallback when a photo file fails to load
  - photo upload and replace; a non-image file renamed `.jpg` is rejected
  - manifesto formatting; HTML in a manifesto shows as text
  - comment validation errors and the success message
  - pending comments are invisible publicly; approved ones appear oldest first with their dates; rejected ones stay
    hidden
  - an anonymous comment stores no name, even if one was typed before switching to anonymous
  - duplicate submissions and the per-IP rate limit are rejected
  - a moderator cannot open candidate management
  - `/admin` redirects without a session, and a forged cookie is rejected
  - an unauthenticated Server Action call aimed at moderation changed nothing

**Also tested against PostgreSQL** (a local Prisma Postgres server): the migration and its CHECK constraints, the
import and its `--if-empty` mode, the production build, the sign-in lockout after 5 failures, anonymous comment
submission, approval, and case-insensitive admin search.

**Not tested:** uploads to Vercel Blob and a live Vercel deploy. Both need your Vercel account. The Blob code path
switches on when `BLOB_READ_WRITE_TOKEN` is present; local-disk uploads were tested.

**Known limitations:**
- No email notifications for new comments.
- New admin accounts are created from the command line (or via `ADMIN_EMAIL`/`ADMIN_PASSWORD` for the first one),
  not from the dashboard.
