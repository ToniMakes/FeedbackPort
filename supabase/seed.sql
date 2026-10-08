-- Sample data: one fictional product ("Lumen Notes", slug 'lumen') with feedback in every status.
--
-- Runs automatically on `supabase db reset` (see [db.seed] in config.toml) and is safe to
-- re-run: it only ever touches the product with slug 'lumen', replacing its feedback, votes
-- and replies. The public sample board resets itself by running this file on a schedule
-- (.github/workflows/demo-reset.yml). All addresses use the reserved example.com domain.
--
-- Admin replies would normally fire the notify-submitter webhook. User triggers on `replies` are
-- disabled for the duration of this transaction, so running the seed against a database that has the
-- webhook configured (for example a sample tenant on a production project) never sends email.

begin;

alter table public.replies disable trigger user;

do $$
declare
  pid uuid;
  fid uuid;
begin
  insert into products (slug, name, brand_color)
  values ('lumen', 'Lumen Notes', '#4f46e5')
  on conflict (slug) do update set name = excluded.name, brand_color = excluded.brand_color
  returning id into pid;

  delete from feedback where product_id = pid;

  -- done, most voted
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Offline mode', 'I write on the train and lose my notes when the connection drops.', 'done', 'alex@example.com', now() - interval '34 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  select fid, 'voter' || g || '@example.com' from generate_series(1, 21) g;
  insert into replies (feedback_id, body)
  values (fid, 'Shipped in 2.4: notes now work offline and sync when you are back online.');

  -- planned
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Dark mode', 'Please add a dark theme. My eyes hurt when I take notes at night.', 'planned', 'alex@example.com', now() - interval '21 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  select fid, 'voter' || g || '@example.com' from generate_series(1, 18) g;
  insert into replies (feedback_id, body)
  values (fid, 'Agreed. This is planned for the next release and we will post here when it ships.');

  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Folders and tags', 'A way to group notes would help once you have a few hundred.', 'planned', 'alex@example.com', now() - interval '11 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  select fid, 'voter' || g || '@example.com' from generate_series(1, 14) g;

  -- in progress
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Sync across devices', 'I would like my notes on both my laptop and my phone.', 'in_progress', 'alex@example.com', now() - interval '14 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  select fid, 'voter' || g || '@example.com' from generate_series(1, 12) g;
  insert into replies (feedback_id, body)
  values (fid, 'Work has started. The first version will sync through your account.');

  -- open
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Markdown tables', 'Tables render as plain text today.', 'open', 'alex@example.com', now() - interval '6 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  select fid, 'voter' || g || '@example.com' from generate_series(1, 9) g;

  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Export to PDF', 'I need to send a note to someone who does not use the app.', 'open', 'alex@example.com', now() - interval '3 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  select fid, 'voter' || g || '@example.com' from generate_series(1, 6) g;

  -- declined
  insert into feedback (product_id, title, body, status, submitter_email, created_at)
  values (pid, 'Make everything free forever', null, 'declined', 'alex@example.com', now() - interval '18 days')
  returning id into fid;
  insert into votes (feedback_id, voter_email)
  select fid, 'voter' || g || '@example.com' from generate_series(1, 3) g;
  insert into replies (feedback_id, body)
  values (fid, 'Thanks for the idea. We need a paid plan to keep the project going, so we are not planning this.');
end
$$;

alter table public.replies enable trigger user;

commit;
