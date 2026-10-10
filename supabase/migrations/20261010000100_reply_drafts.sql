-- AI-drafted replies awaiting human review; see docs/decisions/0008-mcp-server-design.md.
--
-- A draft is NOT a reply: it is never written to `replies`, so the notify-submitter webhook
-- never fires for it. Only `publish_reply_draft` (service_role, called from the admin console)
-- turns a draft into a reply, atomically and at most once.

create table public.reply_drafts (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  rationale text check (char_length(rationale) <= 500),
  contains_links boolean not null default false,
  source text not null default 'mcp',
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  published_reply_id uuid references public.replies(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index idx_reply_drafts_feedback on public.reply_drafts(feedback_id, status);
create index idx_reply_drafts_pending on public.reply_drafts(created_at) where status = 'pending';

alter table public.reply_drafts enable row level security;

revoke all on public.reply_drafts from public, anon, authenticated;
grant all on public.reply_drafts to service_role;

-- The agent may read drafts and insert new ones (only these columns); it can never update or delete.
grant select on public.reply_drafts to mcp_agent;
grant insert (feedback_id, body, rationale) on public.reply_drafts to mcp_agent;
create policy "mcp_agent reads drafts" on public.reply_drafts
  for select to mcp_agent using (true);
create policy "mcp_agent inserts pending drafts" on public.reply_drafts
  for insert to mcp_agent with check (status = 'pending' and source = 'mcp');

-- Enforced here, not in the tool layer: link detection and queue limits cannot be skipped by a
-- buggy or manipulated client.
create or replace function private.reply_drafts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.contains_links := new.body ~* '(https?://|ftp://|www\.|javascript:|data:|mailto:|\]\(|[a-z0-9-]+\.(com|net|org|io|app|dev|cn|co|ai|me|xyz|ly|gg|info|biz)\M)';

  if (select count(*) from public.reply_drafts d
      where d.feedback_id = new.feedback_id and d.status = 'pending') >= 3 then
    raise exception 'too many pending drafts for this feedback (max 3)' using errcode = 'P0001';
  end if;

  if (select count(*) from public.reply_drafts d where d.status = 'pending') >= 50 then
    raise exception 'draft review queue is full (max 50 pending)' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
revoke all on function private.reply_drafts_before_insert() from public, anon, authenticated;

create trigger reply_drafts_before_insert
  before insert on public.reply_drafts
  for each row execute function private.reply_drafts_before_insert();

-- Publish a pending draft as an admin reply. The status flip is the lock: a second call finds
-- no pending row and returns null, so double clicks or two tabs produce exactly one reply.
create or replace function public.publish_reply_draft(draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.reply_drafts;
  new_reply_id uuid;
begin
  update public.reply_drafts
  set status = 'published', reviewed_at = now()
  where id = draft_id and status = 'pending'
  returning * into d;

  if not found then
    return null;
  end if;

  insert into public.replies (feedback_id, body, is_admin)
  values (d.feedback_id, d.body, true)
  returning id into new_reply_id;

  update public.reply_drafts set published_reply_id = new_reply_id where id = draft_id;
  return new_reply_id;
end;
$$;
revoke all on function public.publish_reply_draft(uuid) from public, anon, authenticated, mcp_agent;
grant execute on function public.publish_reply_draft(uuid) to service_role;

-- Reject a pending draft; returns false if it was not pending.
create or replace function public.reject_reply_draft(draft_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with r as (
    update public.reply_drafts
    set status = 'rejected', reviewed_at = now()
    where id = draft_id and status = 'pending'
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke all on function public.reject_reply_draft(uuid) from public, anon, authenticated, mcp_agent;
grant execute on function public.reject_reply_draft(uuid) to service_role;
