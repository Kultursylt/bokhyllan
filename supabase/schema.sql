-- =====================================================================
-- Bokhyllan – komplett databasschema
--
-- Körs EN gång i Supabase: SQL Editor -> New query -> klistra in -> Run.
-- Skriptet går att köra om (idempotent) om något avbryts halvvägs.
--
-- Modellen skiljer på tre saker som den gamla appen blandade ihop:
--   works     = själva boken/upplagan (titel, författare, ISBN, Libris-id)
--   copies    = ett fysiskt exemplar du äger (två exemplar = två rader)
--   locations = var exemplaret står: rum > bokhylla > hyllplan
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Bibliotek (ett per hushåll) och medlemmar
-- ---------------------------------------------------------------------
create table if not exists public.libraries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mitt bibliotek',
  join_code   text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at  timestamptz not null default now()
);

create table if not exists public.library_members (
  library_id  uuid not null references public.libraries(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (library_id, user_id)
);

-- Är den inloggade medlem i biblioteket? SECURITY DEFINER så att
-- policyn på library_members inte rekurserar in i sig själv.
create or replace function public.is_member(lib uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.library_members
    where library_id = lib and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Platser: rum > bokhylla > hyllplan (godtyckligt djup via parent_id)
-- ---------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries(id) on delete cascade,
  parent_id   uuid references public.locations(id) on delete cascade,
  name        text not null,
  kind        text not null default 'shelf' check (kind in ('room', 'bookcase', 'shelf', 'spot')),
  position    int  not null default 0,      -- ordning bland syskon; hyllplan räknas uppifrån
  capacity    int,                          -- ungefär hur många böcker som får plats
  created_at  timestamptz not null default now()
);
create index if not exists locations_library_idx on public.locations(library_id, parent_id, position);

-- ---------------------------------------------------------------------
-- Verk: den bibliografiska posten, helst verifierad mot Libris
-- ---------------------------------------------------------------------
create table if not exists public.works (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references public.libraries(id) on delete cascade,
  title        text not null,
  authors      text[] not null default '{}',
  year         int,
  publisher    text,
  language     text,
  isbn         text,                         -- ISBN-13 utan bindestreck
  libris_id    text,                         -- t.ex. "8234133"
  libris_url   text,
  category     text,                         -- egen hyllkategori, redigerbar
  description  text,                         -- bara från källa eller egen text, aldrig påhittad
  source       text not null default 'manual' check (source in ('libris', 'openlibrary', 'manual', 'ai')),
  verified     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists works_isbn_uq   on public.works(library_id, isbn)      where isbn is not null;
create unique index if not exists works_libris_uq on public.works(library_id, libris_id) where libris_id is not null;
create index if not exists works_library_idx on public.works(library_id);

-- ---------------------------------------------------------------------
-- Exemplar: det fysiska objektet och var det står
-- ---------------------------------------------------------------------
create table if not exists public.copies (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references public.libraries(id) on delete cascade,
  work_id      uuid not null references public.works(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete set null,
  position     int,                          -- ordning på hyllplanet, vänster->höger
  status       text not null default 'shelf' check (status in ('shelf', 'lent', 'away', 'sold', 'gone')),
  lent_to      text,
  note         text,
  seen_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists copies_library_idx  on public.copies(library_id);
create index if not exists copies_location_idx on public.copies(location_id);
create index if not exists copies_work_idx     on public.copies(work_id);

-- ---------------------------------------------------------------------
-- Skanningar: ett foto av ett hyllplan och resultatet av avläsningen
-- ---------------------------------------------------------------------
create table if not exists public.scans (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references public.libraries(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete set null,
  photo_path   text not null,               -- sökväg i lagringen "photos"
  state        text not null default 'uploaded' check (state in ('uploaded', 'analyzing', 'review', 'done', 'error')),
  result       jsonb,
  error        text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists scans_library_idx on public.scans(library_id, created_at desc);

-- ---------------------------------------------------------------------
-- Värderingar: begagnatpris uppskattat med webbsökning, med källor
-- ---------------------------------------------------------------------
create table if not exists public.valuations (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references public.libraries(id) on delete cascade,
  work_id      uuid not null references public.works(id) on delete cascade,
  low          int,
  high         int,
  currency     text not null default 'SEK',
  best_channel text,
  confidence   text check (confidence in ('låg', 'medel', 'hög')),
  summary      text,
  sources      jsonb not null default '[]',
  created_at   timestamptz not null default now()
);
create index if not exists valuations_work_idx on public.valuations(work_id, created_at desc);

-- ---------------------------------------------------------------------
-- Uppdaterad-tid på verk
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists works_touch on public.works;
create trigger works_touch before update on public.works
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Nytt konto => eget bibliotek, eller gå med i ett befintligt via kod.
-- Appen skickar { join_code } i signUp-metadata när någon bjudits in.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'join_code', '')));
  lib  uuid;
begin
  if code <> '' then
    select id into lib from public.libraries where join_code = code;
  end if;

  if lib is not null then
    insert into public.library_members (library_id, user_id, role) values (lib, new.id, 'member');
  else
    insert into public.libraries (name) values ('Mitt bibliotek') returning id into lib;
    insert into public.library_members (library_id, user_id, role) values (lib, new.id, 'owner');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Gå med i ett annat bibliotek i efterhand (t.ex. om man redan hade konto).
create or replace function public.join_library(code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare lib uuid;
begin
  if auth.uid() is null then raise exception 'Inte inloggad'; end if;
  select id into lib from public.libraries where join_code = upper(trim(code));
  if lib is null then raise exception 'Okänd kod'; end if;
  insert into public.library_members (library_id, user_id, role)
    values (lib, auth.uid(), 'member') on conflict do nothing;
  return lib;
end $$;

-- Ny inbjudningskod (bara ägaren), om den gamla läckt.
create or replace function public.rotate_join_code(lib uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare c text := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
begin
  if not exists (select 1 from public.library_members
                 where library_id = lib and user_id = auth.uid() and role = 'owner') then
    raise exception 'Bara ägaren kan byta kod';
  end if;
  update public.libraries set join_code = c where id = lib;
  return c;
end $$;

-- ---------------------------------------------------------------------
-- Radnivåsäkerhet: allt kräver medlemskap i biblioteket
-- ---------------------------------------------------------------------
alter table public.libraries       enable row level security;
alter table public.library_members enable row level security;
alter table public.locations       enable row level security;
alter table public.works           enable row level security;
alter table public.copies          enable row level security;
alter table public.scans           enable row level security;
alter table public.valuations      enable row level security;

drop policy if exists "libraries read"   on public.libraries;
drop policy if exists "libraries update" on public.libraries;
create policy "libraries read"   on public.libraries for select using (public.is_member(id));
create policy "libraries update" on public.libraries for update using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members read"  on public.library_members;
drop policy if exists "members leave" on public.library_members;
create policy "members read"  on public.library_members for select using (public.is_member(library_id));
create policy "members leave" on public.library_members for delete using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['locations', 'works', 'copies', 'scans', 'valuations'] loop
    execute format('drop policy if exists "%1$s member access" on public.%1$I', t);
    execute format(
      'create policy "%1$s member access" on public.%1$I for all
         using (public.is_member(library_id)) with check (public.is_member(library_id))', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.join_library(text)     to authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;
grant execute on function public.is_member(uuid)        to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- Bildlagring: privat bucket, en mapp per bibliotek  "<library_id>/..."
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do update set public = false;

drop policy if exists "photos member read"   on storage.objects;
drop policy if exists "photos member write"  on storage.objects;
drop policy if exists "photos member delete" on storage.objects;

create policy "photos member read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and exists (
    select 1 from public.library_members m
    where m.user_id = auth.uid() and m.library_id::text = (storage.foldername(name))[1]));

create policy "photos member write" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and exists (
    select 1 from public.library_members m
    where m.user_id = auth.uid() and m.library_id::text = (storage.foldername(name))[1]));

create policy "photos member delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and exists (
    select 1 from public.library_members m
    where m.user_id = auth.uid() and m.library_id::text = (storage.foldername(name))[1]));
