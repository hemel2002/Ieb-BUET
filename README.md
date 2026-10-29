# Vote 4 BUETian: IEB Election 2027-2028 campaign site

A website for the BUET alumni candidates in the Institution of Engineers, Bangladesh (IEB) election. Voters can browse
candidates by ballot section and post, read profiles and manifestos, and leave comments. Comments are published only
after an administrator approves them.

- **Public site:** home, candidate directory (search and filter), individual profiles, manifestos, about.
- **Admin area** (`/admin`): candidate editing, photo upload, positions, comment moderation, site text, audit log.
- **Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Prisma 6 with SQLite, sharp for images.

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

Requirements: **Node.js 20.9+** (tested on Node 26) and npm. You only need Python 3 + `openpyxl` to re-extract the
spreadsheet.

```bash
npm install                          # install scripts for prisma/esbuild are pre-approved in package.json
cp .env.example .env                 # then set APP_SECRET (see the comment in the file)
npm run db:setup                     # create storage/ieb.db, apply migrations, import candidates
npm run admin:create -- --email you@example.org --name "Your Name"   # prompts for a password (12+ chars)
npm run dev                          # http://localhost:3000, admin at /admin/login
```

Other commands:

| Command | What it does |
|---|---|
| `npm run build && npm start` | production build and server |
| `npm run typecheck` | TypeScript check |
| `npm test` | unit tests (formatting parser, slugs, password hashing) |
| `npm run admin:create -- --email … --role moderator` | create a comment-only moderator, or reset an existing account's password and role |

---

## 3. Database

- Schema: `prisma/schema.prisma`. Migration: `prisma/migrations/*/migration.sql`.
- The migration adds **CHECK constraints** that Prisma cannot express, so the database itself rejects bad data:
  - comment `status` must be `pending`, `approved` or `rejected`
  - an anonymous comment cannot have a stored name, and a public one must have a name
  - admin `role` must be `admin` or `moderator`
- Unique constraints: membership number; one entry per candidate per position; one ballot number per position.
- Persistent data lives in `storage/`: `ieb.db` plus `uploads/candidates/*.webp`. **Back up both.**
  ```bash
  sqlite3 storage/ieb.db ".backup 'backup-$(date +%F).db'" && tar czf uploads-$(date +%F).tgz storage/uploads
  ```

**Moving to PostgreSQL:**
1. In `schema.prisma`, set `provider = "postgresql"` and point `DATABASE_URL` at your server.
2. Move `prisma/migrations` aside and run `npx prisma migrate dev --name init`.
3. Copy the five `CHECK` constraints from the SQLite migration into the new migration as
   `ALTER TABLE … ADD CONSTRAINT …` statements.
4. Run `npm run db:seed`.

No application code changes are needed.

---

## 4. Production deployment (single Linux server)

The app needs a **persistent disk** for the SQLite file and uploaded photos. A small VPS works well (Ubuntu, 1 GB
RAM). It will **not** run as-is on serverless hosts such as Vercel, which have no persistent filesystem. Those need
PostgreSQL (above) plus object storage for photos, which would mean replacing `src/lib/images.ts` and the
`/media` route.

```bash
# as a deploy user, in /opt/ieb-campaign
git clone <repo> . && npm ci && npm run build
sudo mkdir -p /var/lib/ieb-campaign && sudo chown $USER /var/lib/ieb-campaign
cp .env.production.example .env           # set APP_SECRET; paths point at /var/lib/ieb-campaign
npm run db:setup
npm run admin:create -- --email you@example.org --name "Your Name"
```

`/etc/systemd/system/ieb-campaign.service`:
```ini
[Unit]
Description=Vote 4 BUETian site
After=network.target

[Service]
WorkingDirectory=/opt/ieb-campaign
EnvironmentFile=/opt/ieb-campaign/.env
ExecStart=/usr/bin/npm start -- -p 3000
Restart=always
User=deploy

[Install]
WantedBy=multi-user.target
```

nginx (then run `certbot --nginx` for HTTPS):
```nginx
server {
  server_name vote4buetian.example.org;
  client_max_body_size 6m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;   # matches TRUSTED_IP_HEADER=x-real-ip
  }
}
```

**HTTPS is required in production.** The admin session cookie is marked `Secure`, so sign-in will not work over
plain HTTP. To deploy an update: `git pull && npm ci && npm run build && npx prisma migrate deploy && sudo systemctl
restart ieb-campaign`.

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
- **Photo:** Upload or Replace (JPEG/PNG/WebP, up to 5 MB). The image is checked, auto-rotated, cropped to a 4:5
  portrait, re-encoded to WebP at 400 and 800 px, and stripped of metadata. Remove photo brings back the
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
  - at most 3 comments per 10 minutes and 20 per day per IP, counted in the database so restarts don't reset them
  - duplicate text for the same candidate is rejected
  - HTML, more than two links, and control or bidi-override characters are rejected or stripped
  - length limits on name and comment
- Comments are rendered as plain text, so there is no HTML injection path.

**Admin security:**
- Passwords are hashed with scrypt (N=2¹⁷).
- Sessions use random tokens; only their SHA-256 is stored. Cookies are httpOnly, SameSite=Lax and Secure, with a
  12-hour lifetime. Changing your password signs out your other sessions.
- Login is rate-limited (5 attempts per email and 10 per IP every 15 minutes), and wrong passwords take as long to
  reject as unknown emails.
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

**Known limitations:**
- Rate limiting for logins is in-memory, so it assumes one server process (comment limits are in the database).
- No email notifications for new comments.
- New admin accounts are created from the command line, not the dashboard.
