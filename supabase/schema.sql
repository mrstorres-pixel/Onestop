create extension if not exists "uuid-ossp";

create type product_status as enum ('active', 'archived');
create type movement_type as enum ('sale', 'restock', 'adjustment', 'return', 'waste');
create type purchase_order_status as enum ('draft', 'sent', 'partial', 'received', 'cancelled');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique,
  role text not null default 'staff',
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
  name text not null,
  brand text,
  category_id uuid references categories(id),
  supplier_id uuid references suppliers(id),
  unit text not null default 'each',
  stock integer not null default 0,
  reorder_level integer not null default 0,
  par_level integer not null default 0,
  cost numeric(10, 2) not null default 0,
  price numeric(10, 2) not null default 0,
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
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  po_number text not null unique,
  supplier_id uuid references suppliers(id),
  status purchase_order_status not null default 'draft',
  expected_date date,
  total numeric(10, 2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null,
  unit_cost numeric(10, 2) not null default 0
);

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  detail text not null,
  entity_type text,
  entity_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table suppliers enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table audit_logs enable row level security;

create policy "Authenticated users can read inventory" on products for select to authenticated using (true);
create policy "Authenticated users can manage inventory" on products for all to authenticated using (true) with check (true);
create policy "Authenticated users can read suppliers" on suppliers for select to authenticated using (true);
create policy "Authenticated users can manage suppliers" on suppliers for all to authenticated using (true) with check (true);
create policy "Authenticated users can read categories" on categories for select to authenticated using (true);
create policy "Authenticated users can manage categories" on categories for all to authenticated using (true) with check (true);
create policy "Authenticated users can read movements" on stock_movements for select to authenticated using (true);
create policy "Authenticated users can add movements" on stock_movements for insert to authenticated with check (true);
create policy "Authenticated users can read purchase orders" on purchase_orders for select to authenticated using (true);
create policy "Authenticated users can manage purchase orders" on purchase_orders for all to authenticated using (true) with check (true);
create policy "Authenticated users can read purchase order items" on purchase_order_items for select to authenticated using (true);
create policy "Authenticated users can manage purchase order items" on purchase_order_items for all to authenticated using (true) with check (true);
create policy "Authenticated users can read audit logs" on audit_logs for select to authenticated using (true);
create policy "Authenticated users can add audit logs" on audit_logs for insert to authenticated with check (true);

create or replace function update_product_stock()
returns trigger as $$
begin
  update products
  set stock = stock + new.quantity,
      updated_at = now()
  where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger stock_movement_updates_product
after insert on stock_movements
for each row execute procedure update_product_stock();

create policy "Users can read profiles" on profiles for select to authenticated using (true);
create policy "Users can update own profile" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
