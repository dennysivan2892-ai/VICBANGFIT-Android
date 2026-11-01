-- Keep RLS enabled. Bound each batch to one exercise to avoid deeply expanded join policies.
create or replace function public.sync_shared_routine(p_source uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare src public.routines; dst public.routines; d public.workout_days; e public.workout_exercises;
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
   insert into public.workout_sets(workout_exercise_id,shared_source_set_id,set_number,target_reps_min,target_reps_max,target_rir,is_warmup,notes,is_archived)
   select eid,st.id,st.set_number,st.target_reps_min,st.target_reps_max,st.target_rir,st.is_warmup,st.notes,false
   from public.workout_sets st where st.workout_exercise_id=e.id and not st.is_archived
   on conflict(workout_exercise_id,shared_source_set_id) do update set set_number=excluded.set_number,target_reps_min=excluded.target_reps_min,target_reps_max=excluded.target_reps_max,target_rir=excluded.target_rir,is_warmup=excluded.is_warmup,notes=excluded.notes,is_archived=excluded.is_archived;
   end loop;
  end loop;
  n:=n+1;
 end loop;
 return n;
end; $$;
