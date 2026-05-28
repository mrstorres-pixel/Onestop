insert into categories (name)
values ('Consumable'), ('Non-consumable'), ('Drinks'), ('Canned Goods')
on conflict (name) do nothing;

alter table products add column if not exists emoji text;

update products
set emoji = case
  when lower(name) like '%water%' then '💧'
  when lower(name) like '%coffee%' then '☕'
  when lower(name) like '%milk%' or lower(name) like '%cheese%' or lower(name) like '%yogurt%' then '🥛'
  when lower(name) like '%coke%' or lower(name) like '%cola%' or lower(name) like '%soda%' or lower(name) like '%juice%' or lower(name) like '%drink%' then '🥤'
  when lower(name) like '%chip%' or lower(name) like '%snack%' or lower(name) like '%cracker%' then '🍟'
  when lower(name) like '%bread%' or lower(name) like '%bun%' then '🍞'
  when lower(name) like '%sardine%' or lower(name) like '%tuna%' or lower(name) like '%fish%' then '🐟'
  when lower(name) like '%noodle%' or lower(name) like '%ramen%' or lower(name) like '%pancit%' then '🍜'
  when lower(name) like '%rice%' then '🍚'
  when lower(name) like '%chicken%' then '🍗'
  when lower(name) like '%beef%' or lower(name) like '%pork%' then '🥩'
  when lower(name) like '%egg%' then '🥚'
  when lower(name) like '%soap%' or lower(name) like '%shampoo%' then '🧴'
  when lower(name) like '%tissue%' or lower(name) like '%napkin%' then '🧻'
  when lower(name) like '%butane%' or lower(name) like '%gas%' then '🔥'
  when lower(name) like '%candy%' or lower(name) like '%chocolate%' then '🍫'
  when lower(name) like '%biscuit%' or lower(name) like '%cookie%' then '🍪'
  else '🛒'
end
where emoji is null or emoji = '';

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
