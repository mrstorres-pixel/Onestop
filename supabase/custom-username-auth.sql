create table if not exists staff_users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  password_salt text not null,
  password_hash text not null,
  role text not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists staff_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references staff_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists staff_sessions_token_hash_idx on staff_sessions(token_hash);
create index if not exists staff_sessions_expires_at_idx on staff_sessions(expires_at);
