-- Add GRANTs: migration 0001 only wrote RLS policies and didn't explicitly grant table-level privileges.
-- RLS policies decide which rows a role can touch; GRANT decides whether it can touch the table at all. You need both.
-- On some Supabase project configurations service_role doesn't automatically get privileges on new tables;
-- see docs/DATA_MODEL.md. This migration makes that implicit dependency explicit.

grant usage on schema public to service_role, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- The anon/authenticated privileges mirror the RLS policies in migration 0001:
-- read everything, insert into feedback/votes, never change status or write is_admin=true replies
grant select on public.products to anon, authenticated;
grant select, insert on public.feedback to anon, authenticated;
grant select, insert on public.votes to anon, authenticated;
grant select on public.replies to anon, authenticated;
