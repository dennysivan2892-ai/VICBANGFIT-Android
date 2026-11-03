-- Proposed fix; NOT applied or verified in production.
-- RLS stays enabled. Existing trainer write policies remain unchanged.
-- Each payment-gate predicate implies the participant predicate on the same table.
-- Preserve that stricter predicate once, rather than expanding both through all parents.
-- Apply in a transaction; verify trainer writes, own-client reads, suspended-client
-- denial and unrelated-client denial before deployment.
BEGIN;
do $fix$ declare t text; gate text; begin
foreach t in array array['routines','workout_days','workout_exercises','workout_sets'] loop
select qual into strict gate from pg_policies where schemaname='public' and tablename=t and policyname=t||'_planning_payment_gate' and permissive='RESTRICTIVE' and cmd='SELECT';
execute format('alter policy %I on public.%I using (%s)',t||'_select_participants',t,replace(gate,'auth.uid()','(select auth.uid())'));
execute format('drop policy %I on public.%I',t||'_planning_payment_gate',t);
end loop; end $fix$;
COMMIT;
