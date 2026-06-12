# The Hooda Team — ravihooda.com
## Complete Deployment Guide

---

## What's in this project

| File/Folder | What it does |
|---|---|
| `src/app/api/listings/` | PropTx IDX API — active listings (server-side, token hidden) |
| `src/app/api/sold/` | PropTx VOW API — sold data for registered users |
| `src/app/api/vow/` | VOW registration — creates user, sends welcome email |
| `src/app/api/email/` | Bulk email campaigns via Resend |
| `src/app/api/contact/` | Contact form — emails Ravi & Rashmi + auto-reply |
| `src/app/api/admin/` | CRM admin login |
| `src/lib/proptx.ts` | PropTx OData queries (server-side only) |
| `src/lib/auth.ts` | JWT auth for VOW and CRM |
| `.env.local` | Your private credentials (never commit this) |

---

## Step 1 — Create GitHub repository

1. Go to [github.com](https://github.com) → Sign up or log in
2. Click **"New repository"**
3. Name it: `ravihooda-com`
4. Set to **Private**
5. Click **Create repository**

Then in your terminal (or ask your developer):
```bash
cd hooda-nextjs
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ravihooda-com.git
git push -u origin main
```

**IMPORTANT:** The `.gitignore` file excludes `.env.local` so your tokens are safe.

---

## Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **"Add New Project"**
3. Import your `ravihooda-com` repository
4. Click **"Deploy"** (Vercel auto-detects Next.js)

---

## Step 3 — Add Environment Variables in Vercel

In your Vercel project → **Settings → Environment Variables**, add these:

| Variable | Value |
|---|---|
| `PROPTX_IDX_TOKEN` | Your IDX token |
| `PROPTX_VOW_TOKEN` | Your VOW token |
| `PROPTX_DLA_TOKEN` | Your DLA token |
| `PROPTX_ENDPOINT` | `https://query.ampre.ca/odata/` |
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` (until domain verified) |
| `RESEND_FROM_NAME` | `The Hooda Team` |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Your Google Maps key |
| `CRM_ADMIN_EMAIL` | `admin@ravihooda.com` |
| `CRM_ADMIN_PASSWORD` | Choose a strong password |
| `CRM_JWT_SECRET` | Any long random string |
| `VOW_JWT_SECRET` | Any different long random string |
| `NEXT_PUBLIC_SITE_URL` | `https://ravihooda.com` |

---

## Step 4 — Connect ravihooda.com domain

In Vercel → **Settings → Domains**:
1. Click **Add Domain**
2. Type `ravihooda.com`
3. Vercel shows you DNS records to add
4. Log into your domain registrar and add those records
5. Wait 5-10 minutes → site is live

---

## Step 5 — Verify Resend email domain (optional but recommended)

To send emails from `@ravihooda.com` instead of the default:
1. Log into [resend.com](https://resend.com)
2. **Domains → Add Domain → ravihooda.com**
3. Add the DNS records Resend shows you
4. Update `RESEND_FROM_EMAIL` in Vercel to `ravi@ravihooda.com`

---

## API Endpoints

Once deployed, these are available:

- `GET /api/listings?city=Toronto&type=Detached&maxPrice=1000000` — Active listings
- `GET /api/sold?city=Vaughan` — Sold data (requires VOW cookie)
- `POST /api/vow` — VOW registration
- `POST /api/contact` — Contact form
- `POST /api/email` — Send campaign (requires CRM cookie)
- `POST /api/admin` — CRM login

---

## Security checklist before going live

- [ ] Change `CRM_ADMIN_PASSWORD` from `hooda2024` to something strong
- [ ] Set `CRM_JWT_SECRET` and `VOW_JWT_SECRET` to long random strings
- [ ] Restrict Google Maps API key to `ravihooda.com/*` in Google Cloud Console
- [ ] Consider regenerating PropTx tokens in the PropTx portal (they were shared in chat)
- [ ] Enable Vercel's built-in DDoS protection (on by default)
- [ ] Add `ravihooda.com` to Resend's allowed domains

---

## Support contacts

- **PropTx:** dataagreements@proptx.ca
- **Resend:** support@resend.com
- **Vercel:** vercel.com/support
- **Google Maps:** console.cloud.google.com

---

*Built for Ravi & Rashmi Hooda — The Hooda Team, Century 21 Red Star Realty Inc.*
