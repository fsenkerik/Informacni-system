-- =====================================================================
--  DataFirma – sortiment a nastavení firmy
--  Spusť až po 0001_init.sql a 0002_rls.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Nastavení firmy
-- ---------------------------------------------------------------------

create table if not exists public.project_settings (
  project_id       uuid primary key references public.projects (id) on delete cascade,
  -- Marže v procentech: nákupní cena = prodejní × (1 − marže/100).
  margin_percent   numeric not null default 40 check (margin_percent >= 0 and margin_percent < 100),
  employees        integer not null default 2 check (employees >= 0),
  hourly_wage      numeric not null default 150 check (hourly_wage >= 0),
  -- Nájem a energie bez mezd; mzdy se počítají zvlášť po hodinách.
  rent_per_day     numeric not null default 800 check (rent_per_day >= 0),
  starting_capital numeric not null default 100000 check (starting_capital >= 0),
  auto_restock     boolean not null default true,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Sortiment
--
--  `data` drží hodnoty podle sloupců, které si žák sám navrhl v tabulce
--  s rolí Produkt. Obchodní údaje (nákupní cena, pravidlo doobjednání)
--  jsou vedle, protože do jeho návrhu nepatří.
-- ---------------------------------------------------------------------

create table if not exists public.catalog_items (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  data           jsonb not null default '{}'::jsonb,
  -- NULL znamená „dopočítej z marže firmy".
  purchase_price numeric check (purchase_price is null or purchase_price >= 0),
  reorder_level  integer not null default 5 check (reorder_level >= 0),
  reorder_qty    integer not null default 20 check (reorder_qty >= 0),
  order_index    integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists catalog_items_project_idx
  on public.catalog_items (project_id, order_index);

-- ---------------------------------------------------------------------
--  Oprávnění a Realtime
-- ---------------------------------------------------------------------

alter table public.project_settings enable row level security;
alter table public.catalog_items    enable row level security;

do $rls$
declare t text;
begin
  foreach t in array array['project_settings', 'catalog_items'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select
       using (public.can_access_project(project_id))', t, t);

    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format(
      'create policy %I_write on public.%I for insert
       with check (public.is_project_member(project_id))', t, t);

    execute format('drop policy if exists %I_modify on public.%I', t, t);
    execute format(
      'create policy %I_modify on public.%I for update
       using (public.is_project_member(project_id))
       with check (public.is_project_member(project_id))', t, t);

    execute format('drop policy if exists %I_remove on public.%I', t, t);
    execute format(
      'create policy %I_remove on public.%I for delete
       using (public.is_project_member(project_id))', t, t);

    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end
$rls$;

do $rt$
declare t text;
begin
  foreach t in array array['project_settings', 'catalog_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$rt$;

-- Existující projekty dostanou výchozí nastavení, ať nikde nechybí.
insert into public.project_settings (project_id)
select id from public.projects
on conflict (project_id) do nothing;
