-- Private, resumable editor values. No prescriptions, notifications or reminder schedules
-- change until the trainer explicitly activates the editor through the validated save flow.
create table public.planning_drafts (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.profiles(id),
 client_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('training','nutrition','supplements')),
 name text not null,
 source_id uuid,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=2000000),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now()
);
create index planning_drafts_owner_client on public.planning_drafts(trainer_id,kind,client_id,updated_at desc);
alter table public.planning_drafts enable row level security;
revoke all on public.planning_drafts from public,anon;
grant select,insert,update,delete on public.planning_drafts to authenticated;
create policy planning_drafts_owner_read on public.planning_drafts for select to authenticated
using(trainer_id=(select auth.uid()));
create policy planning_drafts_owner_insert on public.planning_drafts for insert to authenticated
with check(trainer_id=(select auth.uid()) and exists(select 1 from public.trainer_clients tc join public.profiles p on p.id=tc.trainer_id where tc.trainer_id=(select auth.uid()) and tc.client_id=planning_drafts.client_id and tc.status='active' and p.role='trainer'));
create policy planning_drafts_owner_update on public.planning_drafts for update to authenticated
using(trainer_id=(select auth.uid()))
with check(trainer_id=(select auth.uid()) and exists(select 1 from public.trainer_clients tc join public.profiles p on p.id=tc.trainer_id where tc.trainer_id=(select auth.uid()) and tc.client_id=planning_drafts.client_id and tc.status='active' and p.role='trainer'));
create policy planning_drafts_owner_delete on public.planning_drafts for delete to authenticated
using(trainer_id=(select auth.uid()));

-- New parents are materialized as draft during activation; an interrupted write must
-- never replace the live plan or expose partial children through direct API reads.
alter table public.nutrition_plans drop constraint nutrition_plans_status_check;
alter table public.nutrition_plans add constraint nutrition_plans_status_check check(status in ('draft','active','inactive','archived'));
alter table public.supplement_plans drop constraint supplement_plans_status_check;
alter table public.supplement_plans add constraint supplement_plans_status_check check(status in ('draft','active','archived'));
create policy nutrition_plans_private_draft on public.nutrition_plans as restrictive for select to authenticated
using(status<>'draft' or trainer_id=(select auth.uid()));
create policy supplement_plans_private_draft on public.supplement_plans as restrictive for select to authenticated
using(status<>'draft' or trainer_id=(select auth.uid()));
create policy routines_private_draft on public.routines as restrictive for select to authenticated
using(status<>'draft' or trainer_id=(select auth.uid()));

create or replace function public.activate_private_plan(p_kind text,p_plan_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; customer_id uuid;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 if p_kind='nutrition' then
  select trainer_id,client_id into owner_id,customer_id from public.nutrition_plans where id=p_plan_id and trainer_id=auth.uid();
 elsif p_kind='supplements' then
  select trainer_id,client_id into owner_id,customer_id from public.supplement_plans where id=p_plan_id and trainer_id=auth.uid();
 else raise exception 'Tipo de plan no válido'; end if;
 if owner_id is null then raise exception 'Plan no encontrado o sin permisos'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||owner_id::text||':'||customer_id::text,0));
 if p_kind='nutrition' then
  perform 1 from public.nutrition_plans where id=p_plan_id for update;
  if not exists(select 1 from public.nutrition_meals m where m.plan_id=p_plan_id and m.archived_at is null)
   or exists(select 1 from public.nutrition_meals m where m.plan_id=p_plan_id and m.archived_at is null and not exists(select 1 from public.nutrition_foods f where f.meal_id=m.id)) then raise exception 'Completa las comidas antes de activar la dieta'; end if;
  update public.nutrition_plans set status='archived' where trainer_id=owner_id and client_id=customer_id and status='active' and id<>p_plan_id;
  update public.nutrition_plans set status='active',updated_at=now() where id=p_plan_id;
 else
  perform 1 from public.supplement_plans where id=p_plan_id for update;
  if not exists(select 1 from public.supplement_items where plan_id=p_plan_id and active) then raise exception 'Añade suplementos antes de activar'; end if;
  update public.supplement_plans set status='archived' where trainer_id=owner_id and client_id=customer_id and status='active' and id<>p_plan_id;
  update public.supplement_plans set status='active',updated_at=now() where id=p_plan_id;
 end if;
end $$;
revoke all on function public.activate_private_plan(text,uuid) from public,anon;
grant execute on function public.activate_private_plan(text,uuid) to authenticated;
