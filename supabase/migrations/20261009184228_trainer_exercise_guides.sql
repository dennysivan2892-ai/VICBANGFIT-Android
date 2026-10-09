-- Each trainer owns independent shared guides and optional client adaptations.
create table public.trainer_exercise_guides (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.profiles(id) on delete cascade,
 exercise_id uuid not null references public.exercises(id) on delete cascade,
 client_id uuid references public.profiles(id) on delete cascade,
 instructions text not null default '' check (length(instructions)<=12000),
 common_errors text not null default '' check (length(common_errors)<=6000),
 video_url text check (video_url is null or video_url ~ '^https://'),
 video_path text,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique nulls not distinct (trainer_id,exercise_id,client_id),
 check (video_path is null or video_path like trainer_id::text || '/' || exercise_id::text || '/%'),
 check (video_url is null or video_path is null)
);
create index trainer_exercise_guides_exercise_idx on public.trainer_exercise_guides(exercise_id);
create index trainer_exercise_guides_client_idx on public.trainer_exercise_guides(client_id) where client_id is not null;
create index trainer_exercise_guides_video_idx on public.trainer_exercise_guides(video_path) where video_path is not null;
alter table public.trainer_exercise_guides enable row level security;
revoke all on public.trainer_exercise_guides from anon;
grant select,insert,update,delete on public.trainer_exercise_guides to authenticated;
create policy "guide participant read" on public.trainer_exercise_guides for select to authenticated
 using (trainer_id=(select auth.uid()) or (
  (client_id is null or client_id=(select auth.uid())) and exists (
   select 1 from public.trainer_clients tc where tc.trainer_id=trainer_exercise_guides.trainer_id
    and tc.client_id=(select auth.uid()) and tc.status='active'
  )
 ));
create policy "guide trainer insert" on public.trainer_exercise_guides for insert to authenticated
 with check (trainer_id=(select auth.uid()) and app_private.is_trainer()
  and (client_id is null or exists(select 1 from public.trainer_clients tc where tc.trainer_id=(select auth.uid()) and tc.client_id=trainer_exercise_guides.client_id and tc.status='active'))
  and exists(select 1 from public.exercises e where e.id=exercise_id and (e.is_global or e.trainer_id=(select auth.uid()))));
create policy "guide trainer update" on public.trainer_exercise_guides for update to authenticated
 using (trainer_id=(select auth.uid()) and app_private.is_trainer())
 with check (trainer_id=(select auth.uid()) and app_private.is_trainer()
  and (client_id is null or exists(select 1 from public.trainer_clients tc where tc.trainer_id=(select auth.uid()) and tc.client_id=trainer_exercise_guides.client_id and tc.status='active'))
  and exists(select 1 from public.exercises e where e.id=exercise_id and (e.is_global or e.trainer_id=(select auth.uid()))));
create policy "guide trainer delete" on public.trainer_exercise_guides for delete to authenticated
 using (trainer_id=(select auth.uid()) and app_private.is_trainer());

-- Linked clients also need the names of their trainer's non-global exercises.
create policy "exercise linked client read" on public.exercises for select to authenticated
 using (exists(select 1 from public.trainer_clients tc where tc.trainer_id=exercises.trainer_id and tc.client_id=(select auth.uid()) and tc.status='active'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('exercise-guide-videos','exercise-guide-videos',false,52428800,array['video/mp4','video/webm','video/quicktime']);
create policy "guide video trainer upload" on storage.objects for insert to authenticated
 with check (bucket_id='exercise-guide-videos' and (storage.foldername(name))[1]=(select auth.uid())::text and app_private.is_trainer());
create policy "guide video participant read" on storage.objects for select to authenticated
 using (bucket_id='exercise-guide-videos' and (
  ((storage.foldername(name))[1]=(select auth.uid())::text and app_private.is_trainer())
  or exists(select 1 from public.trainer_exercise_guides g where g.video_path=name)
 ));
create policy "guide video trainer delete" on storage.objects for delete to authenticated
 using (bucket_id='exercise-guide-videos' and (storage.foldername(name))[1]=(select auth.uid())::text and app_private.is_trainer());
-- Uploads always use a new UUID path, so object UPDATE/upsert is intentionally unnecessary.
