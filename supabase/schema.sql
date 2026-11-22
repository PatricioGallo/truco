-- ============================================================
-- Truco: tablas en el mismo proyecto de Supabase que el Sudoku.
-- Usa la tabla `profiles` del Sudoku (mismas cuentas, nombre y foto).
-- Se puede correr más de una vez.
-- ============================================================

-- Amigos ------------------------------------------------------
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);

create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;

drop policy if exists "ver mis amistades" on public.friendships;
create policy "ver mis amistades" on public.friendships
  for select using (auth.uid() in (requester, addressee));

drop policy if exists "pedir amistad" on public.friendships;
create policy "pedir amistad" on public.friendships
  for insert with check (auth.uid() = requester and status = 'pending');

drop policy if exists "aceptar amistad" on public.friendships;
create policy "aceptar amistad" on public.friendships
  for update using (auth.uid() = addressee) with check (status = 'accepted');

drop policy if exists "borrar amistad" on public.friendships;
create policy "borrar amistad" on public.friendships
  for delete using (auth.uid() in (requester, addressee));

-- Salas: el estado completo (con todas las cartas) solo lo lee el servidor --
create table if not exists public.truco_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  status text not null,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS activado y sin políticas: desde la app no se puede leer ni escribir
alter table public.truco_rooms enable row level security;

-- Lo que ve cada jugador (sus cartas, nunca las ajenas) ----------------------
create table if not exists public.truco_views (
  room_id uuid not null references public.truco_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  view jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists truco_views_user on public.truco_views (user_id, updated_at desc);

alter table public.truco_views enable row level security;

drop policy if exists "ver mi vista" on public.truco_views;
create policy "ver mi vista" on public.truco_views
  for select using (auth.uid() = user_id);

-- Avisos en tiempo real cuando cambia la vista de un jugador
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'truco_views'
  ) then
    alter publication supabase_realtime add table public.truco_views;
  end if;
end $$;
