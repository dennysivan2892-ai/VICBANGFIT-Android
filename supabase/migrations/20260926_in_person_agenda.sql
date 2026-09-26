-- VICBANGFIT · agenda sencilla de entrenamientos presenciales
alter table public.trainer_clients
  add column if not exists service_in_person boolean not null default false;

create table if not exists public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 60 check (slot_minutes in (45,60,90)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.in_person_appointments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes in (45,60,90)),
  status text not null default 'requested' check (status in ('requested','confirmed','change_proposed','cancelled','completed')),
  requested_by text not null check (requested_by in ('client','trainer')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index if not exists trainer_availability_trainer_weekday_idx on public.trainer_availability(trainer_id,weekday) where is_active;
create index if not exists in_person_appointments_trainer_start_idx on public.in_person_appointments(trainer_id,starts_at);
create index if not exists in_person_appointments_client_start_idx on public.in_person_appointments(client_id,starts_at);

alter table public.trainer_availability enable row level security;
alter table public.in_person_appointments enable row level security;

revoke all on public.trainer_availability from anon;
revoke all on public.in_person_appointments from anon;
grant select, insert, update on public.trainer_availability to authenticated;
grant select, insert, update on public.in_person_appointments to authenticated;

drop policy if exists "availability trainer manage" on public.trainer_availability;
create policy "availability trainer manage" on public.trainer_availability for all to authenticated
  using (trainer_id=auth.uid()) with check (trainer_id=auth.uid());

drop policy if exists "availability enabled clients read" on public.trainer_availability;
create policy "availability enabled clients read" on public.trainer_availability for select to authenticated
  using (exists(select 1 from public.trainer_clients tc where tc.trainer_id=trainer_availability.trainer_id and tc.client_id=auth.uid() and tc.status='active' and tc.service_in_person=true));

drop policy if exists "appointments participants read" on public.in_person_appointments;
create policy "appointments participants read" on public.in_person_appointments for select to authenticated
  using (trainer_id=auth.uid() or client_id=auth.uid());

drop policy if exists "appointments enabled client request" on public.in_person_appointments;
create policy "appointments enabled client request" on public.in_person_appointments for insert to authenticated
  with check (client_id=auth.uid() and requested_by='client' and status='requested' and exists(select 1 from public.trainer_clients tc where tc.trainer_id=in_person_appointments.trainer_id and tc.client_id=auth.uid() and tc.status='active' and tc.service_in_person=true));

drop policy if exists "appointments trainer create" on public.in_person_appointments;
create policy "appointments trainer create" on public.in_person_appointments for insert to authenticated
  with check (trainer_id=auth.uid() and requested_by='trainer' and exists(select 1 from public.trainer_clients tc where tc.trainer_id=auth.uid() and tc.client_id=in_person_appointments.client_id and tc.status='active' and tc.service_in_person=true));

drop policy if exists "appointments trainer update" on public.in_person_appointments;
create policy "appointments trainer update" on public.in_person_appointments for update to authenticated
  using (trainer_id=auth.uid()) with check (trainer_id=auth.uid());

drop policy if exists "appointments client update" on public.in_person_appointments;
create policy "appointments client update" on public.in_person_appointments for update to authenticated
  using (client_id=auth.uid()) with check (client_id=auth.uid() and status in ('confirmed','cancelled'));

-- Un cliente solo puede aceptar un cambio o cancelar; no puede mover la cita
-- ni modificar entrenador, duración, notas o propietario mediante la API.
create schema if not exists private;
revoke all on schema private from public;
create or replace function private.guard_client_appointment_update()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (select auth.uid()) = old.client_id and (select auth.uid()) <> old.trainer_id then
    if new.trainer_id is distinct from old.trainer_id
      or new.client_id is distinct from old.client_id
      or new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or new.duration_minutes is distinct from old.duration_minutes
      or new.requested_by is distinct from old.requested_by
      or new.notes is distinct from old.notes then
      raise exception 'El cliente no puede modificar los datos de la cita';
    end if;
    if new.status not in ('confirmed','cancelled') then
      raise exception 'Cambio de estado no permitido';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_client_appointment_update() from public;
drop trigger if exists guard_client_appointment_update on public.in_person_appointments;
create trigger guard_client_appointment_update before update on public.in_person_appointments
for each row execute function private.guard_client_appointment_update();
