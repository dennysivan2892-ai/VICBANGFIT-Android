create table public.nutrition_revisions (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
 trainer_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 before_plan jsonb not null,
 after_plan jsonb not null
);
create index nutrition_revisions_plan_date on public.nutrition_revisions(plan_id,created_at desc);
alter table public.nutrition_revisions enable row level security;
revoke all on public.nutrition_revisions from anon,authenticated;
grant select,insert on public.nutrition_revisions to authenticated;
create policy trainer_read on public.nutrition_revisions for select to authenticated using (trainer_id=(select auth.uid()));
create policy trainer_append on public.nutrition_revisions for insert to authenticated with check (trainer_id=(select auth.uid()) and exists(select 1 from public.nutrition_plans p where p.id=plan_id and p.trainer_id=(select auth.uid())));
create or replace function public.save_nutrition_revision(p_plan_id uuid,p_plan jsonb,p_meals jsonb) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare old_plan public.nutrition_plans; before_data jsonb; after_data jsonb; meal jsonb; food jsonb; mid uuid; kept uuid[]='{}';
begin
 select * into old_plan from public.nutrition_plans where id=p_plan_id and trainer_id=auth.uid() for update;
 if not found then raise exception 'Dieta no encontrada o sin permiso'; end if;
 if jsonb_array_length(p_meals)=0 then raise exception 'La dieta necesita comidas'; end if;
 select to_jsonb(old_plan)||jsonb_build_object('meals',coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('foods',(select coalesce(jsonb_agg(to_jsonb(f) order by f.food_order),'[]') from public.nutrition_foods f where f.meal_id=m.id)) order by m.meal_order),'[]')) into before_data from public.nutrition_meals m where m.plan_id=p_plan_id;
 for meal in select value from jsonb_array_elements(p_meals) loop
  mid=nullif(meal->>'id','')::uuid;
  if mid is not null then
   if not exists(select 1 from public.nutrition_meals where id=mid and plan_id=p_plan_id) then raise exception 'La comida ha cambiado. Vuelve a abrir la dieta'; end if;
   update public.nutrition_meals set name=meal->>'name',meal_order=(meal->>'order')::int,target_time=nullif(meal->>'time','')::time,notes=meal->>'notes',food_rules=meal->'food_rules' where id=mid;
   delete from public.nutrition_foods where meal_id=mid;
  else
   insert into public.nutrition_meals(plan_id,name,meal_order,target_time,notes,food_rules) values(p_plan_id,meal->>'name',(meal->>'order')::int,nullif(meal->>'time','')::time,meal->>'notes',meal->'food_rules') returning id into mid;
  end if;
  kept=array_append(kept,mid);
  for food in select value from jsonb_array_elements(meal->'foods') loop
   insert into public.nutrition_foods(meal_id,food_order,food_name,amount,unit,prepared_amount,prepared_unit) values(mid,coalesce((food->>'food_order')::int,1),food->>'food_name',(food->>'amount')::numeric,food->>'unit',(food->>'prepared_amount')::numeric,food->>'prepared_unit');
  end loop;
 end loop;
 if exists(select 1 from public.nutrition_meal_logs l join public.nutrition_meals m on m.id=l.meal_id where m.plan_id=p_plan_id and not(m.id=any(kept))) then raise exception 'No puedes eliminar una comida con registros'; end if;
 delete from public.nutrition_foods where meal_id in(select id from public.nutrition_meals where plan_id=p_plan_id and not(id=any(kept)));
 delete from public.nutrition_meals where plan_id=p_plan_id and not(id=any(kept));
 update public.nutrition_plans set name=p_plan->>'name',target_calories=(p_plan->>'target_calories')::int,target_protein_g=(p_plan->>'target_protein_g')::numeric,target_carbs_g=(p_plan->>'target_carbs_g')::numeric,target_fat_g=(p_plan->>'target_fat_g')::numeric,notes=p_plan->>'notes',food_rules=p_plan->'food_rules',status='active',updated_at=now() where id=p_plan_id;
 select to_jsonb(p)||jsonb_build_object('meals',(select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('foods',(select coalesce(jsonb_agg(to_jsonb(f) order by f.food_order),'[]') from public.nutrition_foods f where f.meal_id=m.id)) order by m.meal_order),'[]') from public.nutrition_meals m where m.plan_id=p.id)) into after_data from public.nutrition_plans p where p.id=p_plan_id;
 insert into public.nutrition_revisions(plan_id,trainer_id,before_plan,after_plan) values(p_plan_id,auth.uid(),before_data,after_data);
 update public.nutrition_plans set status='archived' where client_id=old_plan.client_id and trainer_id=auth.uid() and status='active' and id<>p_plan_id;
end $$;
revoke all on function public.save_nutrition_revision(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_nutrition_revision(uuid,jsonb,jsonb) to authenticated;
