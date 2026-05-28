export type CategoryRow = {
  id: string;
  name: string;
  created_at: string;
};

export type ProductStatus = "healthy" | "low" | "critical" | "out";

export type SupplierRow = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  lead_time_days: number;
  reliability: number;
  created_at: string;
};

export type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  emoji: string | null;
  name: string;
  brand: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  stock: number;
  reorder_level: number;
  par_level: number;
  cost: number;
  price: number;
  expiry_date: string | null;
  location: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
  suppliers?: { name: string } | null;
};

export type AuditLogRow = {
  id: string;
  action: string;
  detail: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export type StockMovementRow = {
  id: string;
  product_id: string;
  type: "sale" | "restock" | "adjustment" | "return" | "waste";
  quantity: number;
  reason: string;
  reference: string | null;
  created_at: string;
  products?: { name: string; sku: string; barcode: string | null } | null;
};

export type SaleItem = {
  product_id: string;
  product_name: string;
  barcode: string | null;
  expiry_date: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type SaleInvoice = {
  id: string;
  invoice_no: string;
  buyer_name: string;
  buyer_address: string | null;
  buyer_phone: string | null;
  payment_method: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  created_at: string;
  items: SaleItem[];
};
