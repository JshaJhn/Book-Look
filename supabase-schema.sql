-- Book Finder database schema for Supabase
-- Run this once in Supabase → SQL Editor → New query → Run.

-- ---------- Favorites ----------
create table if not exists public.favorites (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    book_key    text not null,                 -- Open Library work key, e.g. /works/OL45804W
    status      text not null default 'Want to Read',
    category    text,                          -- null = uncategorized
    data        jsonb not null default '{}',   -- title, authors, cover id, year, etc.
    created_at  timestamptz not null default now(),
    unique (user_id, book_key)
);

-- ---------- Categories ----------
create table if not exists public.categories (
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name        text not null,
    created_at  timestamptz not null default now(),
    primary key (user_id, name)
);

-- ---------- Security: each user can only see and change their own rows ----------
alter table public.favorites  enable row level security;
alter table public.categories enable row level security;

drop policy if exists "Users manage their own favorites" on public.favorites;
create policy "Users manage their own favorites"
    on public.favorites for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users manage their own categories" on public.categories;
create policy "Users manage their own categories"
    on public.categories for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
