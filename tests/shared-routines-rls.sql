-- Execute inside BEGIN / ROLLBACK. Fixtures never persist.
create temporary table shared_test_context as
 select tc.trainer_id,(array_agg(tc.client_id order by tc.client_id))[1] a,
 (array_agg(tc.client_id order by tc.client_id))[2] b,
 (array_agg(tc.client_id order by tc.client_id))[3] c,
 gen_random_uuid() src,gen_random_uuid() day_id,gen_random_uuid() ex,gen_random_uuid() st,
 gen_random_uuid() req,(select id from public.exercises where is_global limit 1) exercise
 from public.trainer_clients tc join public.profiles p on p.id=tc.trainer_id
 where tc.status='active' and tc.service_training and p.role='trainer'
 group by tc.trainer_id having count(*)>=3 limit 1;
grant select on shared_test_context to authenticated;
do $$begin if not exists(select 1 from shared_test_context) then raise exception 'Three clients required'; end if; end$$;
select set_config('request.jwt.claims',json_build_object('sub',trainer_id,'role','authenticated')::text,true) from shared_test_context;
set local role authenticated;
insert into public.routines(id,trainer_id,client_id,name,status) select src,trainer_id,a,'Shared test fixture','active' from shared_test_context;
insert into public.workout_days(id,routine_id,day_number,name,cardio_enabled,cardio_machine,cardio_minutes) select day_id,src,1,'Test day',true,'cinta',20 from shared_test_context;
insert into public.workout_exercises(id,workout_day_id,exercise_id,exercise_order,rest_seconds) select ex,day_id,exercise,1,90 from shared_test_context;
insert into public.workout_sets(id,workout_exercise_id,set_number,target_reps_min,target_reps_max,target_rir,target_weight_kg) select st,ex,1,8,12,2,80 from shared_test_context;
select public.share_training_routine(src,array[b,c],true,req) from shared_test_context;
select public.share_training_routine(src,array[b,c],true,req) from shared_test_context;
do $$declare t record; n integer; begin
 select * into t from shared_test_context;
 select count(*) into n from public.routines where shared_request_id=t.req;
 if n<>2 then raise exception 'Duplicate or missing shared assignment: %',n; end if;
 if exists(select 1 from public.workout_sets s join public.workout_exercises e on e.id=s.workout_exercise_id join public.workout_days d on d.id=e.workout_day_id join public.routines r on r.id=d.routine_id where r.shared_request_id=t.req and (s.id=t.st or s.target_weight_kg is not null)) then raise exception 'Client weights or IDs copied'; end if;
end$$;
create temporary table shared_original_ids as select r.id rid,r.client_id,d.id did,e.id eid,s.id sid from public.routines r join public.workout_days d on d.routine_id=r.id join public.workout_exercises e on e.workout_day_id=d.id join public.workout_sets s on s.workout_exercise_id=e.id where r.shared_request_id=(select req from shared_test_context);
update public.workout_sets set target_weight_kg=60 where id in(select sid from shared_original_ids);
update public.workout_sets set target_reps_min=10,target_reps_max=15 where id=(select st from shared_test_context);
update public.workout_days set cardio_minutes=30 where id=(select day_id from shared_test_context);
select public.sync_shared_routine(src) from shared_test_context;
do $$begin
 if exists(select 1 from shared_original_ids o left join public.workout_sets s on s.id=o.sid left join public.workout_days d on d.id=o.did where s.id is null or s.target_weight_kg<>60 or s.target_reps_min<>10 or s.target_reps_max<>15 or d.cardio_minutes<>30) then raise exception 'Sync lost personal weights, identity, or prescription'; end if;
end$$;
-- Removing a prescribed set archives its mapped copy without deleting history IDs.
update public.workout_sets set is_archived=true where id=(select st from shared_test_context);
select public.sync_shared_routine(src) from shared_test_context;
do $$begin
 if exists(select 1 from shared_original_ids o left join public.workout_sets s on s.id=o.sid where s.id is null or not s.is_archived) then raise exception 'Removed sets lost history or stayed visible';end if;
