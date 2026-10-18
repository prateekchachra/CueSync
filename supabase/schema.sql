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

-- ════════════════════════════════════════════════════════════════════
-- v2: roles, song cards / player fields, sync rights, briefs, submissions
-- Safe to re-run: everything below is idempotent.
-- ════════════════════════════════════════════════════════════════════

-- Roles ---------------------------------------------------------------
alter table public.profiles add column if not exists role text not null default 'musician';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('musician', 'supervisor'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, artist_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'artist_name', ''), split_part(new.email, '@', 1)),
    new.email,
    case when new.raw_user_meta_data->>'role' = 'supervisor' then 'supervisor' else 'musician' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- A user can't flip their own role after sign-up.
create or replace function public.lock_profile_role()
returns trigger
language plpgsql
as $$
begin
  new.role = old.role;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
before update on public.profiles
for each row execute procedure public.lock_profile_role();

create or replace function public.is_supervisor(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'supervisor');
$$;

-- Song cards, links, player, sync rights -----------------------------
alter table public.songs add column if not exists song_type text not null default 'release';
alter table public.songs drop constraint if exists songs_song_type_check;
alter table public.songs add constraint songs_song_type_check
  check (song_type in ('release', 'lyric_draft', 'songwriting_draft'));

alter table public.songs add column if not exists description text;
alter table public.songs add column if not exists lyrics text;
alter table public.songs add column if not exists poster_url text;
alter table public.songs add column if not exists audio_url text;
alter table public.songs add column if not exists disco_url text;
alter table public.songs add column if not exists spotify_url text;
alter table public.songs add column if not exists apple_music_url text;
alter table public.songs add column if not exists soundcloud_url text;

alter table public.songs add column if not exists open_to_sync boolean not null default false;
alter table public.songs add column if not exists has_lyrics boolean not null default true;
alter table public.songs add column if not exists stems_available boolean not null default false;
alter table public.songs add column if not exists one_stop boolean not null default false;
alter table public.songs add column if not exists territories text[] not null default '{worldwide}';
alter table public.songs add column if not exists exclusivity text not null default 'unknown';
alter table public.songs add column if not exists provenance text not null default 'unknown';
alter table public.songs add column if not exists price_min_eur integer;
alter table public.songs add column if not exists price_max_eur integer;
alter table public.songs add column if not exists master_owners jsonb not null default '[]'::jsonb;
alter table public.songs add column if not exists publishing_owners jsonb not null default '[]'::jsonb;

alter table public.songs drop constraint if exists songs_exclusivity_check;
alter table public.songs add constraint songs_exclusivity_check
  check (exclusivity in ('non_exclusive', 'exclusive', 'unknown'));
alter table public.songs drop constraint if exists songs_provenance_check;
alter table public.songs add constraint songs_provenance_check
  check (provenance in ('human', 'ai_assisted', 'unknown'));

-- Briefs ---------------------------------------------------------------
create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  project_type text,
  description text not null,
  moods text[] not null default '{}',
  genres text[] not null default '{}',
  vocals text not null default 'any' check (vocals in ('any', 'instrumental', 'vocals')),
  bpm_min integer,
  bpm_max integer,
  budget_eur integer,
  territory text,
  deadline date,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists briefs_supervisor_idx on public.briefs (supervisor_id);

