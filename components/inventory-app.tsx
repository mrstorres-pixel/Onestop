"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Boxes,
  ClipboardList,
  FileClock,
  History,
  Loader2,
  LogOut,
  PackagePlus,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Truck
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import type { AuditLogRow, CategoryRow, ProductRow, PurchaseOrderRow, StockMovementRow, SupplierRow } from "@/lib/db-types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ProductStatus } from "@/lib/types";
import { cn, currency, number } from "@/lib/utils";

type Filter = "all" | "low" | "expiring" | "orders";
type ProductForm = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  brand: string;
  categoryName: string;
  supplierName: string;
  unit: string;
  stock: string;
  reorderLevel: string;
  parLevel: string;
  cost: string;
  price: string;
  expiryDate: string;
  location: string;
};

const emptyProductForm: ProductForm = {
  name: "",
  sku: "",
  barcode: "",
  brand: "",
  categoryName: "",
  supplierName: "",
  unit: "pcs",
  stock: "0",
  reorderLevel: "5",
  parLevel: "20",
  cost: "0",
  price: "0",
  expiryDate: "",
  location: ""
};

const movementLabels = {
  sale: "Sale",
  restock: "Restock",
  adjustment: "Adjustment",
  return: "Return",
  waste: "Waste"
};

function getProductStatus(product: ProductRow): ProductStatus {
  if (product.stock <= 0) return "out";
  if (product.stock <= Math.ceil(product.reorder_level / 2)) return "critical";
  if (product.stock <= product.reorder_level) return "low";
  return "healthy";
}

