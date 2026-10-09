-- Close direct anonymous/authenticated access to the data tables.
--
-- Migrations 0001/0002 let the public anon key read every column of `feedback` and `votes`
-- (including submitter_email / voter_email) and insert rows directly through PostgREST, which
-- skips Turnstile, the honeypot and rate limiting. The application never uses that path: every
-- read and write goes through API Routes that hold the service-role key (see docs/ARCHITECTURE.md),
-- and the browser/server Supabase clients are used for admin authentication only.
--
-- RLS stays enabled with no policies, so any role without BYPASSRLS is denied by default.
-- service_role is unaffected.

drop policy if exists "anon can read feedback" on public.feedback;
drop policy if exists "anon can submit feedback" on public.feedback;
drop policy if exists "anon can read votes" on public.votes;
drop policy if exists "anon can vote" on public.votes;
drop policy if exists "anon can read replies" on public.replies;
drop policy if exists "anon can read products" on public.products;

revoke all on public.products, public.feedback, public.votes, public.replies
  from anon, authenticated;

-- Supabase grants anon/authenticated on every new table in `public` by default. Turn that off
-- so a future table is private until a migration deliberately opens it.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
