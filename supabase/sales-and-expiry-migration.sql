insert into categories (name)
values ('Consumable'), ('Non-consumable')
on conflict (name) do nothing;

create table if not exists wholesale_sales (
  id uuid primary key default uuid_generate_v4(),
  invoice_no text not null unique,
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

create table if not exists wholesale_sale_items (
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

create index if not exists wholesale_sales_invoice_no_idx on wholesale_sales(invoice_no);
create index if not exists wholesale_sale_items_sale_id_idx on wholesale_sale_items(sale_id);
create index if not exists products_expiry_status_idx on products(status, expiry_date);
