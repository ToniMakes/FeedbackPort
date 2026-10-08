-- Sanitized demo data: one fictional product ("demo") with feedback in every status.
--
-- Runs automatically on `supabase db reset` (see [db.seed] in config.toml) and is safe to
-- re-run: it only ever touches the product with slug 'demo', replacing its feedback, votes
-- and replies. The public demo deployment resets itself by running this file on a schedule
-- (.github/workflows/demo-reset.yml). All addresses use the reserved example.com domain.
--
-- Admin replies would normally fire the notify-submitter webhook. User triggers on `replies` are
-- disabled for the duration of this transaction, so running the seed against a database that has the
-- webhook configured (for example a demo tenant on a production project) never sends email.

begin;

alter table public.replies disable trigger user;

do $$
declare
  pid uuid;
  fid uuid;
begin
  insert into products (slug, name, brand_color)
  values ('demo', 'Demo App', '#4f46e5')
  on conflict (slug) do update set name = excluded.name, brand_color = excluded.brand_color
  returning id into pid;

  delete from feedback where product_id = pid;

  -- planned, most voted
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Dark mode', 'Please add a dark theme. My eyes hurt at night.', 'planned', 'sam@example.com', now() - interval '12 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  values (fid, 'sam@example.com'), (fid, 'riley@example.com'), (fid, 'jordan@example.com'),
         (fid, 'casey@example.com'), (fid, 'morgan@example.com');
  insert into replies (feedback_id, body)
  values (fid, 'Agreed, this is on the roadmap for next month. We will post here when it ships.');

  -- in progress
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Export my data as CSV', 'I need a way to download everything I have entered.', 'in_progress', 'riley@example.com', now() - interval '9 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  values (fid, 'riley@example.com'), (fid, 'alex@example.com'), (fid, 'jordan@example.com');
  insert into replies (feedback_id, body)
  values (fid, 'Work has started. The first version will export everything as a single CSV file.');

  -- done
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Keyboard shortcut to search', 'A shortcut like Ctrl+K to jump to search would save a lot of clicks.', 'done', 'jordan@example.com', now() - interval '20 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  values (fid, 'jordan@example.com'), (fid, 'sam@example.com');
  insert into replies (feedback_id, body)
  values (fid, 'Shipped in the latest release: press Ctrl+K (Cmd+K on macOS) anywhere.');

  -- open
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Mobile app', 'Is a native mobile app planned? The mobile website is hard to use.', 'open', 'casey@example.com', now() - interval '3 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  values (fid, 'casey@example.com'), (fid, 'morgan@example.com');

  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Slack integration', 'Post new feedback to a Slack channel.', 'open', 'morgan@example.com', now() - interval '1 day')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  values (fid, 'morgan@example.com');

  -- declined
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Make everything free forever', null, 'declined', 'alex@example.com', now() - interval '15 days')
  returning id into fid;
  insert into replies (feedback_id, body)
  values (fid, 'Thanks for the suggestion. We need to keep a paid tier to sustain the project, so we are not planning this.');
end
$$;

alter table public.replies enable trigger user;

commit;
