create table public.trainer_public_profiles (
 trainer_id uuid primary key references public.profiles(id) on delete cascade,
 display_name text not null check (length(display_name) between 1 and 100),
 bio text not null default '' check (length(bio)<=2000),
 specialties text not null default '' check (length(specialties)<=250),
 contact_phone text not null default '' check (length(contact_phone)<=40),
 avatar_path text,
 updated_at timestamptz not null default now(),
 check (avatar_path is null or avatar_path = trainer_id::text || '/trainer-avatar.jpg')
);
alter table public.trainer_public_profiles enable row level security;
grant select,insert,update on public.trainer_public_profiles to authenticated;
create policy trainer_profile_read on public.trainer_public_profiles for select to authenticated using (
 trainer_id=(select auth.uid()) or app_private.is_admin() or exists (
 select 1 from public.trainer_clients tc where tc.trainer_id=trainer_public_profiles.trainer_id and tc.client_id=(select auth.uid()) and tc.status='active'));
create policy trainer_profile_insert on public.trainer_public_profiles for insert to authenticated with check (trainer_id=(select auth.uid()) and app_private.is_trainer());
create policy trainer_profile_update on public.trainer_public_profiles for update to authenticated using (trainer_id=(select auth.uid()) and app_private.is_trainer()) with check (trainer_id=(select auth.uid()) and app_private.is_trainer());
create table public.trainer_payment_records (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.profiles(id) on delete cascade,
 amount numeric(10,2) not null check (amount>=0),
 currency text not null default 'EUR' check (currency='EUR'),
 due_date date not null,
 status text not null default 'pending' check (status in ('pending','paid')),
 paid_at date,
 notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((status='paid' and paid_at is not null) or (status='pending' and paid_at is null))
);
create index trainer_payments_trainer_due on public.trainer_payment_records(trainer_id,due_date desc);
alter table public.trainer_payment_records enable row level security;
grant select,insert,update on public.trainer_payment_records to authenticated;
create policy trainer_payments_admin on public.trainer_payment_records for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin() and exists (select 1 from public.profiles p where p.id=trainer_payment_records.trainer_id and p.role='trainer'));
create policy trainer_avatar_client_read on storage.objects for select to authenticated using (
 bucket_id='profile-photos' and exists (select 1 from public.trainer_public_profiles tp where tp.avatar_path=objects.name)
);
