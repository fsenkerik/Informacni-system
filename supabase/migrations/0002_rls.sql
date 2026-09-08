-- =====================================================================
--  DataFirma – Row Level Security + Realtime
--  Spusť až po 0001_init.sql.
-- =====================================================================

-- Kód projektu se generuje sám, klient ho neposílá.
alter table public.projects
  alter column join_code set default public.generate_join_code();

alter table public.teachers             enable row level security;
alter table public.classes              enable row level security;
alter table public.projects             enable row level security;
alter table public.project_members      enable row level security;
alter table public.entities             enable row level security;
alter table public.attributes           enable row level security;
alter table public.relationships        enable row level security;
alter table public.sim_runs             enable row level security;
alter table public.sim_records          enable row level security;
alter table public.sim_events           enable row level security;
alter table public.sim_issues           enable row level security;
alter table public.project_progress     enable row level security;
alter table public.project_achievements enable row level security;

-- ---------------------------------------------------------------------
--  Učitel
-- ---------------------------------------------------------------------

drop policy if exists teachers_self on public.teachers;
create policy teachers_self on public.teachers
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists classes_owner on public.classes;
create policy classes_owner on public.classes
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- ---------------------------------------------------------------------
--  Projekty a členství
-- ---------------------------------------------------------------------

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects
  for select using (public.can_access_project(id));

-- Projekt zakládá jen učitel, a jen do vlastní třídy.
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert with check (
    exists (select 1 from public.classes c
            where c.id = class_id and c.teacher_id = auth.uid())
  );

-- Žáci si smějí pojmenovat firmu, učitel může měnit vše.
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (public.can_access_project(id))
  with check (public.can_access_project(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete using (public.is_class_teacher(id));

-- Vkládání členů řeší výhradně RPC join_project (SECURITY DEFINER),
-- proto tu záměrně není INSERT politika.
drop policy if exists members_read on public.project_members;
create policy members_read on public.project_members
  for select using (public.can_access_project(project_id));

drop policy if exists members_update_self on public.project_members;
create policy members_update_self on public.project_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
  for delete using (user_id = auth.uid() or public.is_class_teacher(project_id));

-- ---------------------------------------------------------------------
--  Návrh schématu – čte i učitel, píše jen člen skupiny
-- ---------------------------------------------------------------------

do $rls$
declare t text;
begin
  foreach t in array array[
    'entities', 'attributes', 'relationships',
    'sim_runs', 'sim_records', 'sim_events', 'sim_issues',
    'project_progress', 'project_achievements'
  ] loop
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
  end loop;
end
$rls$;

-- ---------------------------------------------------------------------
--  Realtime – sdílení návrhu ve dvojici
--  sim_records a sim_events schválně NEjsou v publikaci: při 300×
--  rychlosti by zahltily spojení. Ty posíláme přes Realtime Broadcast.
-- ---------------------------------------------------------------------

do $rt$
declare t text;
begin
  foreach t in array array[
    'entities', 'attributes', 'relationships',
    'project_members', 'projects', 'sim_runs', 'sim_issues',
    'project_progress', 'project_achievements'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$rt$;
