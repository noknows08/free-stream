# FreeReel 🎬

**Free, legal streaming of classic public-domain & Creative Commons films** — a small,
Netflix-inspired static site. Every title streams directly from the
[Internet Archive](https://archive.org). No paywalls, no tracking, no build step.

Browse curated rows, search instantly, watch full films in the browser, and
(optionally) create an account to save titles to a personal **My List**.

---

## ✨ Features

- **17 hand-picked classics** — silent comedy, film noir, sci-fi, adventure, animation and more.
- **Netflix-style browse page** — a rotating featured hero plus horizontally scrollable rows.
- **Real HTML5 player** (`watch.html?v=<id>`) with a "More Like This" row.
- **Instant search** across titles, genres, and years.
- **Works with zero backend.** The built-in catalog (`catalog.js`) means every film
  plays even if you never touch Supabase.
- **Optional accounts + watchlist** via Supabase (email/password), added progressively —
  nothing breaks when it's not configured.
- **Resilient posters** — if an image fails to load, the card gracefully falls back to a
  titled gradient tile, so nothing ever looks broken.
- Responsive, dark, accessible (focus-visible outlines, reduced-motion support).

---

## 🚀 Run it

It's a pure static site — no install, no bundler.

- **Just open it:** double-click `index.html`, **or**
- **Serve locally** (recommended, so ES modules load cleanly):

  ```bash
  # any static server works, e.g.
  npx serve .
  # or
  python -m http.server 8000
  ```

  Then visit `http://localhost:8000`.

Deploy by dropping the folder on any static host (Vercel, Netlify, GitHub Pages, …).
`vercel.json` enables clean URLs.

> **Out of the box, everything works** — browsing, search, and every player — using the
> static catalog. Supabase only *adds* accounts + a saved watchlist.

---

## 🔐 Optional: enable accounts + watchlist (Supabase)

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Run the schema.** In the dashboard open **SQL Editor**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates the
   `movies` and `watchlist` tables, enables Row Level Security with the right policies,
   and seeds all 17 films.
3. **Add your keys.** In **Project Settings → API**, copy the **Project URL** and the
   **anon public** key into `config.js`:

   ```js
   window.SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
   window.SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```

4. **(Optional) email confirmation.** By default Supabase may require email confirmation
   on sign-up. For a friction-free demo, go to **Authentication → Providers → Email** and
   turn *Confirm email* off, so new accounts can sign in immediately.
5. **Redeploy / reload.** A "Sign in" button appears in the nav; signed-in users get a
   **My List** they can add to from the hero and any watch page.

The `anon` key is safe to expose in client code — Row Level Security ensures each user can
only read and modify **their own** watchlist rows, while the movie catalog is public read-only.

---

## 🧱 Tech

- **Vanilla HTML, CSS, and JavaScript** — no framework, no build.
- **ES modules** for app logic (`app.js`, `watch.js`, `supabase-client.js`).
- **Supabase** (loaded lazily from CDN, only when configured) for auth + watchlist.
- **Google Fonts** — Poppins (headings/logo) + Inter (body).
- **Internet Archive** for video and poster hosting.

### Project structure

```
index.html          Browse / home
watch.html          Player page
styles.css          Theme + layout
catalog.js          Canonical movie data (window.CATALOG / ROWS / FEATURED_IDS)
config.js           Your Supabase URL + anon key (blank by default)
supabase-client.js  Data + auth layer (graceful fallbacks everywhere)
app.js              Home logic (hero, rows, search, auth, watchlist)
watch.js            Player logic (video, details, more-like-this, watchlist)
supabase/schema.sql Tables, RLS policies, and seed data
vercel.json         cleanUrls + trailingSlash config
```

---

## 📜 Content & licensing

All films in this catalog are in the **public domain** or distributed under a
**Creative Commons** license, and are streamed from the Internet Archive. *Sita Sings the
Blues*, for example, was released free by Nina Paley under Creative Commons.

FreeReel is a **demo project** and is not affiliated with, or endorsed by, any commercial
streaming service. The site code is provided as-is for learning and personal use. Please
verify the licensing of any film for your own jurisdiction and use case.
