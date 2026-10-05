-- MySync catalog schema. Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  artist_name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.moods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  album text,
  isrc text,
  release_date date,
  duration_seconds integer,
  genre text,
  bpm integer,
  musical_key text,
  writers text,
  publishers text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.song_moods (
  song_id uuid not null references public.songs(id) on delete cascade,
  mood_id uuid not null references public.moods(id) on delete cascade,
  primary key (song_id, mood_id)
);

create table if not exists public.metadata_checks (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  status text not null check (status in ('passed', 'warnings', 'failed')),
  issues jsonb not null default '[]'::jsonb,
  saved_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists songs_user_id_idx on public.songs (user_id);
create index if not exists metadata_checks_song_id_idx on public.metadata_checks (song_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
before update on public.songs
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, artist_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'artist_name', ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.moods enable row level security;
alter table public.songs enable row level security;
alter table public.song_moods enable row level security;
alter table public.metadata_checks enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

drop policy if exists "moods_read_authenticated" on public.moods;
create policy "moods_read_authenticated" on public.moods
for select to authenticated using (true);

drop policy if exists "songs_own_select" on public.songs;
create policy "songs_own_select" on public.songs
for select using (auth.uid() = user_id);

drop policy if exists "songs_own_insert" on public.songs;
create policy "songs_own_insert" on public.songs
for insert with check (auth.uid() = user_id);

drop policy if exists "songs_own_update" on public.songs;
create policy "songs_own_update" on public.songs
for update using (auth.uid() = user_id);

drop policy if exists "songs_own_delete" on public.songs;
create policy "songs_own_delete" on public.songs
for delete using (auth.uid() = user_id);

drop policy if exists "song_moods_own_select" on public.song_moods;
create policy "song_moods_own_select" on public.song_moods
for select using (
  exists (select 1 from public.songs s where s.id = song_id and s.user_id = auth.uid())
);

drop policy if exists "song_moods_own_insert" on public.song_moods;
create policy "song_moods_own_insert" on public.song_moods
for insert with check (
  exists (select 1 from public.songs s where s.id = song_id and s.user_id = auth.uid())
);

drop policy if exists "song_moods_own_delete" on public.song_moods;
create policy "song_moods_own_delete" on public.song_moods
for delete using (
  exists (select 1 from public.songs s where s.id = song_id and s.user_id = auth.uid())
);

drop policy if exists "metadata_checks_own_select" on public.metadata_checks;
create policy "metadata_checks_own_select" on public.metadata_checks
for select using (
  exists (select 1 from public.songs s where s.id = song_id and s.user_id = auth.uid())
);

drop policy if exists "metadata_checks_own_insert" on public.metadata_checks;
create policy "metadata_checks_own_insert" on public.metadata_checks
for insert with check (
  exists (select 1 from public.songs s where s.id = song_id and s.user_id = auth.uid())
);

insert into public.moods (name) values
  ('Cinematic'),
  ('Dark'),
  ('Energetic'),
  ('Epic'),
  ('Hopeful'),
  ('Intimate'),
  ('Melancholic'),
  ('Nostalgic'),
  ('Playful'),
  ('Romantic'),
  ('Tense'),
  ('Uplifting')
on conflict (name) do nothing;
