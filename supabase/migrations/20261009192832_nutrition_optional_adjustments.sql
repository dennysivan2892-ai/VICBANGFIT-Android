-- Empty defaults keep existing/basic diets unchanged. Existing trainer ownership RLS applies.
alter table public.nutrition_plans add column food_rules jsonb not null default '{}'::jsonb;
alter table public.nutrition_meals add column food_rules jsonb not null default '{}'::jsonb;
alter table public.nutrition_plans add constraint nutrition_plan_rules_object check (jsonb_typeof(food_rules) = 'object' and octet_length(food_rules::text) <= 20000);
alter table public.nutrition_meals add constraint nutrition_meal_rules_object check (jsonb_typeof(food_rules) = 'object' and octet_length(food_rules::text) <= 20000);