end$$;
update public.workout_sets set is_archived=false where id=(select st from shared_test_context);
select public.sync_shared_routine(src) from shared_test_context;
-- Client B must not see A's or C's planning, nor invoke sharing.
reset role;
select set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true) from shared_test_context;
set local role authenticated;
do $$declare t record; begin
 select * into t from shared_test_context;
 if exists(select 1 from public.routines where id=t.src or (shared_request_id=t.req and client_id<>t.b)) then raise exception 'Client can see another member'; end if;
 begin
  perform public.sync_shared_routine(t.src);
  raise exception 'Client RPC unexpectedly allowed';
 exception when raise_exception then if sqlerrm='Client RPC unexpectedly allowed' then raise; end if; end;
end$$;
reset role;
-- Unrelated identity cannot read or mutate a group.
select set_config('request.jwt.claims',json_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.routines where id=(select src from shared_test_context) or shared_request_id=(select req from shared_test_context)) then raise exception 'Unrelated account can read group'; end if;
 begin perform public.detach_shared_routine((select src from shared_test_context));raise exception 'Outsider RPC unexpectedly allowed';
 exception when raise_exception then if sqlerrm='Outsider RPC unexpectedly allowed' then raise; end if; end;
end$$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',trainer_id,'role','authenticated')::text,true) from shared_test_context;
set local role authenticated;
-- Detaching the original keeps the two remaining members linked, with stable IDs.
select public.detach_shared_routine(src) from shared_test_context;
do $$declare root uuid; begin
 select id into root from public.routines where shared_request_id=(select req from shared_test_context) and shared_source_routine_id is null;
 if root is null or (select count(*) from public.routines where shared_source_routine_id=root)<>1 then raise exception 'Promotion lost remaining group'; end if;
 update public.workout_sets set target_reps_min=11 where workout_exercise_id in(select e.id from public.workout_exercises e join public.workout_days d on d.id=e.workout_day_id where d.routine_id=root);
 perform public.sync_shared_routine(root);
 if exists(select 1 from shared_original_ids o join public.workout_sets s on s.id=o.sid where s.target_reps_min<>11 or s.target_weight_kg<>60) then raise exception 'Promoted mappings failed'; end if;
end$$;
-- Independent copy: retries do not duplicate, later source edits cannot affect it.

-- Use a fresh request for an intentional independent copy of a former group member.
select public.share_training_routine(src,array[c],false,'d8a981ab-6ba0-42eb-ab46-a24795a7c240') from shared_test_context;
select public.share_training_routine(src,array[c],false,'d8a981ab-6ba0-42eb-ab46-a24795a7c240') from shared_test_context;
do $$begin
 if (select count(*) from public.routines where shared_request_id='d8a981ab-6ba0-42eb-ab46-a24795a7c240')<>1 then raise exception 'Copy retry duplicated';end if;
 if exists(select 1 from public.routines where shared_request_id='d8a981ab-6ba0-42eb-ab46-a24795a7c240' and shared_source_routine_id is not null) then raise exception 'Copy remained linked';end if;
end$$;
update public.workout_sets set target_reps_min=5 where id=(select st from shared_test_context);
select public.sync_shared_routine(src) from shared_test_context;
do $$begin
 if exists(select 1 from public.workout_sets s join public.workout_exercises e on e.id=s.workout_exercise_id join public.workout_days d on d.id=e.workout_day_id join public.routines r on r.id=d.routine_id where r.shared_request_id='d8a981ab-6ba0-42eb-ab46-a24795a7c240' and s.target_reps_min<>10) then raise exception 'Independent copy changed with original';end if;
end$$;
-- Entire invalid selection rolls back; not even the valid client is assigned.
do $$declare t record; q uuid:=gen_random_uuid(); begin
 select * into t from shared_test_context;
 begin perform public.share_training_routine(t.src,array[t.b,gen_random_uuid()],true,q);raise exception 'Invalid selection accepted';
 exception when raise_exception then if sqlerrm='Invalid selection accepted' then raise; end if; end;
 if exists(select 1 from public.routines where shared_request_id=q) then raise exception 'Partial assignment persisted';end if;
end$$;
reset role;
select 'PASS: isolated clients and RPCs, atomic validation, idempotency, separate weights, stable IDs, cardio, leader promotion, independent copies' as result;
