"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  FileClock,
  LayoutDashboard,
  Loader2,
  LogOut,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Trash2,
  Truck
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import type { AuditLogRow, CategoryRow, ProductRow, SaleInvoice, StockMovementRow, SupplierRow } from "@/lib/db-types";
import type { ProductStatus } from "@/lib/types";
import { cn, currency, number } from "@/lib/utils";

type StaffUser = { id: string; username: string; role: string };
type Tab = "dashboard" | "products" | "sell" | "invoice" | "settings";
type ProductFilter = "all" | "low" | "expiring";

type ProductForm = {
  id?: string;
  name: string;
  categoryName: string;
  supplierName: string;
  barcode: string;
  expiryDate: string;
  cost: string;
  price: string;
  stock: string;
  reorderLevel: string;
};

type SaleLine = {
  productId: string;
  quantity: string;
  unitPrice: string;
};

const emptyProductForm: ProductForm = {
  name: "",
  categoryName: "Consumable",
  supplierName: "",
  barcode: "",
  expiryDate: "",
  cost: "0",
  price: "0",
  stock: "0",
  reorderLevel: "5"
};

function getProductStatus(product: ProductRow): ProductStatus {
  if (product.stock <= 0) return "out";
  if (product.stock <= Math.ceil(product.reorder_level / 2)) return "critical";
  if (product.stock <= product.reorder_level) return "low";
  return "healthy";
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function isExpiringSoon(product: ProductRow) {
  const days = daysUntil(product.expiry_date);
  return days !== null && days >= 0 && days <= 14;
}

function inputClass(extra = "") {
  return cn("h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-none ring-leaf/20 focus:ring-4", extra);
}

export function InventoryApp() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [expiredToday, setExpiredToday] = useState<Array<{ id: string; name: string; expiry_date: string }>>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([{ productId: "", quantity: "1", unitPrice: "0" }]);
  const [saleForm, setSaleForm] = useState({
    buyerName: "ONE STOP",
    buyerAddress: "",
    buyerPhone: "",
    paymentMethod: "Cash",
    vatRate: "0"
  });
  const [invoice, setInvoice] = useState<SaleInvoice | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [supplierForm, setSupplierForm] = useState({ name: "", contact: "", phone: "", email: "", leadTimeDays: "1" });

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function apiRequest(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Request failed.");
    return data;
  }

  async function loadData() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/inventory");
      setProducts(data.products ?? []);
      setCategories(data.categories ?? []);
      setSuppliers(data.suppliers ?? []);
      setMovements(data.movements ?? []);
      setLogs(data.logs ?? []);
      setExpiredToday(data.expiredToday ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load inventory.");
    }
    setLoading(false);
  }

  const metrics = useMemo(() => {
    const capitalValue = products.reduce((total, product) => total + product.stock * Number(product.cost), 0);
    const sellingValue = products.reduce((total, product) => total + product.stock * Number(product.price), 0);
    const lowStock = products.filter((product) => getProductStatus(product) !== "healthy");
    const expiring = products.filter(isExpiringSoon);
    return { capitalValue, sellingValue, lowStock, expiring };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const searchable = [product.name, product.barcode, product.categories?.name, product.suppliers?.name].filter(Boolean).join(" ").toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (filter === "low") return getProductStatus(product) !== "healthy";
      if (filter === "expiring") return isExpiringSoon(product);
      return true;
    });
  }, [filter, products, query]);

  const salePreview = useMemo(() => {
    const subtotal = saleLines.reduce((total, line) => total + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const vat = subtotal * (Number(saleForm.vatRate || 0) / 100);
    return { subtotal, vat, total: subtotal + vat };
  }, [saleForm.vatRate, saleLines]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data = await apiRequest("/api/auth/login", { username, password });
      setUser(data.user);
      setMessage("Signed in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    }
    setSaving(false);
  }

  async function signOut() {
    await apiRequest("/api/auth/logout", {});
    setUser(null);
    setProducts([]);
    setMovements([]);
    setLogs([]);
  }

  function editProduct(product: ProductRow) {
    setSelectedProductId(product.id);
    setProductForm({
      id: product.id,
      name: product.name,
      categoryName: product.categories?.name ?? "Consumable",
      supplierName: product.suppliers?.name ?? "",
      barcode: product.barcode ?? "",
      expiryDate: product.expiry_date ?? "",
      cost: String(product.cost),
      price: String(product.price),
      stock: String(product.stock),
      reorderLevel: String(product.reorder_level)
    });
    setTab("products");
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await apiRequest("/api/products", {
        ...productForm,
        sku: productForm.barcode,
        brand: "",
        unit: "pcs",
        parLevel: Number(productForm.reorderLevel) * 3,
        location: ""
      });
      setProductForm(emptyProductForm);
      await loadData();
      setMessage("Product saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
    }
    setSaving(false);
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/api/categories", { name: categoryName });
      setCategoryName("");
      await loadData();
      setMessage("Category saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save category.");
    }
    setSaving(false);
  }

  async function saveSupplier(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/api/suppliers", supplierForm);
      setSupplierForm({ name: "", contact: "", phone: "", email: "", leadTimeDays: "1" });
      await loadData();
      setMessage("Supplier saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save supplier.");
    }
    setSaving(false);
  }

  async function createSale(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data = await apiRequest("/api/sales", {
        ...saleForm,
        vatRate: Number(saleForm.vatRate || 0),
        items: saleLines
          .filter((line) => line.productId)
          .map((line) => ({
            productId: line.productId,
            quantity: Number(line.quantity || 1),
            unitPrice: Number(line.unitPrice || 0)
          }))
      });
      setInvoice(data.invoice);
      setTab("invoice");
      setSaleLines([{ productId: "", quantity: "1", unitPrice: "0" }]);
      await loadData();
      setMessage("Wholesale sale created and stock deducted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create sale.");
    }
    setSaving(false);
  }

  function updateSaleLine(index: number, patch: Partial<SaleLine>) {
    setSaleLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const product = products.find((item) => item.id === patch.productId);
          next.unitPrice = String(product?.price ?? 0);
        }
        return next;
      })
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-4">
        <form onSubmit={handleAuth} className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-white">
              <Boxes className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-leaf">Onestop Minimart</p>
              <h1 className="text-2xl font-bold">Sign in</h1>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <input className={inputClass("w-full")} placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
            <input className={inputClass("w-full")} placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {message ? <p className="mt-4 rounded-md bg-paper p-3 text-sm text-zinc-700">{message}</p> : null}
          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white hover:bg-emerald-700" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            Sign in
          </button>
        </form>
      </main>
    );
  }

  const nav = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["products", Boxes, "Products"],
    ["sell", ReceiptText, "Wholesale Sale"],
    ["invoice", Printer, "Invoice"],
    ["settings", Settings, "Settings"]
  ] as const;

  return (
    <main className="min-h-screen bg-paper">
      <header className="no-print border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-white">
                <Boxes className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-leaf">Onestop Minimart</p>
                <h1 className="text-2xl font-bold tracking-normal text-ink sm:text-3xl">Inventory System</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void loadData()} className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-paper px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Refresh
              </button>
              <button onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-berry hover:text-berry">
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto">
            {nav.map(([key, Icon, label]) => (
              <button key={key} onClick={() => setTab(key)} className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold", tab === key ? "border-leaf bg-mint text-leaf" : "border-black/10 bg-white text-zinc-700 hover:border-leaf hover:text-leaf")}>
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </nav>
          {message ? <p className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm text-zinc-700">{message}</p> : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {tab === "dashboard" ? (
          <div className="space-y-5">
            <section className="grid gap-4 lg:grid-cols-4">
              <MetricCard icon={BarChart3} label="Capital value" value={currency(metrics.capitalValue)} detail="Total inventory based on capital cost" />
              <MetricCard icon={ReceiptText} label="Selling value" value={currency(metrics.sellingValue)} detail="Total inventory based on selling price" />
              <MetricCard icon={AlertTriangle} label="Near expiry" value={number(metrics.expiring.length)} detail="Products expiring within 14 days" />
              <MetricCard icon={Boxes} label="Active products" value={number(products.length)} detail={`${number(metrics.lowStock.length)} need stock attention`} />
            </section>
            <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold">Expiry Alerts</h2>
                <div className="mt-4 space-y-3">
                  {expiredToday.length ? <p className="rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{expiredToday.length} expired product(s) had their remaining quantity deducted today.</p> : null}
                  {metrics.expiring.length === 0 ? <p className="text-sm text-zinc-500">No products are close to expiry.</p> : null}
                  {metrics.expiring.map((product) => (
                    <button key={product.id} onClick={() => editProduct(product)} className="flex w-full items-center justify-between rounded-md border border-black/10 p-3 text-left hover:border-leaf">
                      <span>
                        <span className="block font-semibold">{product.name}</span>
                        <span className="text-sm text-zinc-500">Expires {product.expiry_date}</span>
                      </span>
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">{daysUntil(product.expiry_date)} days</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold">Recent Logs</h2>
                <div className="mt-4 space-y-3">
                  {logs.slice(0, 8).map((log) => (
                    <div key={log.id} className="border-b border-black/10 pb-3 last:border-0">
                      <p className="font-semibold">{log.action}</p>
                      <p className="text-sm text-zinc-500">{log.detail}</p>
                      <p className="mt-1 text-xs text-zinc-400">{new Date(log.created_at).toLocaleString("en-PH")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {tab === "products" ? (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-lg border border-black/10 bg-white shadow-sm">
              <div className="space-y-3 border-b border-black/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Products</h2>
                    <p className="text-sm text-zinc-500">Name, category, supplier, barcode, expiry, capital, and selling price.</p>
                  </div>
                  <button onClick={() => setProductForm(emptyProductForm)} className="inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf">
                    <PackagePlus className="h-4 w-4" aria-hidden />
                    New product
                  </button>
                </div>
                <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
                    <input className={inputClass("w-full pl-10")} placeholder="Search products, barcode, category, supplier" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <div className="flex gap-2">
                    {[
                      ["all", "All"],
                      ["low", "Low"],
                      ["expiring", "Expiring"]
                    ].map(([key, label]) => (
                      <button key={key} onClick={() => setFilter(key as ProductFilter)} className={cn("rounded-md border px-3 text-sm font-semibold", filter === key ? "border-leaf bg-mint text-leaf" : "border-black/10 bg-white text-zinc-700")}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Capital</th>
                      <th className="px-4 py-3">Selling</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} onClick={() => editProduct(product)} className="cursor-pointer border-t border-black/5 hover:bg-paper">
                        <td className="px-4 py-4">
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-xs text-zinc-500">{product.barcode ?? "No barcode"}</p>
                        </td>
                        <td className="px-4 py-4">{product.categories?.name ?? "-"}</td>
                        <td className="px-4 py-4">{product.suppliers?.name ?? "-"}</td>
                        <td className="px-4 py-4 font-semibold">{product.stock}</td>
                        <td className="px-4 py-4">{currency(Number(product.cost))}</td>
                        <td className="px-4 py-4">{currency(Number(product.price))}</td>
                        <td className="px-4 py-4">{product.expiry_date ?? "-"}</td>
                        <td className="px-4 py-4"><StatusPill status={getProductStatus(product)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <ProductEditor form={productForm} setForm={setProductForm} categories={categories} suppliers={suppliers} saving={saving} onSubmit={saveProduct} />
          </div>
        ) : null}

        {tab === "sell" ? (
          <form onSubmit={createSale} className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Wholesale Sell Order</h2>
                  <p className="text-sm text-zinc-500">Set custom unit prices and generate a delivery receipt.</p>
                </div>
                <ReceiptText className="h-5 w-5 text-leaf" aria-hidden />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input className={inputClass()} placeholder="Buyer / company" value={saleForm.buyerName} onChange={(event) => setSaleForm({ ...saleForm, buyerName: event.target.value })} required />
                <input className={inputClass()} placeholder="Phone" value={saleForm.buyerPhone} onChange={(event) => setSaleForm({ ...saleForm, buyerPhone: event.target.value })} />
                <input className={inputClass("md:col-span-2")} placeholder="Address" value={saleForm.buyerAddress} onChange={(event) => setSaleForm({ ...saleForm, buyerAddress: event.target.value })} />
              </div>
              <div className="mt-5 space-y-3">
                {saleLines.map((line, index) => {
                  const product = products.find((item) => item.id === line.productId);
                  return (
                    <div key={index} className="grid gap-2 rounded-md border border-black/10 p-3 md:grid-cols-[1fr_100px_130px_40px]">
                      <select className={inputClass("w-full")} value={line.productId} onChange={(event) => updateSaleLine(index, { productId: event.target.value })} required>
                        <option value="">Select product</option>
                        {products.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.stock})</option>)}
                      </select>
                      <input className={inputClass("w-full")} type="number" min="1" placeholder="Qty" value={line.quantity} onChange={(event) => updateSaleLine(index, { quantity: event.target.value })} required />
                      <input className={inputClass("w-full")} type="number" step="0.01" min="0" placeholder="Custom price" value={line.unitPrice} onChange={(event) => updateSaleLine(index, { unitPrice: event.target.value })} required />
                      <button type="button" onClick={() => setSaleLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="flex h-10 items-center justify-center rounded-md border border-black/10 text-zinc-500 hover:border-berry hover:text-berry" aria-label="Remove line">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                      {product ? <p className="text-xs text-zinc-500 md:col-span-4">Barcode {product.barcode ?? "-"} / Expiry {product.expiry_date ?? "-"} / Default {currency(Number(product.price))}</p> : null}
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => setSaleLines((current) => [...current, { productId: "", quantity: "1", unitPrice: "0" }])} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-black/10 px-4 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf">
                <Plus className="h-4 w-4" aria-hidden />
                Add product
              </button>
            </section>
            <aside className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Payment</h2>
              <div className="mt-4 space-y-3">
                <select className={inputClass("w-full")} value={saleForm.paymentMethod} onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value })}>
                  {["Cash", "Check", "Bank Transfer", "Credit"].map((method) => <option key={method}>{method}</option>)}
                </select>
                <input className={inputClass("w-full")} type="number" step="0.01" min="0" placeholder="VAT %" value={saleForm.vatRate} onChange={(event) => setSaleForm({ ...saleForm, vatRate: event.target.value })} />
              </div>
              <div className="mt-5 space-y-2 border-t border-black/10 pt-4 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><strong>{currency(salePreview.subtotal)}</strong></div>
                <div className="flex justify-between"><span>VAT</span><strong>{currency(salePreview.vat)}</strong></div>
                <div className="flex justify-between text-lg"><span>Total</span><strong>{currency(salePreview.total)}</strong></div>
              </div>
              <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white hover:bg-emerald-700" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ReceiptText className="h-4 w-4" aria-hidden />}
                Create invoice
              </button>
            </aside>
          </form>
        ) : null}

        {tab === "invoice" ? (
          <InvoiceView invoice={invoice} />
        ) : null}

        {tab === "settings" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={saveCategory} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-leaf" aria-hidden />
                <h2 className="text-lg font-bold">Categories</h2>
              </div>
              <div className="mt-4 flex gap-2">
                <input className={inputClass("w-full")} placeholder="Category name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
                <button className="inline-flex h-10 items-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white" disabled={saving}><Plus className="h-4 w-4" aria-hidden />Add</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => <span key={category.id} className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm font-semibold">{category.name}</span>)}
              </div>
            </form>
            <form onSubmit={saveSupplier} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-leaf" aria-hidden />
                <h2 className="text-lg font-bold">Suppliers</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input className={inputClass()} placeholder="Supplier name" value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} required />
                <input className={inputClass()} placeholder="Contact person" value={supplierForm.contact} onChange={(event) => setSupplierForm({ ...supplierForm, contact: event.target.value })} />
                <input className={inputClass()} placeholder="Phone" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} />
                <input className={inputClass()} placeholder="Email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} />
                <input className={inputClass()} placeholder="Lead time days" type="number" value={supplierForm.leadTimeDays} onChange={(event) => setSupplierForm({ ...supplierForm, leadTimeDays: event.target.value })} />
              </div>
              <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white" disabled={saving}><Save className="h-4 w-4" aria-hidden />Save supplier</button>
              <div className="mt-4 space-y-2">
                {suppliers.map((supplier) => <p key={supplier.id} className="rounded-md border border-black/10 p-3 text-sm"><strong>{supplier.name}</strong><br />{supplier.contact ?? "No contact"} / {supplier.phone ?? "No phone"}</p>)}
              </div>
            </form>
            <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm lg:col-span-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-leaf" aria-hidden />
                <h2 className="text-lg font-bold">Admin Notes</h2>
              </div>
              <p className="mt-3 text-sm text-zinc-600">Default product categories are Consumable and Non-consumable. Expired products stay in the catalog, but their remaining quantity is automatically deducted through a waste movement. Public account creation is disabled; create staff users from the local admin script.</p>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ProductEditor({
  form,
  setForm,
  categories,
  suppliers,
  saving,
  onSubmit
}: {
  form: ProductForm;
  setForm: (form: ProductForm) => void;
  categories: CategoryRow[];
  suppliers: SupplierRow[];
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <PackagePlus className="h-5 w-5 text-leaf" aria-hidden />
        <h2 className="text-lg font-bold">{form.id ? "Edit Product" : "Add Product"}</h2>
      </div>
      <div className="mt-4 space-y-3">
        <input className={inputClass("w-full")} placeholder="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <select className={inputClass("w-full")} value={form.categoryName} onChange={(event) => setForm({ ...form, categoryName: event.target.value })}>
          {categories.map((category) => <option key={category.id}>{category.name}</option>)}
          {!categories.length ? <><option>Consumable</option><option>Non-consumable</option></> : null}
        </select>
        <input className={inputClass("w-full")} placeholder="Supplier" list="supplier-options" value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} />
        <datalist id="supplier-options">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
        <input className={inputClass("w-full")} placeholder="Barcode" value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
        <input className={inputClass("w-full")} type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputClass("w-full")} type="number" min="0" placeholder="Quantity" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
          <input className={inputClass("w-full")} type="number" min="0" placeholder="Low stock alert" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} />
          <input className={inputClass("w-full")} type="number" step="0.01" min="0" placeholder="Capital" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} />
          <input className={inputClass("w-full")} type="number" step="0.01" min="0" placeholder="Selling price" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
        </div>
      </div>
      <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white hover:bg-emerald-700" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
        Save product
      </button>
    </form>
  );
}

function InvoiceView({ invoice }: { invoice: SaleInvoice | null }) {
  if (!invoice) {
    return (
      <section className="rounded-lg border border-black/10 bg-white p-6 text-center shadow-sm">
        <ReceiptText className="mx-auto h-8 w-8 text-zinc-400" aria-hidden />
        <h2 className="mt-3 text-lg font-bold">No invoice selected</h2>
        <p className="mt-1 text-sm text-zinc-500">Create a wholesale sale to generate a delivery receipt.</p>
      </section>
    );
  }

  const totalQty = invoice.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section className="mx-auto max-w-5xl bg-white p-6 shadow-sm print:shadow-none">
      <div className="no-print mb-4 flex justify-end">
        <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white">
          <Printer className="h-4 w-4" aria-hidden />
          Print
        </button>
      </div>
      <div className="border-2 border-black p-5 text-black">
        <div className="grid grid-cols-[1fr_auto] gap-4">
          <div>
            <p className="text-xl">[Company] <span className="ml-6 text-base">[ONE STOP]</span></p>
            <h1 className="mt-3 text-4xl font-black tracking-normal">DELIVERY RECEIPT</h1>
          </div>
          <div className="mt-12 text-sm">
            <p><strong>Invoice No.</strong> <span className="ml-8">{invoice.invoice_no}</span></p>
            <p><strong>Date</strong> <span className="ml-16">{new Date(invoice.created_at).toLocaleDateString("en-PH")}</span></p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <h2 className="border-b border-black font-bold">Buyer Information</h2>
            <p>Company <span className="ml-8">{invoice.buyer_name}</span></p>
            <p>Address <span className="ml-8">{invoice.buyer_address ?? "-"}</span></p>
            <p>Tel <span className="ml-14">{invoice.buyer_phone ?? "-"}</span></p>
            <p>Classify <span className="ml-8">(Wholesale)</span></p>
          </div>
          <div className="pt-8">
            <p>Email :</p>
          </div>
        </div>
        <h2 className="mt-5 border-b border-black text-sm font-bold">Product Details</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1 text-left">No</th>
              <th className="py-1 text-left">Product Code</th>
              <th className="py-1 text-left">Product Name</th>
              <th className="py-1 text-right">QTY</th>
              <th className="py-1 text-right">Unit Price</th>
              <th className="py-1 text-right">Subtotal</th>
              <th className="py-1 text-right">Exp Date</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={`${item.product_id}-${index}`}>
                <td className="py-1">{index + 1}</td>
                <td className="py-1">{item.barcode ?? "-"}</td>
                <td className="py-1">{item.product_name}</td>
                <td className="py-1 text-right">{item.quantity}</td>
                <td className="py-1 text-right">{currency(Number(item.unit_price))}</td>
                <td className="py-1 text-right">{currency(Number(item.subtotal))}</td>
                <td className="py-1 text-right">{item.expiry_date ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 grid grid-cols-[1fr_280px] gap-8 border-t border-black pt-4 text-sm">
          <div>
            <h2 className="border-b border-black font-bold">Terms & Conditions</h2>
            <p className="mt-2">Payment is basically due within the release of the products.</p>
            <p>Goods sold are non-refundable and non-exchangeable unless defective.</p>
            <p>Delivery will be made within 3-5 business days after payment confirmation.</p>
            <h2 className="mt-5 border-b border-black font-bold">Payment Method</h2>
            <p>{invoice.payment_method}</p>
          </div>
          <div>
            <h2 className="border-b border-black font-bold">Payment Details</h2>
            <p className="flex justify-between"><span>Total QTY Box</span><span>{totalQty} BOX</span></p>
            <p className="flex justify-between"><span>Subtotal</span><span>{currency(Number(invoice.subtotal))}</span></p>
            <p className="flex justify-between"><span>VAT ({invoice.vat_rate}%)</span><span>{currency(Number(invoice.vat_amount))}</span></p>
            <p className="mt-2 flex justify-between border-y border-black py-2 text-lg font-black"><span>Total Amount</span><span>{currency(Number(invoice.total))}</span></p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <div className="pt-16">
            <h2 className="border-b border-black font-bold">Buyer Representative</h2>
            <p>Name : <span className="ml-24">Signature :</span></p>
          </div>
          <div className="grid grid-cols-2 border border-black text-xs font-bold">
            {["Prepared by/DR Maker", "Inventory Checker", "Delivery/Pick up Verified by", "Released by Security Onduty", "Payment Checker/Cashier", "Verified by/Authorized Person"].map((label) => (
              <div key={label} className="min-h-14 border border-black p-1">{label}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
