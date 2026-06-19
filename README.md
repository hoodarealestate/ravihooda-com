# The Hooda Team — ravihooda.com
## Handoff README for Claude Code

**Read this entire file before changing anything.** This project has been through ~20 rapid-fire fix/push cycles from a chat-based assistant (no terminal/runtime access) trying to debug a live-data rendering issue blind, off static code review and user-supplied screenshots. That loop failed. You have terminal access, a real dev server, and real browser devtools — use them. Don't repeat the pattern of pushing speculative fixes to production without first reproducing the bug locally.

---

## 0. Immediate priority

**The live MLS listings are not displaying on the deployed site (ravihooda.com), despite the underlying API confirmed to return correct data via direct browser testing of `/api/listings`.** The most recent commits cleaned up real bugs (escaped template-literal characters, duplicate variable declarations, missing function params) and current static validation of `public/ravihooda.html` is clean (see §6 below) — but the user reports it's still not rendering. This means the remaining issue is very likely:

- A runtime/browser issue not visible from static code review (do `next dev`, open real devtools, watch Console + Network tabs)
- A Vercel deployment/caching issue (stale build, env vars not actually applied, etc.)
- Something in how the static `public/ravihooda.html` file interacts with Next.js routing that differs from local dev (test in production mode: `next build && next start`, not just `next dev`)

**Your first move should be:** clone the repo, `npm install`, `npm run dev`, open `http://localhost:3000/ravihooda.html` in a real browser, open DevTools Console + Network tabs, and watch what actually happens when the page tries to load listings. That single step will tell you more in two minutes than the last 20 commits combined.

---

## 1. What this project is

A real estate website for **Ravi Hooda** and **Rashmi Hooda** ("The Hooda Team"), brokers at **Century 21 Red Star Realty Inc.**, serving the Greater Toronto Area (GTA). Domain: **ravihooda.com** (live, DNS pointed at Vercel via GoDaddy).