function isExpiringSoon(product: ProductRow) {
  if (!product.expiry_date) return false;
  const days = (new Date(product.expiry_date).getTime() - Date.now()) / 86400000;
  return days <= 14;
}

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function InventoryApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [movementForm, setMovementForm] = useState({
    productId: "",
    type: "restock" as StockMovementRow["type"],
    quantity: "1",
    reason: "",
    reference: ""
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    leadTimeDays: "1"
  });
  const [orderForm, setOrderForm] = useState({
    supplierId: "",
    status: "draft" as PurchaseOrderRow["status"],
    expectedDate: "",
    total: "0"
  });

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const authEmail = `${username.trim().toLowerCase()}@gmail.com`;

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      void loadData();
    }
  }, [session]);

  useEffect(() => {
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
      setMovementForm((current) => ({ ...current, productId: products[0].id }));
    }
  }, [products, selectedProductId]);

  const metrics = useMemo(() => {
    const inventoryCost = products.reduce((total, product) => total + product.stock * Number(product.cost), 0);
    const retailValue = products.reduce((total, product) => total + product.stock * Number(product.price), 0);
    const lowStock = products.filter((product) => getProductStatus(product) !== "healthy");
    const expiringSoon = products.filter(isExpiringSoon);

    return { inventoryCost, retailValue, lowStock, expiringSoon };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalized ||
        [product.name, product.sku, product.barcode, product.brand, product.location, product.categories?.name, product.suppliers?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));

      if (!matchesSearch) return false;
      if (filter === "low") return getProductStatus(product) !== "healthy";
      if (filter === "expiring") return isExpiringSoon(product);
      return true;
    });
  }, [filter, products, query]);

  const reorderSuggestions = useMemo(
    () =>
      products
        .filter((product) => getProductStatus(product) !== "healthy")
        .map((product) => ({
          product,
          suggestedQuantity: Math.max(product.par_level - product.stock, product.reorder_level)
        })),
    [products]
  );

  const productHistory = useMemo(
    () => movements.filter((movement) => movement.product_id === selectedProduct?.id),
    [movements, selectedProduct?.id]
  );

  async function loadData() {
    if (!supabase) return;

    setLoading(true);
    setMessage("");

    const [productResult, categoryResult, supplierResult, movementResult, orderResult, logResult] = await Promise.all([
      supabase.from("products").select("*, categories(name), suppliers(name)").eq("status", "active").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("stock_movements").select("*, products(name, sku)").order("created_at", { ascending: false }).limit(50),
      supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(20),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20)
    ]);

    const error = productResult.error ?? categoryResult.error ?? supplierResult.error ?? movementResult.error ?? orderResult.error ?? logResult.error;

    if (error) {
      setMessage(error.message);
    } else {
      setProducts((productResult.data ?? []) as ProductRow[]);
      setCategories((categoryResult.data ?? []) as CategoryRow[]);
      setSuppliers((supplierResult.data ?? []) as SupplierRow[]);
      setMovements((movementResult.data ?? []) as StockMovementRow[]);
      setOrders((orderResult.data ?? []) as PurchaseOrderRow[]);
      setLogs((logResult.data ?? []) as AuditLogRow[]);
    }

    setLoading(false);
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage("");

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      setMessage("Username must be 3 to 30 characters and use only letters, numbers, or underscores.");
      setSaving(false);
      return;
    }

    const result =
      authMode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email: authEmail, password })
        : await supabase.auth.signUp({
            email: authEmail,
            password,
            options: {
              data: {
                username: username.trim().toLowerCase(),
                full_name: username.trim()
              }
            }
          });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage(authMode === "sign-up" ? "Account created. You can sign in with your username and password." : "Signed in.");
    }

    setSaving(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProducts([]);
    setMovements([]);
    setOrders([]);
    setLogs([]);
  }

  async function ensureCategory(name: string) {
    if (!supabase || !name.trim()) return null;
    const existing = categories.find((category) => category.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const { data, error } = await supabase.from("categories").insert({ name: name.trim() }).select("id").single();
    if (error) throw error;
    return data.id as string;
  }

  async function ensureSupplier(name: string) {
    if (!supabase || !name.trim()) return null;
    const existing = suppliers.find((supplier) => supplier.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const { data, error } = await supabase.from("suppliers").insert({ name: name.trim() }).select("id").single();
    if (error) throw error;
    return data.id as string;
  }

  async function addAudit(action: string, detail: string, entityType?: string, entityId?: string) {
    if (!supabase) return;
    await supabase.from("audit_logs").insert({
      action,
      detail,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null
    });
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage("");

    try {
      const categoryId = await ensureCategory(productForm.categoryName);
      const supplierId = await ensureSupplier(productForm.supplierName);
      const payload = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim(),
        barcode: productForm.barcode.trim() || null,
        brand: productForm.brand.trim() || null,
        category_id: categoryId,
        supplier_id: supplierId,
        unit: productForm.unit.trim() || "pcs",
        stock: toNumber(productForm.stock),
        reorder_level: toNumber(productForm.reorderLevel),
        par_level: toNumber(productForm.parLevel),
        cost: toNumber(productForm.cost),
        price: toNumber(productForm.price),
        expiry_date: productForm.expiryDate || null,
        location: productForm.location.trim() || null
      };

      const result = productForm.id
        ? await supabase.from("products").update(payload).eq("id", productForm.id).select("id").single()
        : await supabase.from("products").insert(payload).select("id").single();

      if (result.error) throw result.error;

      await addAudit(productForm.id ? "Product updated" : "Product created", `${payload.name} was saved in the catalog.`, "products", result.data.id);
      setProductForm(emptyProductForm);
      await loadData();
      setMessage("Product saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
    }

    setSaving(false);
  }

  async function recordMovement(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage("");

    const product = products.find((item) => item.id === movementForm.productId);
    const rawQuantity = Math.abs(toNumber(movementForm.quantity, 1));
    const signedQuantity = movementForm.type === "restock" || movementForm.type === "return" ? rawQuantity : -rawQuantity;

    try {
      const { error } = await supabase.from("stock_movements").insert({
        product_id: movementForm.productId,
        type: movementForm.type,
        quantity: signedQuantity,
        reason: movementForm.reason.trim() || movementLabels[movementForm.type],
        reference: movementForm.reference.trim() || null
      });

      if (error) throw error;

      await addAudit("Stock movement recorded", `${product?.name ?? "A product"} changed by ${signedQuantity}.`, "products", movementForm.productId);
      setMovementForm({ productId: selectedProduct?.id ?? "", type: "restock", quantity: "1", reason: "", reference: "" });
      await loadData();
      setMessage("Stock movement saved and product stock updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record stock movement.");
    }

    setSaving(false);
  }

  async function saveSupplier(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("suppliers").insert({
      name: supplierForm.name.trim(),
      contact: supplierForm.contact.trim() || null,
      phone: supplierForm.phone.trim() || null,
      email: supplierForm.email.trim() || null,
      lead_time_days: toNumber(supplierForm.leadTimeDays, 1),
      reliability: 100
    });

    if (error) {
      setMessage(error.message);
    } else {
      await addAudit("Supplier created", `${supplierForm.name} was added as a supplier.`, "suppliers");
      setSupplierForm({ name: "", contact: "", phone: "", email: "", leadTimeDays: "1" });
      await loadData();
      setMessage("Supplier saved.");
    }

    setSaving(false);
  }

  async function saveOrder(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage("");

    const poNumber = `PO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(orders.length + 1).padStart(3, "0")}`;
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        supplier_id: orderForm.supplierId || null,
        status: orderForm.status,
        expected_date: orderForm.expectedDate || null,
        total: toNumber(orderForm.total)
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      await addAudit("Purchase order created", `${poNumber} was created.`, "purchase_orders", data.id);
      setOrderForm({ supplierId: "", status: "draft", expectedDate: "", total: "0" });
      await loadData();
      setMessage("Purchase order saved.");
    }

    setSaving(false);
  }

  function editProduct(product: ProductRow) {
    setSelectedProductId(product.id);
    setProductForm({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      brand: product.brand ?? "",
      categoryName: product.categories?.name ?? "",
      supplierName: product.suppliers?.name ?? "",
      unit: product.unit,
      stock: String(product.stock),
      reorderLevel: String(product.reorder_level),
      parLevel: String(product.par_level),
      cost: String(product.cost),
      price: String(product.price),
      expiryDate: product.expiry_date ?? "",
      location: product.location ?? ""
    });
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-4">
        <div className="max-w-lg rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Supabase is not configured</h1>
          <p className="mt-3 text-sm text-zinc-600">Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel, then redeploy.</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-4">
        <form onSubmit={handleAuth} className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-white">
              <Boxes className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-leaf">Onestop Minimart</p>
              <h1 className="text-2xl font-bold">{authMode === "sign-in" ? "Sign in" : "Create account"}</h1>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <input className="h-11 w-full rounded-md border border-black/10 px-3 text-sm outline-none ring-leaf/20 focus:ring-4" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required autoCapitalize="none" autoComplete="username" />
            <input className="h-11 w-full rounded-md border border-black/10 px-3 text-sm outline-none ring-leaf/20 focus:ring-4" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
          </div>
          {message ? <p className="mt-4 rounded-md bg-paper p-3 text-sm text-zinc-700">{message}</p> : null}
          <button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white hover:bg-emerald-700" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
            {authMode === "sign-in" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="mt-3 w-full text-sm font-semibold text-leaf" onClick={() => setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in")}>
            {authMode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-white">
                <Boxes className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-leaf">Onestop Minimart</p>
                <h1 className="text-2xl font-bold tracking-normal text-ink sm:text-3xl">Inventory Control</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input className="h-11 w-full rounded-md border border-black/10 bg-paper pl-10 pr-3 text-sm outline-none ring-leaf/20 focus:ring-4" placeholder="Search by product, SKU, barcode, supplier, or shelf location" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {[
                ["all", "All"],
                ["low", "Low stock"],
                ["expiring", "Expiring"],
                ["orders", "Orders"]
              ].map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key as Filter)} className={cn("rounded-md border px-3 py-2 text-sm font-semibold", filter === key ? "border-leaf bg-mint text-leaf" : "border-black/10 bg-white text-zinc-700 hover:border-leaf hover:text-leaf")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {message ? <p className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm text-zinc-700">{message}</p> : null}
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        <MetricCard icon={Archive} label="Inventory cost" value={currency(metrics.inventoryCost)} detail={`${number(products.length)} active SKUs tracked`} />
        <MetricCard icon={BarChart3} label="Retail value" value={currency(metrics.retailValue)} detail="Projected value at shelf price" />
        <MetricCard icon={AlertTriangle} label="Needs attention" value={number(metrics.lowStock.length + metrics.expiringSoon.length)} detail={`${metrics.lowStock.length} low stock, ${metrics.expiringSoon.length} expiring soon`} />
        <MetricCard icon={Truck} label="Open orders" value={number(orders.length)} detail={`${suppliers.length} suppliers configured`} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)] lg:px-8">
        <div className="space-y-5">
          <div className="rounded-lg border border-black/10 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-normal">Product Catalog</h2>
                <p className="text-sm text-zinc-500">{loading ? "Loading live inventory..." : "Click a row to edit or view product history."}</p>
              </div>
              <button onClick={() => setProductForm(emptyProductForm)} className="inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf">
                <ClipboardList className="h-4 w-4" aria-hidden />
                New product
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="bg-paper text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                    <th className="px-4 py-3 font-semibold">Reorder</th>
                    <th className="px-4 py-3 font-semibold">Margin</th>
                    <th className="px-4 py-3 font-semibold">Expiry</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const margin = Number(product.price) === 0 ? 0 : ((Number(product.price) - Number(product.cost)) / Number(product.price)) * 100;
                    return (
                      <tr key={product.id} onClick={() => editProduct(product)} className="cursor-pointer border-t border-black/5 align-top hover:bg-paper">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-ink">{product.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{product.sku} / {product.barcode ?? "No barcode"} / {product.categories?.name ?? "Uncategorized"}</p>
                        </td>
                        <td className="px-4 py-4"><StatusPill status={getProductStatus(product)} /></td>
                        <td className="px-4 py-4 font-semibold">{product.stock} <span className="font-normal text-zinc-500">{product.unit}</span></td>
                        <td className="px-4 py-4 text-zinc-600">{product.reorder_level} / par {product.par_level}</td>
                        <td className="px-4 py-4 text-zinc-600">{margin.toFixed(0)}%</td>
                        <td className="px-4 py-4 text-zinc-600">{product.expiry_date ?? "-"}</td>
                        <td className="px-4 py-4 text-zinc-600">{product.location ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loading && filteredProducts.length === 0 ? <p className="p-4 text-sm text-zinc-500">No products found. Add your first product below.</p> : null}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <form onSubmit={saveProduct} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-normal">{productForm.id ? "Edit Product" : "Add Product"}</h2>
                  <p className="text-sm text-zinc-500">Products are saved directly to Supabase.</p>
                </div>
                <PackagePlus className="h-5 w-5 text-leaf" aria-hidden />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Product name" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="SKU" value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} required />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Barcode" value={productForm.barcode} onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Brand" value={productForm.brand} onChange={(event) => setProductForm({ ...productForm, brand: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Category" list="category-options" value={productForm.categoryName} onChange={(event) => setProductForm({ ...productForm, categoryName: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Supplier" list="supplier-options" value={productForm.supplierName} onChange={(event) => setProductForm({ ...productForm, supplierName: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Unit" value={productForm.unit} onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Location" value={productForm.location} onChange={(event) => setProductForm({ ...productForm, location: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Stock" type="number" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Reorder level" type="number" value={productForm.reorderLevel} onChange={(event) => setProductForm({ ...productForm, reorderLevel: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Par level" type="number" value={productForm.parLevel} onChange={(event) => setProductForm({ ...productForm, parLevel: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Cost in PHP" type="number" step="0.01" value={productForm.cost} onChange={(event) => setProductForm({ ...productForm, cost: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Price in PHP" type="number" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} />
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" type="date" value={productForm.expiryDate} onChange={(event) => setProductForm({ ...productForm, expiryDate: event.target.value })} />
              </div>
              <datalist id="category-options">{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist>
              <datalist id="supplier-options">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
              <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white hover:bg-emerald-700" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Save product
              </button>
            </form>

            <form onSubmit={recordMovement} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-normal">Stock Entry</h2>
                  <p className="text-sm text-zinc-500">Restock, sale, waste, returns, and adjustments update stock.</p>
                </div>
                <History className="h-5 w-5 text-leaf" aria-hidden />
              </div>
              <div className="mt-4 space-y-3">
                <select className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" value={movementForm.productId} onChange={(event) => setMovementForm({ ...movementForm, productId: event.target.value })} required>
                  <option value="">Select product</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className="h-10 rounded-md border border-black/10 px-3 text-sm" value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value as StockMovementRow["type"] })}>
                    {Object.entries(movementLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <input className="h-10 rounded-md border border-black/10 px-3 text-sm" placeholder="Quantity" type="number" min="1" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} required />
                </div>
                <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Reason" value={movementForm.reason} onChange={(event) => setMovementForm({ ...movementForm, reason: event.target.value })} />
                <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Reference, receipt, or invoice number" value={movementForm.reference} onChange={(event) => setMovementForm({ ...movementForm, reference: event.target.value })} />
              </div>
              <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-white hover:bg-emerald-700" disabled={saving || products.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Record stock
              </button>
            </form>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-black/10 bg-ink p-4 text-white shadow-soft">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-sun" aria-hidden />
              <h2 className="text-lg font-bold tracking-normal">Action Queue</h2>
            </div>
            <div className="mt-4 space-y-3">
              {reorderSuggestions.length === 0 ? <p className="text-sm text-white/70">No reorder alerts right now.</p> : null}
              {reorderSuggestions.map(({ product, suggestedQuantity }) => (
                <div key={product.id} className="rounded-md bg-white/10 p-3 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-white/65">{product.suppliers?.name ?? "No supplier"}</p>
                    </div>
                    <span className="rounded-md bg-sun px-2 py-1 text-xs font-bold text-ink">Order {suggestedQuantity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-normal">Product History</h2>
              <FileClock className="h-5 w-5 text-leaf" aria-hidden />
            </div>
            <p className="mt-1 text-sm text-zinc-500">{selectedProduct?.name ?? "Select a product"}</p>
            <div className="mt-4 border-l border-black/10 pl-4">
              {productHistory.length === 0 ? <p className="text-sm text-zinc-500">No stock history yet.</p> : null}
              {productHistory.map((movement) => (
                <div key={movement.id} className="relative pb-4">
                  <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-leaf" />
                  <p className="font-semibold">{movementLabels[movement.type]} {movement.quantity > 0 ? "+" : ""}{movement.quantity}</p>
                  <p className="text-sm text-zinc-500">{movement.reason}</p>
                  <p className="mt-1 text-xs text-zinc-400">{new Date(movement.created_at).toLocaleString("en-PH")}</p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={saveSupplier} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-normal">Suppliers</h2>
              <Truck className="h-5 w-5 text-leaf" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Supplier name" value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} required />
              <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Contact person" value={supplierForm.contact} onChange={(event) => setSupplierForm({ ...supplierForm, contact: event.target.value })} />
              <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Phone" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} />
              <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} />
              <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Lead time days" type="number" value={supplierForm.leadTimeDays} onChange={(event) => setSupplierForm({ ...supplierForm, leadTimeDays: event.target.value })} />
            </div>
            <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-black/10 px-4 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf" disabled={saving}>
              <Plus className="h-4 w-4" aria-hidden />
              Add supplier
            </button>
          </form>

          <form onSubmit={saveOrder} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-normal">Purchase Orders</h2>
              <ReceiptText className="h-5 w-5 text-leaf" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              <select className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" value={orderForm.supplierId} onChange={(event) => setOrderForm({ ...orderForm, supplierId: event.target.value })}>
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <select className="h-10 rounded-md border border-black/10 px-3 text-sm" value={orderForm.status} onChange={(event) => setOrderForm({ ...orderForm, status: event.target.value as PurchaseOrderRow["status"] })}>
                  {["draft", "sent", "partial", "received"].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input className="h-10 rounded-md border border-black/10 px-3 text-sm" type="date" value={orderForm.expectedDate} onChange={(event) => setOrderForm({ ...orderForm, expectedDate: event.target.value })} />
              </div>
              <input className="h-10 w-full rounded-md border border-black/10 px-3 text-sm" placeholder="Total in PHP" type="number" step="0.01" value={orderForm.total} onChange={(event) => setOrderForm({ ...orderForm, total: event.target.value })} />
              <button className="inline-flex h-10 items-center gap-2 rounded-md border border-black/10 px-4 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf" disabled={saving}>
                <Plus className="h-4 w-4" aria-hidden />
                Create order
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {orders.slice(0, 4).map((order) => (
                <div key={order.id} className="rounded-md border border-black/10 p-3">
                  <p className="font-semibold">{order.po_number}</p>
                  <p className="mt-1 text-sm text-zinc-500">{order.suppliers?.name ?? "No supplier"} / {order.status} / {currency(Number(order.total))}</p>
                </div>
              ))}
            </div>
          </form>

          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-normal">Audit Log</h2>
              <FileClock className="h-5 w-5 text-leaf" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="border-b border-black/10 pb-3 last:border-0 last:pb-0">
                  <p className="font-semibold">{log.action}</p>
                  <p className="mt-1 text-sm text-zinc-500">{log.detail}</p>
                  <p className="mt-2 text-xs text-zinc-400">{new Date(log.created_at).toLocaleDateString("en-PH")}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
