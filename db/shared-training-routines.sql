-- Shared prescriptions keep separate routine/day/exercise/set IDs per client.
-- RLS stays in force: all RPCs run with the signed-in trainer's privileges.
alter table public.routines add column shared_source_routine_id uuid references public.routines(id) on delete set null;
alter table public.routines add column shared_request_id uuid;
create unique index routines_shared_client on public.routines(shared_source_routine_id,client_id) where shared_source_routine_id is not null and status <> 'archived';
create unique index routines_shared_request on public.routines(shared_request_id,client_id) where shared_request_id is not null;
alter table public.workout_days add column shared_source_day_id uuid;
alter table public.workout_exercises add column shared_source_exercise_id uuid;
alter table public.workout_sets add column shared_source_set_id uuid;
create unique index workout_days_shared_source on public.workout_days(routine_id,shared_source_day_id);
create unique index workout_exercises_shared_source on public.workout_exercises(workout_day_id,shared_source_exercise_id);
create unique index workout_sets_shared_source on public.workout_sets(workout_exercise_id,shared_source_set_id);

create or replace function public.sync_shared_routine(p_source uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare src public.routines; dst public.routines; d public.workout_days; e public.workout_exercises; st public.workout_sets;
 did uuid; eid uuid; n integer:=0;
begin
 if auth.uid() is null or not app_private.is_trainer() then raise exception 'Solo el entrenador puede compartir rutinas'; end if;
 select * into src from public.routines where id=p_source and trainer_id=auth.uid() for update;
 if not found or src.shared_source_routine_id is not null or src.status<>'active' or not app_private.is_assigned_trainer(src.client_id) then raise exception 'Rutina principal no disponible'; end if;
 for dst in select * from public.routines where shared_source_routine_id=src.id and trainer_id=auth.uid() and status='active' order by id for update loop
  if not app_private.is_assigned_trainer(dst.client_id) then raise exception 'Desvincula primero los clientes que ya no están asignados'; end if;
  update public.routines set name=src.name,goal=src.goal,start_date=src.start_date,end_date=src.end_date,block_number=src.block_number,updated_at=now() where id=dst.id;
  -- Archive removals; never delete records referenced by individual workout logs.
  update public.workout_days t set is_archived=true where t.routine_id=dst.id and t.shared_source_day_id is not null and not exists(select 1 from public.workout_days x where x.id=t.shared_source_day_id and x.routine_id=src.id and not x.is_archived);
  for d in select * from public.workout_days where routine_id=src.id and not is_archived order by day_number loop
   insert into public.workout_days(routine_id,shared_source_day_id,day_number,name,notes,weekday,reminder_time,cardio_enabled,cardio_machine,cardio_minutes,cardio_intensity,cardio_timing,cardio_incline,cardio_speed,cardio_resistance,cardio_notes,is_archived) values(dst.id,d.id,d.day_number,d.name,d.notes,d.weekday,d.reminder_time,d.cardio_enabled,d.cardio_machine,d.cardio_minutes,d.cardio_intensity,d.cardio_timing,d.cardio_incline,d.cardio_speed,d.cardio_resistance,d.cardio_notes,false)
   on conflict(routine_id,shared_source_day_id) do update set day_number=excluded.day_number,name=excluded.name,notes=excluded.notes,weekday=excluded.weekday,reminder_time=excluded.reminder_time,cardio_enabled=excluded.cardio_enabled,cardio_machine=excluded.cardio_machine,cardio_minutes=excluded.cardio_minutes,cardio_intensity=excluded.cardio_intensity,cardio_timing=excluded.cardio_timing,cardio_incline=excluded.cardio_incline,cardio_speed=excluded.cardio_speed,cardio_resistance=excluded.cardio_resistance,cardio_notes=excluded.cardio_notes,is_archived=excluded.is_archived returning id into did;
   update public.workout_exercises t set is_archived=true where t.workout_day_id=did and t.shared_source_exercise_id is not null and not exists(select 1 from public.workout_exercises x where x.id=t.shared_source_exercise_id and x.workout_day_id=d.id and not x.is_archived);
   for e in select * from public.workout_exercises where workout_day_id=d.id and not is_archived order by exercise_order loop
   insert into public.workout_exercises(workout_day_id,shared_source_exercise_id,exercise_id,exercise_order,rest_seconds,tempo,notes,is_archived) values(did,e.id,e.exercise_id,e.exercise_order,e.rest_seconds,e.tempo,e.notes,false)
   on conflict(workout_day_id,shared_source_exercise_id) do update set exercise_id=excluded.exercise_id,exercise_order=excluded.exercise_order,rest_seconds=excluded.rest_seconds,tempo=excluded.tempo,notes=excluded.notes,is_archived=excluded.is_archived returning id into eid;
    update public.workout_sets t set is_archived=true where t.workout_exercise_id=eid and t.shared_source_set_id is not null and not exists(select 1 from public.workout_sets x where x.id=t.shared_source_set_id and x.workout_exercise_id=e.id and not x.is_archived);
    for st in select * from public.workout_sets where workout_exercise_id=e.id and not is_archived order by set_number loop
   insert into public.workout_sets(workout_exercise_id,shared_source_set_id,set_number,target_reps_min,target_reps_max,target_rir,is_warmup,notes,is_archived) values(eid,st.id,st.set_number,st.target_reps_min,st.target_reps_max,st.target_rir,st.is_warmup,st.notes,false)
   on conflict(workout_exercise_id,shared_source_set_id) do update set set_number=excluded.set_number,target_reps_min=excluded.target_reps_min,target_reps_max=excluded.target_reps_max,target_rir=excluded.target_rir,is_warmup=excluded.is_warmup,notes=excluded.notes,is_archived=excluded.is_archived;
    end loop;
   end loop;
  end loop;
  n:=n+1;
 end loop;
 return n;
end; $$;
revoke all on function public.sync_shared_routine(uuid) from public,anon;
grant execute on function public.sync_shared_routine(uuid) to authenticated;

create or replace function public.share_training_routine(p_source uuid,p_clients uuid[],p_link boolean,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare src public.routines; cid uuid; rid uuid; old_id uuid; created_ids uuid[]:='{}';
begin
 if auth.uid() is null or not app_private.is_trainer() then raise exception 'Solo el entrenador puede compartir rutinas'; end if;
 select * into src from public.routines where id=p_source and trainer_id=auth.uid() for update;
 if not found or src.status<>'active' or src.shared_source_routine_id is not null or not app_private.is_assigned_trainer(src.client_id) then raise exception 'Selecciona la rutina principal activa del grupo'; end if;
 if p_request is null or p_clients is null or cardinality(p_clients)<1 or cardinality(p_clients)>100 or p_link is null then raise exception 'Selecciona entre 1 y 100 clientes'; end if;
 -- Validate the entire selection before writing anything. No gender-based restrictions.
 if exists(select 1 from unnest(p_clients) c where c is null or c=src.client_id or not exists(select 1 from public.trainer_clients tc where tc.client_id=c and tc.trainer_id=auth.uid() and tc.status='active' and tc.service_training)) then raise exception 'Solo puedes elegir clientes propios con entrenamiento activo'; end if;
 for cid in select distinct c from unnest(p_clients) c order by c loop
  rid:=null;
  select id into rid from public.routines where trainer_id=auth.uid() and client_id=cid and (shared_request_id=p_request or (p_link and shared_source_routine_id=src.id and status='active')) limit 1;
  if rid is null then
   -- Explicitly confirmed in the assignment dialog; all previous history is retained.
   for old_id in select id from public.routines where trainer_id=auth.uid() and client_id=cid and status='active' order by id loop
    perform public.detach_shared_routine(old_id);
   end loop;
   update public.routines set status='archived',updated_at=now() where trainer_id=auth.uid() and client_id=cid and status='active';
   insert into public.routines(trainer_id,client_id,name,goal,status,start_date,end_date,block_number,shared_source_routine_id,shared_request_id)
    values(auth.uid(),cid,src.name,src.goal,'active',src.start_date,src.end_date,src.block_number,src.id,p_request) returning id into rid;
  end if;
  created_ids:=array_append(created_ids,rid);
 end loop;
 perform public.sync_shared_routine(src.id);
 if not p_link then
  update public.routines set shared_source_routine_id=null where id=any(created_ids) and shared_request_id=p_request;
 end if;
 return to_jsonb(created_ids);
end; $$;
revoke all on function public.share_training_routine(uuid,uuid[],boolean,uuid) from public,anon;
grant execute on function public.share_training_routine(uuid,uuid[],boolean,uuid) to authenticated;

create or replace function public.detach_shared_routine(p_routine uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.routines; promoted uuid; leader uuid;
begin
 if auth.uid() is null or not app_private.is_trainer() then raise exception 'No autorizado'; end if;
 select coalesce(shared_source_routine_id,id) into leader from public.routines where id=p_routine and trainer_id=auth.uid();
 if leader is null then raise exception 'Rutina no disponible'; end if;
 perform 1 from public.routines where id=leader and trainer_id=auth.uid() for update;
 select * into r from public.routines where id=p_routine and trainer_id=auth.uid() for update;
 if not found then raise exception 'Rutina no disponible'; end if;
 if r.shared_source_routine_id is null then
  -- Promote another member so detaching the original client leaves the rest linked.
  select id into promoted from public.routines where shared_source_routine_id=r.id and trainer_id=auth.uid() and status='active' order by id limit 1 for update;
  if promoted is not null then
   update public.workout_sets t set shared_source_set_id=n.id from public.workout_sets n,public.workout_exercises ne,public.workout_days nd,public.workout_exercises te,public.workout_days td,public.routines tr
    where n.shared_source_set_id=t.shared_source_set_id and n.workout_exercise_id=ne.id and ne.workout_day_id=nd.id and nd.routine_id=promoted
      and t.workout_exercise_id=te.id and te.workout_day_id=td.id and td.routine_id=tr.id and tr.shared_source_routine_id=r.id and tr.id<>promoted and tr.trainer_id=auth.uid();
   update public.workout_exercises t set shared_source_exercise_id=n.id from public.workout_exercises n,public.workout_days nd,public.workout_days td,public.routines tr
    where n.shared_source_exercise_id=t.shared_source_exercise_id and n.workout_day_id=nd.id and nd.routine_id=promoted and t.workout_day_id=td.id and td.routine_id=tr.id and tr.shared_source_routine_id=r.id and tr.id<>promoted and tr.trainer_id=auth.uid();
   update public.workout_days t set shared_source_day_id=n.id from public.workout_days n,public.routines tr
    where n.shared_source_day_id=t.shared_source_day_id and n.routine_id=promoted and t.routine_id=tr.id and tr.shared_source_routine_id=r.id and tr.id<>promoted and tr.trainer_id=auth.uid();
   update public.routines set shared_source_routine_id=promoted where shared_source_routine_id=r.id and id<>promoted and trainer_id=auth.uid();
   update public.routines set shared_source_routine_id=null where id=promoted;
   update public.workout_days set shared_source_day_id=null where routine_id=promoted;
   update public.workout_exercises set shared_source_exercise_id=null where workout_day_id in (select id from public.workout_days where routine_id=promoted);
   update public.workout_sets set shared_source_set_id=null where workout_exercise_id in(select e.id from public.workout_exercises e join public.workout_days d on d.id=e.workout_day_id where d.routine_id=promoted);
  end if;
 end if;
 update public.routines set shared_source_routine_id=null,updated_at=now() where id=r.id;
 update public.workout_days set shared_source_day_id=null where routine_id=r.id;
 update public.workout_exercises set shared_source_exercise_id=null where workout_day_id in(select id from public.workout_days where routine_id=r.id);
 update public.workout_sets set shared_source_set_id=null where workout_exercise_id in(select e.id from public.workout_exercises e join public.workout_days d on d.id=e.workout_day_id where d.routine_id=r.id);
end; $$;
revoke all on function public.detach_shared_routine(uuid) from public,anon;
grant execute on function public.detach_shared_routine(uuid) to authenticated;
