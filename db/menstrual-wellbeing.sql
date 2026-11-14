-- Optional health diary, isolated from planning and AI payloads.
create table public.cycle_preferences (
 client_id uuid primary key references public.profiles(id) on delete cascade,
 consent_at timestamptz not null default now(),
 shared_trainer_id uuid references public.profiles(id) on delete set null,
 contraception text not null default 'unspecified' check (contraception in ('unspecified','none','hormonal','other'))
);
create table public.cycle_entries (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.cycle_preferences(client_id) on delete cascade,
 entry_date date not null check (entry_date <= current_date),
 period_start date check (period_start <= entry_date),
 period_end date check (period_end >= period_start and period_end <= entry_date),
 bloating smallint not null check (bloating between 0 and 3),
 pain smallint not null check (pain between 0 and 3),
 hunger smallint not null check (hunger between 1 and 5),
 energy smallint not null check (energy between 1 and 5),
 cravings smallint not null check (cravings between 0 and 3),
 weight_kg numeric(5,2) check (weight_kg between 20 and 400),
 waist_cm numeric(5,2) check (waist_cm between 30 and 250),
 notes text not null default '' check (length(notes)<=1000),
 updated_at timestamptz not null default now(),
 unique(client_id,entry_date),
 check (period_end is null or period_start is not null)
);
create table public.cycle_reviews (
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null references public.cycle_entries(id) on delete cascade,
 trainer_id uuid not null references public.profiles(id) on delete cascade,
 action text not null check(action in ('maintain','redistribute','sweet','review_deficit','lighter','refer')),
 notes text not null default '' check(length(notes)<=1000),
 created_at timestamptz not null default now()
);
create index cycle_entries_client_date on public.cycle_entries(client_id,entry_date desc);
create index cycle_reviews_entry on public.cycle_reviews(entry_id);
alter table public.cycle_preferences enable row level security;
alter table public.cycle_entries enable row level security;
alter table public.cycle_reviews enable row level security;
revoke all on public.cycle_preferences,public.cycle_entries,public.cycle_reviews from anon,authenticated;
grant select,insert,update,delete on public.cycle_preferences,public.cycle_entries to authenticated;
grant select,insert on public.cycle_reviews to authenticated;
create policy cycle_preferences_read on public.cycle_preferences for select to authenticated using(
 client_id=(select auth.uid()) or (shared_trainer_id=(select auth.uid()) and exists(select 1 from public.trainer_clients t where t.client_id=cycle_preferences.client_id and t.trainer_id=(select auth.uid()) and t.status='active')));
create policy cycle_preferences_insert on public.cycle_preferences for insert to authenticated with check(
 client_id=(select auth.uid()) and (shared_trainer_id is null or exists(select 1 from public.trainer_clients t where t.client_id=(select auth.uid()) and t.trainer_id=shared_trainer_id and t.status='active')));
create policy cycle_preferences_update on public.cycle_preferences for update to authenticated using(client_id=(select auth.uid())) with check(
 client_id=(select auth.uid()) and (shared_trainer_id is null or exists(select 1 from public.trainer_clients t where t.client_id=(select auth.uid()) and t.trainer_id=shared_trainer_id and t.status='active')));
create policy cycle_preferences_delete on public.cycle_preferences for delete to authenticated using(client_id=(select auth.uid()));
create policy cycle_entries_read on public.cycle_entries for select to authenticated using(
 client_id=(select auth.uid()) or exists(select 1 from public.cycle_preferences p join public.trainer_clients t on t.client_id=p.client_id and t.trainer_id=p.shared_trainer_id and t.status='active' where p.client_id=cycle_entries.client_id and p.shared_trainer_id=(select auth.uid())));
create policy cycle_entries_insert on public.cycle_entries for insert to authenticated with check(client_id=(select auth.uid()));
create policy cycle_entries_update on public.cycle_entries for update to authenticated using(client_id=(select auth.uid())) with check(client_id=(select auth.uid()));
create policy cycle_entries_delete on public.cycle_entries for delete to authenticated using(client_id=(select auth.uid()));
create policy cycle_reviews_read on public.cycle_reviews for select to authenticated using(exists(select 1 from public.cycle_entries e where e.id=entry_id and (e.client_id=(select auth.uid()) or trainer_id=(select auth.uid()))));
create policy cycle_reviews_insert on public.cycle_reviews for insert to authenticated with check(
 trainer_id=(select auth.uid()) and exists(select 1 from public.cycle_entries e join public.cycle_preferences p on p.client_id=e.client_id join public.trainer_clients t on t.client_id=e.client_id and t.trainer_id=p.shared_trainer_id and t.status='active' where e.id=entry_id and p.shared_trainer_id=(select auth.uid())));
