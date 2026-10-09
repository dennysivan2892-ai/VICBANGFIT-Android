-- Run in a transaction AFTER the migration; rollback restores all fixtures.
-- Requires one existing trainer with at least two active clients.
create temporary table guide_test_context as
 select tc.trainer_id,(array_agg(tc.client_id order by tc.client_id))[1] client_a,
 (array_agg(tc.client_id order by tc.client_id))[2] client_b,
 (select id from public.exercises where is_global limit 1) exercise_id,
 gen_random_uuid() outsider
 from public.trainer_clients tc join public.profiles p on p.id=tc.trainer_id
 where tc.status='active' and p.role='trainer'
 group by tc.trainer_id having count(*)>=2 limit 1;
grant select on guide_test_context to authenticated;
do $$ begin
 if not exists(select 1 from guide_test_context) then raise exception 'Missing trainer with two clients for RLS verification';end if;
end $$;
insert into public.trainer_exercise_guides(trainer_id,exercise_id,client_id,instructions)
 select trainer_id,exercise_id,null,'Shared fixture' from guide_test_context union all
 select trainer_id,exercise_id,client_a,'Client A fixture' from guide_test_context union all
 select trainer_id,exercise_id,client_b,'Client B fixture' from guide_test_context;
update public.trainer_exercise_guides set video_path=trainer_id::text || '/' || exercise_id::text || '/' || coalesce(client_id::text,'shared') || '/test.mp4';
insert into storage.objects(bucket_id,name) select 'exercise-guide-videos',video_path from public.trainer_exercise_guides;
insert into storage.objects(bucket_id,name) select 'exercise-guide-videos',trainer_id::text || '/' || exercise_id::text || '/orphan/test.mp4' from guide_test_context;
select set_config('request.jwt.claims',json_build_object('sub',client_a,'role','authenticated')::text,true) from guide_test_context;
set local role authenticated;
do $$ declare n integer; begin
 select count(*) into n from public.trainer_exercise_guides;
 if (select count(*) from storage.objects where bucket_id='exercise-guide-videos')<>2 then raise exception 'Client video isolation failed';end if;
 if n<>2 then raise exception 'Client must see only shared and their own guide, saw %',n;end if;
 update public.trainer_exercise_guides set instructions='Unauthorized client write';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Client can edit guides';end if;
 begin
  insert into public.trainer_exercise_guides(trainer_id,exercise_id,client_id,instructions)
   select client_a,exercise_id,null,'Unauthorized ownership' from guide_test_context;
  raise exception 'Client insert unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true) from guide_test_context;
set local role authenticated;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='exercise-guide-videos') then raise exception 'Unlinked account can read videos';end if;
 if exists(select 1 from public.trainer_exercise_guides) then raise exception 'Unlinked account can read guides';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',trainer_id,'role','authenticated')::text,true) from guide_test_context;
set local role authenticated;
do $$ declare n integer; begin
 select count(*) into n from public.trainer_exercise_guides;
 if n<>3 then raise exception 'Trainer cannot see all own guides';end if;
 insert into public.trainer_exercise_guides(trainer_id,exercise_id,client_id,instructions)
  select trainer_id,exercise_id,null,'Updated shared fixture' from guide_test_context
  on conflict(trainer_id,exercise_id,client_id) do update set instructions=excluded.instructions;
 if (select count(*) from public.trainer_exercise_guides)<>3 then raise exception 'Nullable scope upsert duplicates rows';end if;
 begin
  insert into public.trainer_exercise_guides(trainer_id,exercise_id,client_id,instructions)
   select trainer_id,exercise_id,outsider,'Unlinked client fixture' from guide_test_context;
  raise exception 'Unlinked client assignment allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
