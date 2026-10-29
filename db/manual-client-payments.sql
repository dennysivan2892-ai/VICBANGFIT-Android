-- Client access is independent of receipts. Existing receipts are retained for review.
alter table public.client_billing add column if not exists access_suspended boolean not null default false;
alter table public.client_billing add column if not exists billing_months integer not null default 1 check (billing_months in (1,3,6,12));
alter table public.payment_records add column if not exists collection_review_required boolean not null default false;
-- Existing manual confirmations may include access-only entries: do not count them until reviewed.
update public.payment_records set collection_review_required=true where status='paid' and stripe_invoice_id is null and stripe_payment_intent_id is null;
create table public.payment_corrections (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null references public.payment_records(id),
 trainer_id uuid not null references public.profiles(id),
 previous_record jsonb not null,
 action text not null check(action in ('confirmed','not_received')),
 created_at timestamptz not null default now()
);
alter table public.payment_corrections enable row level security;
grant select,insert on public.payment_corrections to authenticated;
create policy payment_corrections_own_read on public.payment_corrections for select to authenticated using (trainer_id=(select auth.uid()));
create policy payment_corrections_own_insert on public.payment_corrections for insert to authenticated with check (
 trainer_id=(select auth.uid()) and exists(select 1 from public.payment_records r where r.id=payment_id and r.trainer_id=(select auth.uid())));
create table public.trainer_revenue_goals (
 trainer_id uuid not null references public.profiles(id) on delete cascade,
 month date not null check (extract(day from month)=1),
 amount numeric(12,2) not null check(amount>=0),
 primary key(trainer_id,month)
);
alter table public.trainer_revenue_goals enable row level security;
grant select,insert,update on public.trainer_revenue_goals to authenticated;
create policy trainer_goals_read on public.trainer_revenue_goals for select to authenticated using(trainer_id=(select auth.uid()));
create policy trainer_goals_insert on public.trainer_revenue_goals for insert to authenticated with check(trainer_id=(select auth.uid()) and app_private.is_trainer());
create policy trainer_goals_update on public.trainer_revenue_goals for update to authenticated using(trainer_id=(select auth.uid())) with check(trainer_id=(select auth.uid()) and app_private.is_trainer());

-- Keep older installed clients working: their date check mirrors the manual switch.
create or replace function public.sync_manual_client_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.planning_access_until=case when new.access_suspended then '2000-01-01T00:00:00Z'::timestamptz else '9999-12-31T00:00:00Z'::timestamptz end;
 return new;
end; $$;
revoke all on function public.sync_manual_client_access() from public,anon,authenticated;
create trigger sync_manual_client_access before insert or update on public.client_billing for each row execute function public.sync_manual_client_access();
drop trigger if exists trg_extend_planning_access_on_paid_payment on public.payment_records;
update public.client_billing set planning_access_until='9999-12-31T00:00:00Z';
create or replace function app_private.client_has_planning_access(target_client uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.client_billing b where b.client_id=target_client and b.access_suspended);
$$;

-- Atomic receipt recording: a retry cannot create a second receipt or skip another period.
create or replace function public.record_client_receipt(p_record uuid,p_amount numeric,p_paid_date date,p_method text,p_notes text,p_next_due date) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.payment_records; b public.client_billing;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 select * into r from public.payment_records where id=p_record and trainer_id=auth.uid() for update;
 if not found then raise exception 'Cobro no disponible'; end if;
 select * into b from public.client_billing where id=r.billing_id and trainer_id=auth.uid() for update;
 if not found then raise exception 'Cuota no disponible'; end if;
 if r.status='paid' then return; end if;
 if r.status<>'pending' or p_amount<=0 or p_amount is null or p_paid_date is null or p_paid_date>(now() at time zone 'Europe/Madrid')::date or p_next_due is null or p_next_due<=r.due_date then raise exception 'Revisa importe, fecha de cobro y siguiente vencimiento'; end if;
 update public.payment_records set status='paid',amount=p_amount,paid_at=(p_paid_date+time '12:00') at time zone 'Europe/Madrid',payment_method=p_method,notes=p_notes,collection_review_required=false,updated_at=now() where id=r.id;
 update public.client_billing set next_due_date=greatest(coalesce(next_due_date,p_next_due),p_next_due),updated_at=now() where id=b.id;
 insert into public.payment_records(billing_id,trainer_id,client_id,amount,due_date,status) values(b.id,b.trainer_id,b.client_id,b.monthly_fee,p_next_due,'pending') on conflict(billing_id,due_date) do nothing;
