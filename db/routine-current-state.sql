-- One current routine per trainer/client. Never delete prescriptions or session logs.
-- Keep a record of the statuses normalized during this migration.
create table if not exists public.routine_status_repairs (
 routine_id uuid primary key references public.routines(id) on delete cascade,
 trainer_id uuid not null references public.profiles(id),
 previous_status text not null,
 repaired_at timestamptz not null default now()
);
alter table public.routine_status_repairs enable row level security;
revoke all on public.routine_status_repairs from anon,authenticated;
grant select on public.routine_status_repairs to authenticated;
create policy routine_status_repairs_read on public.routine_status_repairs for select to authenticated using(trainer_id=(select auth.uid()));
-- Prefer a currently scheduled plan, then the most recently started/created plan.
with ranked as (
 select id,trainer_id,row_number() over(partition by trainer_id,client_id order by
 (coalesce(start_date,current_date)<=current_date and coalesce(end_date,current_date)>=current_date) desc,
 start_date desc nulls last,created_at desc,id desc) as position
 from public.routines where status='active'
)
insert into public.routine_status_repairs(routine_id,trainer_id,previous_status)
select id,trainer_id,'active' from ranked where position>1 on conflict do nothing;
-- Detach affected shared routines with their existing history-preserving helper.
do $$
declare r record;
begin
 for r in select p.routine_id,p.trainer_id from public.routine_status_repairs p join public.routines x on x.id=p.routine_id where x.status='active' loop
  perform set_config('request.jwt.claim.sub',r.trainer_id::text,true);
  perform public.detach_shared_routine(r.routine_id);
  update public.routines set status='completed',updated_at=now() where id=r.routine_id;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
end $$;
create unique index routines_one_active_per_trainer_client on public.routines(trainer_id,client_id) where status='active';
create or replace function public.activate_routine_block(p_routine_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.routines; old_id uuid;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 select * into r from public.routines where id=p_routine_id and trainer_id=(select auth.uid());
 if not found then raise exception 'Rutina no encontrada o sin permisos'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.trainer_id::text||':'||r.client_id::text,0));
 select * into r from public.routines where id=p_routine_id and trainer_id=(select auth.uid()) for update;
 if r.status='active' then return; end if;
 if r.status<>'draft' then raise exception 'Solo se puede activar un borrador'; end if;
 if not exists(select 1 from public.workout_days d where d.routine_id=r.id and not d.is_archived) then raise exception 'El borrador no tiene días de entrenamiento'; end if;
 for old_id in select id from public.routines where trainer_id=r.trainer_id and client_id=r.client_id and status='active' order by id loop
  perform public.detach_shared_routine(old_id);
 end loop;
 update public.routines set status='completed',updated_at=now() where trainer_id=r.trainer_id and client_id=r.client_id and status='active' and id<>r.id;
 update public.routines set status='active',start_date=current_date,end_date=current_date+27,updated_at=now() where id=r.id;
end $$;
revoke all on function public.activate_routine_block(uuid) from public,anon;
grant execute on function public.activate_routine_block(uuid) to authenticated;
