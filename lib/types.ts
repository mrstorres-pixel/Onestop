export type ProductStatus = "healthy" | "low" | "critical" | "out";

export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  supplier: string;
  unit: string;
  stock: number;
  reorderLevel: number;
  parLevel: number;
  cost: number;
  price: number;
  expiryDate: string;
  location: string;
  lastUpdated: string;
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  type: "sale" | "restock" | "adjustment" | "return" | "waste";
  quantity: number;
  reason: string;
  reference: string;
  user: string;
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  leadTimeDays: number;
  reliability: number;
};

export type PurchaseOrder = {
  id: string;
  supplier: string;
  status: "draft" | "sent" | "partial" | "received";
  items: number;
  total: number;
  expectedDate: string;
};

export type AuditLog = {
  id: string;
  action: string;
  detail: string;
  user: string;
  createdAt: string;
};
