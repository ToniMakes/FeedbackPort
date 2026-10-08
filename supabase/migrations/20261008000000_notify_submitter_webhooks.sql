-- Install repeatable, project-aware Database Webhooks for notify-submitter.
-- The endpoint URL and shared secret are stored per project in Supabase Vault
-- by infra/Configure-SupabaseDatabaseWebhooks.ps1, never in this migration.

create extension if not exists pg_net;

create or replace function public.notify_submitter_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
  webhook_secret text;
  event_payload jsonb;
begin
  -- Feedback status changes are the only feedback updates that should notify.
  if tg_table_name = 'feedback' then
    if new.status is not distinct from old.status then
      return new;
    end if;
  end if;

  select decrypted_secret into webhook_url
  from vault.decrypted_secrets
  where name = 'feedbackport_notify_submitter_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'feedbackport_notify_submitter_secret'
  order by created_at desc
  limit 1;

  if webhook_url is null or webhook_secret is null then
    raise warning 'notify-submitter webhook is not configured in Supabase Vault';
    return new;
  end if;

  event_payload := pg_catalog.jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', pg_catalog.to_jsonb(new),
    'old_record', case when tg_op = 'INSERT' then null else pg_catalog.to_jsonb(old) end
  );

  perform net.http_post(
    url := webhook_url,
    body := event_payload,
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.notify_submitter_webhook() from public, anon, authenticated;
grant execute on function public.notify_submitter_webhook() to service_role;

drop trigger if exists notify_submitter_reply_insert on public.replies;
create trigger notify_submitter_reply_insert
  after insert on public.replies
  for each row execute function public.notify_submitter_webhook();

drop trigger if exists notify_submitter_feedback_status_update on public.feedback;
create trigger notify_submitter_feedback_status_update
  after update of status on public.feedback
  for each row execute function public.notify_submitter_webhook();
