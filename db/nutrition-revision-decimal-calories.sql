-- Food exclusions can produce fractional kcal. Normalize at the RPC boundary;
-- keep the existing invoker permissions, ownership checks and atomic history.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.save_nutrition_revision(uuid,jsonb,jsonb)'::regprocedure) into definition;
 if position('target_calories=(p_plan->>''target_calories'')::int' in definition)>0 then
  definition=replace(definition,'target_calories=(p_plan->>''target_calories'')::int','target_calories=round((p_plan->>''target_calories'')::numeric)::int');
  execute definition;
 elsif position('target_calories=round((p_plan->>''target_calories'')::numeric)::int' in definition)=0 then
  raise exception 'Unexpected nutrition revision definition; inspect before patching';
 end if;
end $patch$;