end; $$;
revoke all on function public.record_client_receipt(uuid,numeric,date,text,text,date) from public,anon;
grant execute on function public.record_client_receipt(uuid,numeric,date,text,text,date) to authenticated;

create or replace function public.review_client_receipt(p_record uuid,p_received boolean) returns void language plpgsql security invoker set search_path='' as $$
declare r public.payment_records;
begin
 if auth.uid() is null then raise exception 'No autorizado'; end if;
 select * into r from public.payment_records where id=p_record and trainer_id=auth.uid() for update;
 if not found or r.status<>'paid' then raise exception 'Cobro no disponible'; end if;
 insert into public.payment_corrections(payment_id,trainer_id,previous_record,action) values(r.id,auth.uid(),to_jsonb(r),case when p_received then 'confirmed' else 'not_received' end);
 update public.payment_records set status=case when p_received then 'paid' else 'pending' end,paid_at=case when p_received then paid_at else null end,payment_method=case when p_received then payment_method else null end,collection_review_required=false,updated_at=now() where id=r.id;
 -- This correction deliberately leaves access and subsequent scheduled instalments unchanged.
end; $$;
revoke all on function public.review_client_receipt(uuid,boolean) from public,anon;
grant execute on function public.review_client_receipt(uuid,boolean) to authenticated;

create or replace function public.client_revenue_summary(p_month date) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'received',coalesce(sum(amount) filter(where status='paid' and not collection_review_required and (paid_at at time zone 'Europe/Madrid')::date>=p_month and (paid_at at time zone 'Europe/Madrid')::date<(p_month+interval '1 month')::date),0),
 'receipts',count(*) filter(where status='paid' and not collection_review_required and (paid_at at time zone 'Europe/Madrid')::date>=p_month and (paid_at at time zone 'Europe/Madrid')::date<(p_month+interval '1 month')::date),
 'pending',coalesce(sum(amount) filter(where status='pending' and due_date>=p_month and due_date<(p_month+interval '1 month')::date),0),
 'pending_count',count(*) filter(where status='pending' and due_date>=p_month and due_date<(p_month+interval '1 month')::date),
 'overdue_count',count(*) filter(where status='pending' and due_date<(now() at time zone 'Europe/Madrid')::date),
 'review_amount',coalesce(sum(amount) filter(where status='paid' and collection_review_required),0),
 'review_count',count(*) filter(where status='paid' and collection_review_required))
 from public.payment_records where trainer_id=auth.uid();
$$;
revoke all on function public.client_revenue_summary(date) from public,anon;
grant execute on function public.client_revenue_summary(date) to authenticated;

create or replace function public.save_client_billing(p_client uuid,p_fee numeric,p_months integer,p_due date,p_status text,p_notes text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare b public.client_billing; r public.payment_records;
begin
 if auth.uid() is null or p_fee is null or p_fee<0 or p_months not in (1,3,6,12) or (p_status='active' and p_due is null) then raise exception 'Revisa cliente, importe, duración y vencimiento'; end if;
 insert into public.client_billing(trainer_id,client_id,monthly_fee,billing_months,currency,next_due_date,status,notes)
 values(auth.uid(),p_client,p_fee,p_months,'EUR',p_due,p_status,p_notes)
 on conflict(trainer_id,client_id) do update set monthly_fee=excluded.monthly_fee,billing_months=excluded.billing_months,next_due_date=excluded.next_due_date,status=excluded.status,notes=excluded.notes,updated_at=now()
 returning * into b;
 if p_status='active' then
  select * into r from public.payment_records where billing_id=b.id and status='pending' order by due_date limit 1 for update;
  if found then
   if exists(select 1 from public.payment_records where billing_id=b.id and due_date=p_due and id<>r.id) then raise exception 'Ya existe un registro para ese vencimiento. Selecciona otra fecha.'; end if;
   update public.payment_records set amount=p_fee,due_date=p_due,updated_at=now() where id=r.id;
  else
   if exists(select 1 from public.payment_records where billing_id=b.id and due_date=p_due) then raise exception 'Ya existe un cobro para ese vencimiento. Selecciona otra fecha.'; end if;
   insert into public.payment_records(billing_id,trainer_id,client_id,amount,due_date,status) values(b.id,b.trainer_id,b.client_id,p_fee,p_due,'pending');
  end if;
 end if;
 return b.id;
end; $$;
revoke all on function public.save_client_billing(uuid,numeric,integer,date,text,text) from public,anon;
grant execute on function public.save_client_billing(uuid,numeric,integer,date,text,text) to authenticated;