-- Silent, anonymous blocks: the musician is never told, the supervisor never sees who.
create table if not exists public.supervisor_blocks (
  supervisor_id uuid not null references public.profiles(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supervisor_id, artist_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  artist_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (brief_id, song_id)
);

create index if not exists submissions_brief_idx on public.submissions (brief_id);
create index if not exists submissions_artist_idx on public.submissions (artist_id);

create or replace function public.is_blocked(p_supervisor uuid, p_artist uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supervisor_blocks b
    where b.supervisor_id = p_supervisor and b.artist_id = p_artist
  );
$$;

alter table public.briefs enable row level security;
alter table public.supervisor_blocks enable row level security; -- no policies: only RPCs touch it
alter table public.submissions enable row level security;

drop policy if exists "briefs_select" on public.briefs;
create policy "briefs_select" on public.briefs
for select to authenticated using (
  supervisor_id = auth.uid()
  or (status = 'open' and not public.is_blocked(supervisor_id, auth.uid()))
);

drop policy if exists "briefs_insert_supervisor" on public.briefs;
create policy "briefs_insert_supervisor" on public.briefs
for insert to authenticated with check (
  supervisor_id = auth.uid() and public.is_supervisor(auth.uid())
);

drop policy if exists "briefs_update_own" on public.briefs;
create policy "briefs_update_own" on public.briefs
for update to authenticated using (supervisor_id = auth.uid());

drop policy if exists "briefs_delete_own" on public.briefs;
create policy "briefs_delete_own" on public.briefs
for delete to authenticated using (supervisor_id = auth.uid());

-- Musicians see and manage only their own submissions. Supervisors go through the RPCs below,
-- which never return artist_id.
drop policy if exists "submissions_select_own" on public.submissions;
create policy "submissions_select_own" on public.submissions
for select to authenticated using (artist_id = auth.uid());

drop policy if exists "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own" on public.submissions
for insert to authenticated with check (
  artist_id = auth.uid()
  and status = 'pending'
  and exists (select 1 from public.songs s where s.id = song_id and s.user_id = auth.uid())
  and exists (
    select 1 from public.briefs b
    where b.id = brief_id and b.status = 'open' and not public.is_blocked(b.supervisor_id, auth.uid())
  )
);

drop policy if exists "submissions_delete_own_pending" on public.submissions;
create policy "submissions_delete_own_pending" on public.submissions
for delete to authenticated using (artist_id = auth.uid() and status = 'pending');

-- Supervisor RPCs ------------------------------------------------------
create or replace function public.my_brief_stats()
returns table (brief_id uuid, total integer, pending integer, accepted integer, declined integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         count(s.id)::int,
         count(s.id) filter (where s.status = 'pending')::int,
         count(s.id) filter (where s.status = 'accepted')::int,
         count(s.id) filter (where s.status = 'declined')::int
  from public.briefs b
  left join public.submissions s on s.brief_id = b.id
  where b.supervisor_id = auth.uid()
  group by b.id;
$$;

create or replace function public.brief_submissions(p_brief_id uuid)
returns table (
  submission_id uuid,
  status text,
  note text,
  created_at timestamptz,
  artist_alias text,
  artist_blocked boolean,
  song_id uuid,
  title text,
  song_type text,
  description text,
  genre text,
  bpm integer,
  musical_key text,
  duration_seconds integer,
  has_lyrics boolean,
  poster_url text,
  audio_url text,
  disco_url text,
  spotify_url text,
  apple_music_url text,
  soundcloud_url text,
  moods text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.status, s.note, s.created_at,
         'Artist ' || upper(substr(md5(s.artist_id::text || b.supervisor_id::text), 1, 4)),
         public.is_blocked(b.supervisor_id, s.artist_id),
         so.id, so.title, so.song_type, so.description, so.genre, so.bpm, so.musical_key,
         so.duration_seconds, so.has_lyrics, so.poster_url, so.audio_url, so.disco_url,
         so.spotify_url, so.apple_music_url, so.soundcloud_url,
         coalesce(array(
           select m.name from public.song_moods sm join public.moods m on m.id = sm.mood_id
           where sm.song_id = so.id order by m.name
         ), '{}')
  from public.submissions s
  join public.briefs b on b.id = s.brief_id
  join public.songs so on so.id = s.song_id
  where s.brief_id = p_brief_id and b.supervisor_id = auth.uid()
  order by (s.status = 'pending') desc, s.created_at desc;
$$;

-- p_decision: 'accepted' | 'declined' | 'block'
-- 'block' declines this and every other pending submission from the same musician to this
-- supervisor, and hides this supervisor's briefs from them from now on. Nobody is notified.
create or replace function public.review_submission(p_submission_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist uuid;
  v_supervisor uuid;
begin
  select s.artist_id, b.supervisor_id into v_artist, v_supervisor
  from public.submissions s join public.briefs b on b.id = s.brief_id
  where s.id = p_submission_id;

  if v_supervisor is null or v_supervisor <> auth.uid() then
    raise exception 'Submission not found';
  end if;

  if p_decision in ('accepted', 'declined') then
    update public.submissions set status = p_decision, reviewed_at = now() where id = p_submission_id;
  elsif p_decision = 'block' then
    insert into public.supervisor_blocks (supervisor_id, artist_id)
    values (v_supervisor, v_artist) on conflict do nothing;
    update public.submissions s set status = 'declined', reviewed_at = now()
    from public.briefs b
    where b.id = s.brief_id and b.supervisor_id = v_supervisor and s.artist_id = v_artist
      and (s.status = 'pending' or s.id = p_submission_id);
  else
    raise exception 'Unknown decision %', p_decision;
  end if;
end;
$$;

create or replace function public.my_blocked_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.supervisor_blocks where supervisor_id = auth.uid();
$$;

create or replace function public.clear_my_blocks()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.supervisor_blocks where supervisor_id = auth.uid();
$$;

revoke all on function public.my_brief_stats() from public, anon;
revoke all on function public.brief_submissions(uuid) from public, anon;
revoke all on function public.review_submission(uuid, text) from public, anon;
revoke all on function public.my_blocked_count() from public, anon;
revoke all on function public.clear_my_blocks() from public, anon;
grant execute on function public.my_brief_stats() to authenticated;
grant execute on function public.brief_submissions(uuid) to authenticated;
grant execute on function public.review_submission(uuid, text) to authenticated;
grant execute on function public.my_blocked_count() to authenticated;
grant execute on function public.clear_my_blocks() to authenticated;

-- Storage: posters and audio previews (public read, owner-only write) --
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true), ('audio', 'audio', true)
on conflict (id) do nothing;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
for select using (bucket_id in ('posters', 'audio'));

drop policy if exists "media_owner_insert" on storage.objects;
create policy "media_owner_insert" on storage.objects
for insert to authenticated with check (
  bucket_id in ('posters', 'audio') and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media_owner_update" on storage.objects;
create policy "media_owner_update" on storage.objects
for update to authenticated using (
  bucket_id in ('posters', 'audio') and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "media_owner_delete" on storage.objects;
create policy "media_owner_delete" on storage.objects
for delete to authenticated using (
  bucket_id in ('posters', 'audio') and (storage.foldername(name))[1] = auth.uid()::text
);
