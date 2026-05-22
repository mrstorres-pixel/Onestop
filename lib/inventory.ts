import { addDays, formatISO, subDays } from "date-fns";
import type { AuditLog, Product, ProductStatus, PurchaseOrder, StockMovement, Supplier } from "./types";

const today = new Date();

export const products: Product[] = [
  {
    id: "prd-001",
    sku: "DRK-COKE-330",
    barcode: "9555589200112",
    name: "Coca-Cola Classic 330ml",
    brand: "Coca-Cola",
    category: "Drinks",
    supplier: "Metro Beverage Supply",
    unit: "can",
    stock: 42,
    reorderLevel: 36,
    parLevel: 120,
    cost: 0.72,
    price: 1.35,
    expiryDate: formatISO(addDays(today, 155), { representation: "date" }),
    location: "Aisle 1 / Chiller 2",
    lastUpdated: formatISO(subDays(today, 1))
  },
  {
    id: "prd-002",
    sku: "SNK-JACK-060",
    barcode: "8888110203341",
    name: "Jack n Jill Potato Chips 60g",
    brand: "Jack n Jill",
    category: "Snacks",
    supplier: "Daily Dry Goods",
    unit: "pack",
    stock: 18,
    reorderLevel: 24,
    parLevel: 80,
    cost: 0.83,
    price: 1.75,
    expiryDate: formatISO(addDays(today, 95), { representation: "date" }),
    location: "Aisle 2 / Bay B",
    lastUpdated: formatISO(subDays(today, 2))
  },
  {
    id: "prd-003",
    sku: "DAI-MILK-1L",
    barcode: "9556156041234",
    name: "Fresh Milk 1L",
    brand: "Farmhouse",
    category: "Dairy",
    supplier: "Cold Chain Foods",
    unit: "carton",
    stock: 7,
    reorderLevel: 18,
    parLevel: 54,
    cost: 2.1,
    price: 3.4,
    expiryDate: formatISO(addDays(today, 6), { representation: "date" }),
    location: "Chiller 1 / Top Shelf",
    lastUpdated: formatISO(subDays(today, 0))
  },
  {
    id: "prd-004",
    sku: "HSH-TISSUE-6R",
    barcode: "9557004419017",
    name: "SoftCare Tissue Roll 6s",
    brand: "SoftCare",
    category: "Household",
    supplier: "Home Essentials Hub",
    unit: "bundle",
    stock: 61,
    reorderLevel: 20,
    parLevel: 72,
    cost: 2.9,
    price: 4.85,
    expiryDate: formatISO(addDays(today, 1200), { representation: "date" }),
    location: "Aisle 4 / Bay A",
    lastUpdated: formatISO(subDays(today, 4))
  },
  {
    id: "prd-005",
    sku: "BAK-BREAD-WHT",
    barcode: "9555011100822",
    name: "White Sandwich Bread",
    brand: "Gardenia",
    category: "Bakery",
    supplier: "Morning Bakery Route",
    unit: "loaf",
    stock: 0,
    reorderLevel: 12,
    parLevel: 36,
    cost: 1.85,
    price: 2.8,
    expiryDate: formatISO(addDays(today, 2), { representation: "date" }),
    location: "Front Rack",
    lastUpdated: formatISO(subDays(today, 0))
  },
  {
    id: "prd-006",
    sku: "CAN-SARD-425",
    barcode: "9555217700120",
    name: "Sardines in Tomato Sauce 425g",
    brand: "Ayam Brand",
    category: "Canned Food",
    supplier: "Daily Dry Goods",
    unit: "can",
    stock: 96,
    reorderLevel: 30,
    parLevel: 108,
    cost: 1.92,
    price: 3.25,
    expiryDate: formatISO(addDays(today, 620), { representation: "date" }),
    location: "Aisle 3 / Bay C",
    lastUpdated: formatISO(subDays(today, 3))
  }
];

