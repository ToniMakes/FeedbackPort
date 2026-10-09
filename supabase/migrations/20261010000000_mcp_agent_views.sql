-- Read surface for the MCP server (packages/mcp); see docs/decisions/0008-mcp-server-design.md.
--
-- The MCP process connects as `mcp_agent`, a role with no privileges on any `public` table.
-- It can only select from the views in the `mcp` schema, which never expose email addresses:
-- submitters appear as a salted-hash `submitter_ref`. The salt lives in the `private` schema,
-- which `mcp_agent` cannot read; the views run with their owner's rights.
--
-- The role has no password here. Set one out of band (see docs/MCP.md):
--   alter role mcp_agent password '<generated>';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.mcp_settings (
  key text primary key,
  value text not null
);
revoke all on private.mcp_settings from public, anon, authenticated;
alter table private.mcp_settings enable row level security;

insert into private.mcp_settings (key, value)
values ('submitter_ref_salt', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mcp_agent') then
    create role mcp_agent login noinherit nocreatedb nocreaterole nosuperuser connection limit 5;
  end if;
end
$$;

alter role mcp_agent set statement_timeout = '5s';
alter role mcp_agent set idle_in_transaction_session_timeout = '10s';

create schema if not exists mcp;
revoke all on schema mcp from public, anon, authenticated;
grant usage on schema mcp to mcp_agent;

create or replace view mcp.products as
select p.id, p.slug, p.name, p.created_at
from public.products p;

create or replace view mcp.feedback as
select
  f.id,
  f.product_id,
  p.slug as product_slug,
  f.title,
  f.body,
  f.status,
  f.duplicate_of,
  f.created_at,
  f.updated_at,
  -- Stable, non-reversible pseudonym for the submitter: lets an agent tell "same person" without
  -- learning the address. Keyed with a secret salt so it cannot be brute-forced from a list of
  -- known addresses. Written inline on purpose: a function called from a view is checked against
  -- the caller's EXECUTE privilege, and exposing one would let the agent test guessed emails.
  -- Only built-in functions are used, so the agent needs no access to any extension schema.
  left(
    encode(
      sha256(convert_to(
        (select m.value from private.mcp_settings m where m.key = 'submitter_ref_salt') || ':' || lower(f.submitter_email),
        'UTF8'
      )),
      'hex'
    ),
    8
  ) as submitter_ref,
  (select count(*) from public.votes v where v.feedback_id = f.id)::int as vote_count,
  (select count(*) from public.replies r where r.feedback_id = f.id and r.is_admin)::int as admin_reply_count
from public.feedback f
join public.products p on p.id = f.product_id;

create or replace view mcp.replies as
select r.id, r.feedback_id, r.body, r.is_admin, r.created_at
from public.replies r;

grant select on mcp.products, mcp.feedback, mcp.replies to mcp_agent;
