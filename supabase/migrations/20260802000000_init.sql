-- Initial schema + RLS; see docs/DATA_MODEL.md
create extension if not exists "uuid-ossp";
create extension if not exists vector; -- reserved for pgvector; not enabled until docs/ROADMAP.md Phase 3

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand_color text,
  created_at timestamptz not null default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title text not null,
  body text,
  status text not null default 'open'
    check (status in ('open','planned','in_progress','done','declined')),
  submitter_email text not null,
  embedding vector(1536),
  duplicate_of uuid references feedback(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  voter_email text not null,
  created_at timestamptz not null default now(),
  unique (feedback_id, voter_email)
);

create table replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  body text not null,
  is_admin boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_feedback_product_status on feedback(product_id, status);
create index idx_votes_feedback on votes(feedback_id);
create index idx_replies_feedback on replies(feedback_id);

-- Row Level Security: the anonymous role can only read and make restricted inserts; status changes and admin replies go through service-role only
alter table feedback enable row level security;
alter table votes enable row level security;
alter table replies enable row level security;

create policy "anon can read feedback" on feedback
  for select using (true);

create policy "anon can submit feedback" on feedback
  for insert with check (true);

create policy "anon can read votes" on votes
  for select using (true);

create policy "anon can vote" on votes
  for insert with check (true);

create policy "anon can read replies" on replies
  for select using (true);

-- products table: anonymous-readable (board/widget need to look up product_id by slug); writes go through service-role only
alter table products enable row level security;

create policy "anon can read products" on products
  for select using (true);
