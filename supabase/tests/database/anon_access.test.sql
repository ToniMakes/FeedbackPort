-- Regression test: the public anon key and logged-in (authenticated) users must have no direct
-- access to the data tables. All reads/writes go through API Routes using the service-role key.
-- Run with: npx supabase test db
begin;
select plan(18);


-- Table-level privileges
select is(has_table_privilege('anon', 'public.feedback', 'select'), false, 'anon cannot select feedback');
select is(has_table_privilege('anon', 'public.feedback', 'insert'), false, 'anon cannot insert feedback');
select is(has_table_privilege('anon', 'public.votes', 'select'), false, 'anon cannot select votes');
select is(has_table_privilege('anon', 'public.votes', 'insert'), false, 'anon cannot insert votes');
select is(has_table_privilege('anon', 'public.replies', 'select'), false, 'anon cannot select replies');
select is(has_table_privilege('anon', 'public.products', 'select'), false, 'anon cannot select products');
select is(has_table_privilege('authenticated', 'public.feedback', 'select'), false, 'authenticated cannot select feedback');
select is(has_table_privilege('authenticated', 'public.votes', 'select'), false, 'authenticated cannot select votes');

-- Column-level: the email columns specifically
select is(has_column_privilege('anon', 'public.feedback', 'submitter_email', 'select'), false, 'anon cannot read submitter_email');
select is(has_column_privilege('anon', 'public.votes', 'voter_email', 'select'), false, 'anon cannot read voter_email');

-- RLS stays on, with no policies that would reopen access
select is((select relrowsecurity from pg_class where oid = 'public.feedback'::regclass), true, 'RLS enabled on feedback');
select is((select relrowsecurity from pg_class where oid = 'public.votes'::regclass), true, 'RLS enabled on votes');
select is((select relrowsecurity from pg_class where oid = 'public.replies'::regclass), true, 'RLS enabled on replies');
select is((select relrowsecurity from pg_class where oid = 'public.products'::regclass), true, 'RLS enabled on products');
select is((select count(*)::int from pg_policies where schemaname = 'public'), 0, 'no RLS policies on public tables');

-- service_role keeps full access
select is(has_table_privilege('service_role', 'public.feedback', 'select'), true, 'service_role can select feedback');
select is(has_table_privilege('service_role', 'public.feedback', 'insert'), true, 'service_role can insert feedback');

-- New tables are private by default
create table public.__default_privilege_probe (id int);
select is(has_table_privilege('anon', 'public.__default_privilege_probe', 'select'), false, 'new tables are not granted to anon by default');

select * from finish();
rollback;
