# ✦ Book Finder

Cozy library-themed book search site.
- Books: Google Books API
- Popular shelf: New York Times Best Sellers (updates weekly)
- Database + accounts: Supabase

## Run in VS Code
Open this folder → install the **Live Server** extension → right-click `index.html` → **Open with Live Server**.

## Database (Supabase) — one-time setup
1. In your Supabase project: **SQL Editor → New query** → paste `supabase-schema.sql` → **Run**.
2. **Authentication → Providers → Email**: turn off **Confirm email** if you want instant sign-in while testing.
3. After deploying: **Authentication → URL Configuration** → set **Site URL** to your live address.

## Put it online
Go to https://app.netlify.com/drop and drag this whole folder onto the page.

## Protect your Google key
Google Cloud Console → APIs & Services → Credentials → your key →
- Application restrictions: **Websites** → add your Netlify URL (`https://YOUR-SITE.netlify.app/*`) and `http://127.0.0.1:5500/*`
- API restrictions: **Books API** only
