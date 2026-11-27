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

-- Guarda la sala y las vistas de los jugadores en una sola llamada (más rápido)
create or replace function public.truco_save(
  p_id uuid, p_code text, p_host uuid, p_status text, p_state jsonb,
  p_version integer, p_prev integer, p_views jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_prev is null then
    insert into truco_rooms (id, code, host_id, status, state, version)
    values (p_id, p_code, p_host, p_status, p_state, p_version);
  else
    update truco_rooms
      set status = p_status, state = p_state, version = p_version, updated_at = now()
      where id = p_id and version = p_prev;
    if not found then return false; end if;
  end if;
  insert into truco_views (room_id, user_id, view, version, updated_at)
    select p_id, (v ->> 'user_id')::uuid, v -> 'view', p_version, now()
    from jsonb_array_elements(p_views) v
  on conflict (room_id, user_id) do update
    set view = excluded.view, version = excluded.version, updated_at = now();
  return true;
end;
$$;

revoke execute on function public.truco_save(uuid, text, uuid, text, jsonb, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.truco_save(uuid, text, uuid, text, jsonb, integer, integer, jsonb) to service_role;

-- Avisos en tiempo real de pedidos de amistad (respeta las reglas de lectura de arriba)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

-- Mail para entrar (opcional) ------------------------------------------------
-- Las cuentas siguen siendo usuario@jugadores.sudoku-pato.app (igual que el
-- Sudoku). El mail real se guarda aparte, solo lo ve su dueño, y sirve para
-- entrar escribiendo el mail en vez del usuario.
create table if not exists public.account_emails (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_emails_email on public.account_emails (email);

alter table public.account_emails enable row level security;

drop policy if exists "ver mi mail" on public.account_emails;
create policy "ver mi mail" on public.account_emails
  for select using (auth.uid() = user_id);

drop policy if exists "cargar mi mail" on public.account_emails;
create policy "cargar mi mail" on public.account_emails
  for insert with check (auth.uid() = user_id);

drop policy if exists "cambiar mi mail" on public.account_emails;
create policy "cambiar mi mail" on public.account_emails
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "borrar mi mail" on public.account_emails;
create policy "borrar mi mail" on public.account_emails
  for delete using (auth.uid() = user_id);

-- Para el login: de un mail devuelve el usuario (o null si no hay ninguno)
create or replace function public.username_for_email(p_email text) returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.username
  from account_emails e join profiles p on p.id = e.user_id
  where e.email = lower(trim(p_email));
$$;

revoke execute on function public.username_for_email(text) from public;
grant execute on function public.username_for_email(text) to anon, authenticated;

-- Al crear la cuenta con mail, lo guarda en la misma operación
create or replace function public.save_signup_email() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.raw_user_meta_data ->> 'contact_email'));
begin
  if v_email is not null and v_email <> '' then
    insert into account_emails (user_id, email) values (new.id, v_email);
  end if;
  return new;
end;
$$;

revoke execute on function public.save_signup_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_email on auth.users;
create trigger on_auth_user_created_email
  after insert on auth.users
  for each row execute function public.save_signup_email();

-- Mesas públicas abiertas (sin cartas) -----------------------------------------
-- La lista que ve todo el mundo. La escribe solo el servidor del juego.
create table if not exists public.truco_lobby (
  room_id uuid primary key references public.truco_rooms (id) on delete cascade,
  code text not null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  players integer not null check (players in (2, 4)),
  target integer not null check (target in (15, 30)),
  flor boolean not null,
  taken integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- pair_open: quedan libres los dos lugares de un mismo equipo (para sumarse en dupla)
alter table public.truco_lobby add column if not exists pair_open boolean not null default false;

create index if not exists truco_lobby_updated on public.truco_lobby (updated_at desc);

alter table public.truco_lobby enable row level security;

drop policy if exists "ver mesas abiertas" on public.truco_lobby;
create policy "ver mesas abiertas" on public.truco_lobby
  for select to authenticated using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'truco_lobby'
  ) then
    alter publication supabase_realtime add table public.truco_lobby;
  end if;
end $$;