export const movements: StockMovement[] = [
  {
    id: "mov-001",
    productId: "prd-003",
    productName: "Fresh Milk 1L",
    type: "sale",
    quantity: -5,
    reason: "POS sale batch",
    reference: "SALE-10483",
    user: "Cashier Aina",
    createdAt: formatISO(subDays(today, 0))
  },
  {
    id: "mov-002",
    productId: "prd-005",
    productName: "White Sandwich Bread",
    type: "waste",
    quantity: -3,
    reason: "Expired and removed from shelf",
    reference: "WST-00041",
    user: "Supervisor Dan",
    createdAt: formatISO(subDays(today, 0))
  },
  {
    id: "mov-003",
    productId: "prd-002",
    productName: "Jack n Jill Potato Chips 60g",
    type: "restock",
    quantity: 24,
    reason: "Supplier delivery received",
    reference: "PO-2026-018",
    user: "Stock Clerk Mei",
    createdAt: formatISO(subDays(today, 1))
  },
  {
    id: "mov-004",
    productId: "prd-001",
    productName: "Coca-Cola Classic 330ml",
    type: "adjustment",
    quantity: -2,
    reason: "Cycle count variance",
    reference: "CNT-2026-052",
    user: "Supervisor Dan",
    createdAt: formatISO(subDays(today, 2))
  }
];

export const suppliers: Supplier[] = [
  { id: "sup-001", name: "Metro Beverage Supply", contact: "Rafiq Lim", phone: "+65 6123 8891", leadTimeDays: 2, reliability: 96 },
  { id: "sup-002", name: "Daily Dry Goods", contact: "Siti Tan", phone: "+65 6988 4512", leadTimeDays: 3, reliability: 91 },
  { id: "sup-003", name: "Cold Chain Foods", contact: "Marcus Ong", phone: "+65 6774 0900", leadTimeDays: 1, reliability: 94 },
  { id: "sup-004", name: "Morning Bakery Route", contact: "Nora Lee", phone: "+65 6231 2209", leadTimeDays: 1, reliability: 88 }
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: "PO-2026-019", supplier: "Cold Chain Foods", status: "sent", items: 4, total: 318.7, expectedDate: formatISO(addDays(today, 1), { representation: "date" }) },
  { id: "PO-2026-020", supplier: "Morning Bakery Route", status: "draft", items: 2, total: 88.8, expectedDate: formatISO(addDays(today, 1), { representation: "date" }) },
  { id: "PO-2026-017", supplier: "Daily Dry Goods", status: "partial", items: 12, total: 940.5, expectedDate: formatISO(addDays(today, 2), { representation: "date" }) }
];

export const auditLogs: AuditLog[] = [
  { id: "log-001", action: "Stock adjusted", detail: "Coca-Cola Classic 330ml changed by -2 after cycle count.", user: "Supervisor Dan", createdAt: formatISO(subDays(today, 2)) },
  { id: "log-002", action: "Purchase order sent", detail: "PO-2026-019 sent to Cold Chain Foods.", user: "Manager Lina", createdAt: formatISO(subDays(today, 1)) },
  { id: "log-003", action: "Product flagged", detail: "White Sandwich Bread hit zero stock and near-expiry alert.", user: "System", createdAt: formatISO(subDays(today, 0)) },
  { id: "log-004", action: "Price updated", detail: "Sardines in Tomato Sauce 425g retail price changed to $3.25.", user: "Manager Lina", createdAt: formatISO(subDays(today, 4)) }
];

export function getProductStatus(product: Product): ProductStatus {
  if (product.stock <= 0) return "out";
  if (product.stock <= Math.ceil(product.reorderLevel / 2)) return "critical";
  if (product.stock <= product.reorderLevel) return "low";
  return "healthy";
}

export function getInventoryValue() {
  return products.reduce((total, product) => total + product.stock * product.cost, 0);
}

export function getRetailValue() {
  return products.reduce((total, product) => total + product.stock * product.price, 0);
}

export function getProductHistory(productId: string) {
  return movements.filter((movement) => movement.productId === productId);
}

export function getReorderSuggestions() {
  return products
    .filter((product) => getProductStatus(product) !== "healthy")
    .map((product) => ({
      product,
      suggestedQuantity: Math.max(product.parLevel - product.stock, product.reorderLevel)
    }));
}