The site pulls **live MLS® data** from **PropTx** (the TRREB/Toronto Regional Real Estate Board's official data platform) via their OData API, under an active, paid IDX/VOW/DLA data license agreement. This is a real compliance-sensitive integration — see §2 before touching anything related to data sourcing.

---

## 2. CRITICAL — PropTx compliance constraints

The site operates under a real **PropTx IDX/VOW/DLA Data Agreement**. These are not suggestions — violating them risks the client's data license being revoked. Before changing anything related to listings:

- **Approved domains only:** Listings may ONLY be displayed on `ravihooda.com` and `aria.ravihooda.com` (per the signed agreement, Schedule B). Never display PropTx-sourced data on any other domain (e.g. the old `ravihooda-com.vercel.app` preview URL, GitHub Pages, etc.) — that preview URL currently exists as an artifact of Vercel's default behavior and should ideally be restricted once things are stable, not used as a testing ground for live data.
- **Tokens stay server-side only.** Never expose `PROPTX_IDX_TOKEN`, `PROPTX_VOW_TOKEN`, or `PROPTX_DLA_TOKEN` to client-side/browser code. All PropTx calls must go through Next.js API routes (`src/app/api/*/route.ts`), never directly from `public/ravihooda.html`'s inline `<script>` blocks.
- **Active listings (IDX token)** are public-facing — anyone can see them.
- **Sold data (VOW token)** requires the visitor to have registered (see the VOW gate in `ravihooda.html` / `/api/sold`). Never show sold prices/history to unregistered visitors.
- **100-listing cap** per query (already implemented via `$top=100` in the OData queries — do not remove).
- **Required disclaimers** must stay on the page: PropTx "deemed reliable but not guaranteed accurate" disclaimer, listing brokerage name displayed per-listing, "bona fide interest" notice. These exist in `ravihooda.html` already — don't strip them out while refactoring.
- **No scraping.** Earlier in this project there was a parallel effort (`gtapowersales` repo on GitHub Pages) that scraped TRREB share-link HTML via GitHub Actions. **That approach was abandoned for compliance reasons** and replaced with the in-site "Power of Sale" section (§5) which filters the *existing compliant IDX feed* by remarks keywords instead. Do not resurrect the scraper approach. If you see references to `gtapowersales` or `hoodarealestate.github.io`, that's legacy/dead — the working version is the `/api/power-of-sale` route in this repo.

---

## 3. Tech stack & architecture

- **Framework:** Next.js 14.2.3, App Router, TypeScript (but `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` are set in `next.config.js` — this was done out of deployment desperation, not best practice; consider turning these back on once things are stable so real errors surface at build time instead of silently shipping).
- **Hosting:** Vercel, project name `ravihooda-com`, connected to GitHub repo `hoodarealestate/ravihooda-com` (private), auto-deploys on push to `main`.
- **Domain:** `ravihooda.com` via GoDaddy DNS → Vercel (A record `@` → `216.198.79.1`, CNAME `www` → `cns.vercel-dns.com`). DNS is confirmed propagated and Vercel shows "Valid Configuration" for the custom domain as of the last screenshot in this project's history.
- **MLS data:** PropTx OData API at `https://query.ampre.ca/odata/`. Three tokens (IDX/VOW/DLA), currently hardcoded as fallback values directly in the API route files (see §2 — this should be cleaned up to rely purely on env vars once stable, hardcoded tokens in source are a liability long-term even though they're server-side-only).
- **Email:** Resend.com (`RESEND_API_KEY`), used for contact form notifications, VOW welcome emails, and CRM bulk campaigns.
- **Maps:** Google Maps JavaScript API (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`) for the Map Search section.
- **Auth:** `jose` library for JWT signing — VOW visitor sessions (`vow_token` cookie) and CRM admin sessions (`crm_token` cookie).
- **The actual website is one giant static HTML file**: `public/ravihooda.html` (~2,630 lines, ~650KB). This is NOT idiomatic Next.js — it's a single self-contained HTML/CSS/JS file (originally built as a standalone prototype, then dropped into `/public/` and wired to Next.js API routes for the backend pieces). `src/app/page.tsx` just does `redirect('/ravihooda.html')` at the root. This architecture is unusual and is itself a likely contributor to the routing/rendering confusion — see §7 for a recommendation.
- **CRM dashboard:** A second standalone HTML file, `public/hooda-crm.html`, with hardcoded demo login (`admin@ravihooda.com` / `hooda2024` — **change before real use**). Uses `localStorage` for data persistence (not a real database — contacts/campaigns are NOT shared between browsers/devices, this is prototype-grade only).

---

## 4. File structure

```
hooda-nextjs/
├── README.md                          ← you are here
├── package.json                       ← Next.js 14.2.3, react 18, resend, jose
├── next.config.js                     ← ignoreBuildErrors/ignoreDuringBuilds set true (see §3)
├── tsconfig.json                      ← path alias @/* → ./src/* (NOTE: not currently used —
│                                          earlier @/lib/* imports caused build failures and
│                                          were replaced with fully inlined code in each route,
│                                          see git history commit "inline all API routes")
├── vercel.json                        ← minimal, just framework + build/install commands
├── .env.local                         ← REAL SECRETS, gitignored, see §8
├── .env.example                       ← template, safe to commit
├── public/
│   ├── ravihooda.html                 ← THE WEBSITE. ~2630 lines. Everything is in here:
│   │                                     hero, listings grid, map search, power of sale,
│   │                                     VOW gate, mortgage calc, contact form, all CSS,
│   │                                     all inline <script> JS. See §6 for known-good state.
│   └── hooda-crm.html                 ← separate CRM prototype, localStorage-based, not
│                                          linked to production data, demo login only
└── src/
    └── app/
        ├── layout.tsx                 ← minimal root layout, just metadata
        ├── page.tsx                   ← redirect('/ravihooda.html'), nothing else.
        │                                  (A previous bad commit appended invalid raw JSX
        │                                   after this redirect — already fixed, but if you
        │                                   see build errors mentioning page.tsx, check this
        │                                   file is exactly 5 lines, no extra markup.)
        └── api/
            ├── listings/route.ts      ← Active listings (IDX token). GET, query params:
            │                             city, type, maxPrice, minPrice, beds
            ├── sold/route.ts          ← Sold listings (VOW token). Requires vow_token cookie.
            ├── power-of-sale/route.ts ← Active listings filtered by PublicRemarks keywords
            │                             ("power of sale", "court order", "estate sale", etc).
            │                             Query params: city, minPrice, maxPrice.
            │                             Strips PublicRemarks from response before sending
            │                             to client (only structured fields returned).
            ├── vow/route.ts           ← VOW registration: signs JWT, sets cookie, sends
            │                             welcome email + office notification via Resend
            ├── contact/route.ts       ← Contact form handler, sends via Resend
            ├── email/route.ts         ← Bulk CRM email campaigns via Resend (batch send)
            └── admin/route.ts         ← CRM login, signs crm_token JWT cookie
```

There is also a stray empty artifact directory `{src/{app/...` at the project root from an old shell command typo — it's untracked (not in git), harmless, but delete it if it bothers you (`rm -rf "{src"`).

---

## 5. Feature inventory (what's supposed to work)

All of this lives inside `public/ravihooda.html` unless noted:

1. **Hero section** — Ken Burns slideshow (6 Unsplash images), two broker portrait photos (base64-embedded JPEGs, Ravi + Rashmi) with rotating gold ring CSS animation, search bar.
2. **Active listings grid** (`#listings`) — calls `/api/listings`, renders cards with price/address/beds/baths/sqft/broker name. Filter buttons (All/Detached/Condo/Townhouse/Commercial).
3. **Map Search** (`#mapsearch`) — Google Maps with custom price-label pins, sidebar list, filters (city/type/min/max price/beds), calls `/api/listings` with `&top=100`.
4. **Power of Sale** (`#powerofsale`) — NEWEST feature. Email/name/phone gate (localStorage-based, mirrors VOW pattern) → unlocks a filtered grid calling `/api/power-of-sale`, with its own city/min/max price filter bar. See §2 for why this replaced the scraper approach.
5. **VOW (Virtual Office Website) gate** — modal for visitor registration/login, unlocks `/api/sold` access, sets `vow_token` cookie (1 year expiry), stores lead in `localStorage` + attempts CRM capture via `crmAddContact()`.
6. **Mortgage calculator** — pure client-side math, no API calls.
7. **Contact form** — posts to `/api/contact`.
8. **Team section** — Ravi & Rashmi bios, credentials (LUXE, ACP, B.Com, MBA, BSc, FDIT, BCA), languages (English, Hindi, Punjabi, Haryanvi).
9. **CRM** (`public/hooda-crm.html`, separate page) — contact list, CSV import, email campaign composer with 5 templates, campaign history. All `localStorage`-backed, demo login `admin@ravihooda.com` / `hooda2024`.

---

## 6. Known-good state as of last commit (`2dfcf27`)

I ran static validation before writing this handoff. As of the latest commit on `main`:

```bash
# Both inline <script> blocks in ravihooda.html pass Node syntax check:
node --check <extracted script 0>   → valid
node --check <extracted script 1>   → valid

# Zero occurrences of the bug patterns that caused repeated silent failures earlier
# in this project (escaped backticks, escaped ${} template interpolation, escaped
# \uXXXX unicode sequences that were printing as literal backslash-text instead of
# actual characters):
'\${'   → 0
'\`'    → 0
'\u20'  → 0
'\u00'  → 0

# Tag balance:
<section> / </section>  → 8 / 8
<div> / </div>          → 243 / 243
<script> / </script>    → 3 / 3   (2 inline + 1 external Google Maps <script src=...>)
```

**If you find the page still broken, the bug is NOT a repeat of these specific patterns** — it's something else. Don't waste time re-grepping for backticks; go look at runtime behavior instead (§0).

A confirmed-working direct test: fetching `https://ravihooda.com/api/listings` directly in a browser **does return valid JSON with real PropTx listing data** (confirmed via user screenshot earlier in this project — real Toronto/Mississauga/Vaughan/etc. addresses and prices came back correctly). So the API layer works. The breakage is somewhere in how `ravihooda.html`'s client-side JS consumes that response, or in something environment-specific to the production deployment that doesn't show up in static review.

---

## 7. Recommended approach for Claude Code

1. **Reproduce locally first.** `npm install`, `cp .env.example .env.local` (then fill in real values — ask the user for the PropTx tokens, Resend key, and Google Maps key if not already in your context; do NOT invent placeholder tokens and assume they'll work), `npm run dev`, open `localhost:3000/ravihooda.html` in Chrome, open DevTools.
2. **Watch Network tab** for the `/api/listings` request specifically. Check: does it fire at all? What status code? What response body? Same for `/api/power-of-sale` and `/api/sold`.
3. **Watch Console tab** for any JS errors — especially anything that fires *before* the fetch call would even run, since a single uncaught synchronous error earlier in a `<script>` block can silently prevent later code (like the DOMContentLoaded listener that triggers the initial listings fetch) from ever executing.
4. **Test production build locally** too, not just dev mode: `npm run build && npm run start`. Next.js dev and production builds can behave differently, especially around static file serving from `/public/` and how relative API calls resolve.
5. **Compare against the actual live deployment** at `ravihooda.com` once you have a hypothesis — don't just trust local repro, confirm the same issue exists in production before fixing, and confirm the fix actually resolves it in production after deploying (Vercel auto-deploys on push to `main`, takes ~30-60 seconds).
6. **Strongly consider migrating `ravihooda.html` into real Next.js pages/components** rather than continuing to patch a giant static HTML file with regex/string-replacement edits. The current architecture (single 650KB static file with inline scripts, edited via blind string substitution) is fragile and was the direct cause of multiple silent corruption bugs (escaped characters, duplicate declarations) introduced during automated edits. A proper React component breakdown would let TypeScript/the build process actually catch these classes of errors instead of them shipping silently. This is a bigger refactor, but worth raising with the user as an option if the current file keeps being fragile.
7. **Re-enable `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`** (currently both `true` in `next.config.js`) once the codebase is in a stable state, so future regressions get caught at build time instead of shipping to production silently.

---

## 8. Environment variables needed

See `.env.example` for the full list. Required for local dev:

```
PROPTX_IDX_TOKEN          ← PropTx bearer token, Active listings (IDX agreement)
PROPTX_VOW_TOKEN          ← PropTx bearer token, Sold listings (VOW agreement)
PROPTX_DLA_TOKEN          ← PropTx bearer token, Data License Agreement (not currently used
                              by any route, reserved for future use)
PROPTX_ENDPOINT           ← https://query.ampre.ca/odata/
RESEND_API_KEY            ← Resend.com API key for email sending
RESEND_FROM_EMAIL         ← currently onboarding@resend.dev (Resend's default sandbox
                              sender — should be replaced with a verified @ravihooda.com
                              address once domain is verified in Resend)
RESEND_FROM_NAME          ← "The Hooda Team"
NEXT_PUBLIC_GOOGLE_MAPS_KEY ← Google Maps JS API key (should have HTTP referrer restriction
                                set to ravihooda.com/* in Google Cloud Console — check this
                                has actually been done, it was flagged as a to-do earlier)
CRM_ADMIN_EMAIL           ← admin@ravihooda.com
CRM_ADMIN_PASSWORD        ← currently "hooda2024" — CHANGE THIS, it's a real credential
                              sitting in plaintext in committed env files
CRM_JWT_SECRET            ← random secret for signing CRM session JWTs
VOW_JWT_SECRET            ← random secret for signing VOW session JWTs (must differ from
                              CRM_JWT_SECRET)
NEXT_PUBLIC_SITE_URL      ← https://ravihooda.com
```

**Security note:** the PropTx tokens, Resend key, and Google Maps key have all been shared in plaintext across this project's chat history and are also hardcoded as fallback values directly inside the API route `.ts` files (not just env vars). Given that exposure, regenerating all of these credentials (new PropTx tokens via the PropTx vendor portal at `syndication.ampre.ca` → Tokens, new Resend key, new Google Maps key with proper referrer restrictions) is a reasonable precaution once the site is stable, even though the tokens themselves never reached client-side/browser code.

---

## 9. Contacts & resources

- **PropTx vendor portal:** syndication.ampre.ca (sign in as Vendor, not Member, to see Tokens/Feeds/Web API tabs)
- **PropTx support:** dataagreements@proptx.ca
- **Vercel project:** `ravihooda-com`, project ID `prj_yN2gJ5ss93B86Kgzp4gjnHss3HQk`
- **GitHub repo:** `hoodarealestate/ravihooda-com` (private)
- **Domain registrar:** GoDaddy
- **Business contact:** hoodarealestate@gmail.com, Ravi 416-825-5032, Rashmi 647-766-5040
