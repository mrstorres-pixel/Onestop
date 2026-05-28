create extension if not exists "uuid-ossp";

create type product_status as enum ('active', 'archived');
create type movement_type as enum ('sale', 'restock', 'adjustment', 'return', 'waste');

create table staff_users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  password_salt text not null,
  password_hash text not null,
  role text not null default 'staff',
  created_at timestamptz not null default now()
);

create table staff_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references staff_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact text,
  phone text,
  email text,
  lead_time_days integer not null default 1,
  reliability integer not null default 100,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  sku text not null unique,
  barcode text unique,
  emoji text,
  name text not null,
  brand text,
  category_id uuid references categories(id),
  supplier_id uuid references suppliers(id),
  unit text not null default 'pcs',
  stock integer not null default 0,
  reorder_level integer not null default 0,
  par_level integer not null default 0,
  cost numeric(12, 2) not null default 0,
  price numeric(12, 2) not null default 0,
  expiry_date date,
  location text,
  status product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  type movement_type not null,
  quantity integer not null,
  reason text not null,
  reference text,
  created_at timestamptz not null default now()
);

create table wholesale_sales (
  id uuid primary key default uuid_generate_v4(),
  invoice_no text not null unique,
  sale_type text not null default 'wholesale',
  buyer_name text not null,
  buyer_address text,
  buyer_phone text,
  payment_method text not null default 'Cash',
  subtotal numeric(12, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_by uuid references staff_users(id),
  created_at timestamptz not null default now()
);

create table wholesale_sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references wholesale_sales(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  barcode text,
  expiry_date date,
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  detail text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);

insert into categories (name)
values ('Consumable'), ('Non-consumable'), ('Drinks'), ('Canned Goods')
on conflict (name) do nothing;

create index staff_sessions_token_hash_idx on staff_sessions(token_hash);
create index staff_sessions_expires_at_idx on staff_sessions(expires_at);
create index products_expiry_status_idx on products(status, expiry_date);
create index wholesale_sales_invoice_no_idx on wholesale_sales(invoice_no);
create index wholesale_sale_items_sale_id_idx on wholesale_sale_items(sale_id);

create or replace function update_product_stock()
returns trigger as $$
begin
  update products
  set stock = greatest(stock + new.quantity, 0),
      updated_at = now()
  where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger stock_movement_updates_product
after insert on stock_movements
for each row execute procedure update_product_stock();
