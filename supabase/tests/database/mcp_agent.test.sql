-- The MCP server connects as `mcp_agent`. These tests pin down what that role can and cannot do,
-- so the capability boundary is enforced by the database rather than by the tool layer.
-- Run with: npx supabase test db
begin;
select plan(29);

-- Lets the test session switch to the role; rolled back with the transaction
grant mcp_agent to current_user;

-- Runs one statement as mcp_agent and returns its first column as text, or 'ERR:<sqlstate>'.
-- Assertions themselves always run as the test user, so pgTAP keeps working.
create function pg_temp.as_agent(q text) returns text
language plpgsql as $$
declare
  result text;
begin
  set local role mcp_agent;
  execute q into result;
  reset role;
  return result;
exception when others then
  reset role;
  return 'ERR:' || sqlstate;
end;
$$;

-- Fixture: one product, feedback with a known email, one vote, one reply
insert into public.products (id, slug, name) values ('00000000-0000-0000-0000-0000000000a1', 'mcp-test', 'MCP Test');
insert into public.feedback (id, product_id, title, body, submitter_email)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Needs export', 'Please add CSV export', 'secret.person@example.com');
insert into public.votes (feedback_id, voter_email)
values ('00000000-0000-0000-0000-0000000000b1', 'voter.secret@example.com');
insert into public.replies (feedback_id, body, is_admin)
values ('00000000-0000-0000-0000-0000000000b1', 'Thanks, noted', true);

-- No privileges on any public data table
select is(has_table_privilege('mcp_agent', 'public.feedback', 'select'), false, 'mcp_agent cannot select public.feedback');
select is(has_table_privilege('mcp_agent', 'public.votes', 'select'), false, 'mcp_agent cannot select public.votes');
select is(has_table_privilege('mcp_agent', 'public.replies', 'select'), false, 'mcp_agent cannot select public.replies');
select is(has_table_privilege('mcp_agent', 'public.products', 'select'), false, 'mcp_agent cannot select public.products');
select is(has_table_privilege('mcp_agent', 'public.feedback', 'update'), false, 'mcp_agent cannot update feedback');
select is(has_table_privilege('mcp_agent', 'public.replies', 'insert'), false, 'mcp_agent cannot insert replies');
select is(has_table_privilege('mcp_agent', 'public.reply_drafts', 'update'), false, 'mcp_agent cannot update drafts');
select is(has_table_privilege('mcp_agent', 'public.reply_drafts', 'delete'), false, 'mcp_agent cannot delete drafts');
select is(has_schema_privilege('mcp_agent', 'private', 'usage'), false, 'mcp_agent cannot use the private schema');
select is(has_function_privilege('mcp_agent', 'public.publish_reply_draft(uuid)', 'execute'), false, 'mcp_agent cannot publish drafts');
select is(has_function_privilege('mcp_agent', 'public.reject_reply_draft(uuid)', 'execute'), false, 'mcp_agent cannot reject drafts');

-- The agent-facing views contain no email columns
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'mcp' and column_name ~* 'email'),
  0,
  'no mcp view exposes an email column'
);

-- Reads through the views
select is(pg_temp.as_agent($$select count(*) from mcp.feedback where product_slug = 'mcp-test'$$), '1', 'mcp_agent can read mcp.feedback');
select is(pg_temp.as_agent($$select vote_count from mcp.feedback where product_slug = 'mcp-test'$$), '1', 'vote_count is aggregated');
select is(pg_temp.as_agent($$select admin_reply_count from mcp.feedback where product_slug = 'mcp-test'$$), '1', 'admin_reply_count is aggregated');
select matches(
  pg_temp.as_agent($$select submitter_ref from mcp.feedback where product_slug = 'mcp-test'$$),
  '^[0-9a-f]{8}$',
  'submitter_ref is an 8-char hex pseudonym'
);
select isnt(
  pg_temp.as_agent($$select submitter_ref from mcp.feedback where product_slug = 'mcp-test'$$),
  'secret.p',
  'submitter_ref is not a slice of the email'
);

-- Everything outside the views is denied
select is(pg_temp.as_agent('select count(*) from public.feedback'), 'ERR:42501', 'direct select on public.feedback is denied');
select is(pg_temp.as_agent('select count(*) from private.mcp_settings'), 'ERR:42501', 'the salt table is unreadable');
select is(pg_temp.as_agent($$update public.feedback set status = 'done' returning 'x'$$), 'ERR:42501', 'mcp_agent cannot change status');

-- Drafts: insert allowed, link detection and queue limits enforced by the database
select is(
  pg_temp.as_agent($$insert into public.reply_drafts (feedback_id, body, rationale)
    values ('00000000-0000-0000-0000-0000000000b1', 'Thanks, we will look into CSV export.', 'asks for export') returning 'ok'$$),
  'ok',
  'mcp_agent can insert a draft'
);
select is(
  (select contains_links from public.reply_drafts where body like 'Thanks, we will%'),
  false,
  'plain draft has contains_links = false'
);
select is(
  pg_temp.as_agent($$insert into public.reply_drafts (feedback_id, body)
    values ('00000000-0000-0000-0000-0000000000b1', 'See example.com/help for details') returning 'ok'$$),
  'ok',
  'draft with a bare domain is accepted'
);
select is(
  (select contains_links from public.reply_drafts where body like 'See example.com%'),
  true,
  'bare domain is flagged as a link'
);
select is(
  pg_temp.as_agent($$insert into public.reply_drafts (feedback_id, body, contains_links, status)
    values ('00000000-0000-0000-0000-0000000000b1', 'x', false, 'published') returning 'ok'$$),
  'ERR:42501',
  'mcp_agent cannot choose status or contains_links'
);
select is(
  pg_temp.as_agent($$insert into public.reply_drafts (feedback_id, body)
    values ('00000000-0000-0000-0000-0000000000b1', 'third draft') returning 'ok'$$),
  'ok',
  'third pending draft is accepted'
);
select is(
  pg_temp.as_agent($$insert into public.reply_drafts (feedback_id, body)
    values ('00000000-0000-0000-0000-0000000000b1', 'fourth draft') returning 'ok'$$),
  'ERR:P0001',
  'fourth pending draft for one feedback is rejected'
);

-- Publishing is atomic and happens at most once
select isnt(
  (select public.publish_reply_draft((select id from public.reply_drafts where body = 'third draft'))),
  null,
  'publish_reply_draft returns the new reply id'
);
select is(
  (select public.publish_reply_draft((select id from public.reply_drafts where body = 'third draft'))),
  null,
  'publishing the same draft twice creates no second reply'
);

select * from finish();
rollback;
