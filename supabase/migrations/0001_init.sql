-- =====================================================================
--  DataFirma – základní schéma
--  Spusť celý soubor v Supabase → SQL Editor → New query.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Identita a organizace
-- ---------------------------------------------------------------------

create table if not exists public.teachers (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  name        text not null,
  school_year text,
  created_at  timestamptz not null default now()
);

create index if not exists classes_teacher_idx on public.classes (teacher_id);

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid references public.classes (id) on delete cascade,
  name         text not null,
  company_name text,
  scenario_key text not null default 'eshop',
  join_code    text not null unique,
  size_preset  text not null default 'small'
                 check (size_preset in ('small', 'medium', 'large')),
  free_mode    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_class_idx on public.projects (class_id);

create table if not exists public.project_members (
  project_id   uuid not null references public.projects (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  nickname     text not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  last_seen_at timestamptz not null default now(),
  joined_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);

-- ---------------------------------------------------------------------
--  2. Schéma, které navrhl žák (metadata, ne skutečné tabulky)
-- ---------------------------------------------------------------------

create table if not exists public.entities (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null,
  role_key   text,               -- role ve scénáři: customer, order, product…
  pos_x      double precision not null default 0,
  pos_y      double precision not null default 0,
  color      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entities_project_idx on public.entities (project_id);

create table if not exists public.attributes (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references public.entities (id) on delete cascade,
  project_id     uuid not null references public.projects (id) on delete cascade,
  name           text not null,
  data_type      text not null default 'TEXT' check (data_type in (
                   'TEXT', 'VARCHAR', 'INTEGER', 'DECIMAL', 'BOOLEAN',
                   'DATE', 'DATETIME', 'EMAIL', 'PHONE', 'ENUM')),
  length         integer,
  enum_values    text[],
  is_primary_key boolean not null default false,
  is_required    boolean not null default false,
  is_unique      boolean not null default false,
  default_value  text,
  semantic_key   text,           -- co do sloupce generovat: name, email, price…
  order_index    integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists attributes_entity_idx on public.attributes (entity_id, order_index);
create index if not exists attributes_project_idx on public.attributes (project_id);

create table if not exists public.relationships (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  from_entity_id      uuid not null references public.entities (id) on delete cascade,
  to_entity_id        uuid not null references public.entities (id) on delete cascade,
  kind                text not null check (kind in ('1:1', '1:N', 'M:N')),
  from_label          text,
  to_label            text,
  junction_entity_id  uuid references public.entities (id) on delete set null,
  on_delete           text not null default 'restrict'
                        check (on_delete in ('restrict', 'cascade', 'set_null')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists relationships_project_idx on public.relationships (project_id);

-- ---------------------------------------------------------------------
--  3. Simulace
-- ---------------------------------------------------------------------

create table if not exists public.sim_runs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  scenario_key      text not null,
  seed              integer not null,
  speed             integer not null default 10,
  customers_per_day integer not null default 20,
  host_user_id      uuid references auth.users (id) on delete set null,
  sim_clock         bigint not null default 0,      -- herní minuty od začátku
  tick              bigint not null default 0,
  status            text not null default 'running'
                      check (status in ('running', 'paused', 'finished')),
  metrics           jsonb not null default '{}'::jsonb,
  heartbeat_at      timestamptz not null default now(),
  started_at        timestamptz not null default now()
);

create index if not exists sim_runs_project_idx on public.sim_runs (project_id, started_at desc);

create table if not exists public.sim_records (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.sim_runs (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  entity_id     uuid not null references public.entities (id) on delete cascade,
  data          jsonb not null,
  created_tick  bigint not null default 0
);

create index if not exists sim_records_run_idx on public.sim_records (run_id, entity_id);

create table if not exists public.sim_events (
  id         bigserial primary key,
  run_id     uuid not null references public.sim_runs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  tick       bigint not null,
  type       text not null,
  severity   text not null default 'info' check (severity in ('info', 'warn', 'error')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sim_events_run_idx on public.sim_events (run_id, id desc);

create table if not exists public.sim_issues (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.sim_runs (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  code            text not null,
  entity_id       uuid references public.entities (id) on delete set null,
  relationship_id uuid references public.relationships (id) on delete set null,
  message         text not null,
  count           integer not null default 1,
  first_seen_tick bigint not null default 0,
  last_seen_tick  bigint not null default 0
);

-- NULLS NOT DISTINCT: chyba bez konkrétní tabulky (chybějící vazba) se má
-- počítat jako jedna, ne přibývat s každým zákazníkem. Zároveň na tenhle
-- index míří ON CONFLICT při ukládání průběžných výsledků.
create unique index if not exists sim_issues_unique_idx
  on public.sim_issues (run_id, code, entity_id) nulls not distinct;
create index if not exists sim_issues_run_idx on public.sim_issues (run_id);

-- ---------------------------------------------------------------------
--  4. Gamifikace
-- ---------------------------------------------------------------------

create table if not exists public.project_progress (
  project_id    uuid primary key references public.projects (id) on delete cascade,
  xp            integer not null default 0,
  level         integer not null default 1,
  missions_done jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

create table if not exists public.project_achievements (
  project_id      uuid not null references public.projects (id) on delete cascade,
  achievement_key text not null,
  xp              integer not null default 0,
  unlocked_at     timestamptz not null default now(),
  primary key (project_id, achievement_key)
);

-- ---------------------------------------------------------------------
--  5. Pomocné funkce
-- ---------------------------------------------------------------------

-- SECURITY DEFINER obchází RLS, takže se politiky nezacyklí samy na sobě.
create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = auth.uid()
  );
$fn$;

create or replace function public.is_class_teacher(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
    from public.projects p
    join public.classes c on c.id = p.class_id
    where p.id = p_project and c.teacher_id = auth.uid()
  );
$fn$;

create or replace function public.can_access_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_project_member(p_project) or public.is_class_teacher(p_project);
$fn$;

-- Kód bez znaků, které si žáci pletou (0/O, 1/I/L).
create or replace function public.generate_join_code()
returns text language plpgsql as $fn$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for _i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.projects where join_code = candidate);
  end loop;
  return candidate;
end;
$fn$;

-- Připojení žáka ke skupinovému projektu pomocí kódu.
create or replace function public.join_project(p_code text, p_nickname text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_project uuid;
  v_nick    text := nullif(btrim(p_nickname), '');
begin
  if auth.uid() is null then
    raise exception 'NEPRIHLASEN' using errcode = '28000';
  end if;
  if v_nick is null then
    raise exception 'CHYBI_PREZDIVKA' using errcode = '22023';
  end if;

  select id into v_project
  from public.projects
  where join_code = upper(btrim(p_code));

  if v_project is null then
    raise exception 'NEPLATNY_KOD' using errcode = 'P0002';
  end if;

  insert into public.project_members (project_id, user_id, nickname)
  values (v_project, auth.uid(), left(v_nick, 40))
  on conflict (project_id, user_id)
  do update set nickname = excluded.nickname, last_seen_at = now();

  insert into public.project_progress (project_id) values (v_project)
  on conflict (project_id) do nothing;

  return v_project;
end;
$fn$;

-- Držíme project_id na podřízených tabulkách, aby RLS nemusela dělat join
-- a aby ho nešlo z klienta podvrhnout.
create or replace function public.sync_attribute_project()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  select e.project_id into new.project_id from public.entities e where e.id = new.entity_id;
  return new;
end;
$fn$;

drop trigger if exists attributes_sync_project on public.attributes;
create trigger attributes_sync_project
  before insert or update of entity_id on public.attributes
  for each row execute function public.sync_attribute_project();

create or replace function public.sync_run_project()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  select r.project_id into new.project_id from public.sim_runs r where r.id = new.run_id;
  return new;
end;
$fn$;

drop trigger if exists sim_records_sync_project on public.sim_records;
create trigger sim_records_sync_project
  before insert on public.sim_records
  for each row execute function public.sync_run_project();

drop trigger if exists sim_events_sync_project on public.sim_events;
create trigger sim_events_sync_project
  before insert on public.sim_events
  for each row execute function public.sync_run_project();

drop trigger if exists sim_issues_sync_project on public.sim_issues;
create trigger sim_issues_sync_project
  before insert on public.sim_issues
  for each row execute function public.sync_run_project();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

do $mig$
declare t text;
begin
  foreach t in array array['projects', 'entities', 'attributes', 'relationships'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end
$mig$;
