import {
  AlertTriangle,
  Archive,
  BarChart3,
  Boxes,
  ClipboardList,
  FileClock,
  History,
  PackagePlus,
  ReceiptText,
  Search,
  ShieldCheck,
  Truck
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import {
  auditLogs,
  getInventoryValue,
  getProductHistory,
  getProductStatus,
  getReorderSuggestions,
  getRetailValue,
  movements,
  products,
  purchaseOrders,
  suppliers
} from "@/lib/inventory";
import { currency, number } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase";

const movementLabels = {
  sale: "Sale",
  restock: "Restock",
  adjustment: "Adjustment",
  return: "Return",
  waste: "Waste"
};

export default function Home() {
  const lowStock = products.filter((product) => getProductStatus(product) !== "healthy");
  const expiringSoon = products.filter((product) => {
    const days = (new Date(product.expiryDate).getTime() - Date.now()) / 86400000;
    return days <= 14;
  });
  const reorderSuggestions = getReorderSuggestions();
  const featuredProduct = products.find((product) => product.id === "prd-003") ?? products[0];
  const productHistory = getProductHistory(featuredProduct.id);

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
              <span className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-paper px-3 py-2 text-sm font-medium text-zinc-700">
                <ShieldCheck className="h-4 w-4 text-leaf" aria-hidden />
                {isSupabaseConfigured ? "Supabase connected" : "Demo data active"}
              </span>
              <button className="inline-flex items-center gap-2 rounded-md bg-leaf px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                <PackagePlus className="h-4 w-4" aria-hidden />
                New stock entry
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                className="h-11 w-full rounded-md border border-black/10 bg-paper pl-10 pr-3 text-sm outline-none ring-leaf/20 focus:ring-4"
                placeholder="Search by product, SKU, barcode, supplier, or shelf location"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {["All", "Low stock", "Expiring", "Orders"].map((item) => (
                <button key={item} className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        <MetricCard icon={Archive} label="Inventory cost" value={currency(getInventoryValue())} detail={`${number(products.length)} active SKUs tracked`} />
        <MetricCard icon={BarChart3} label="Retail value" value={currency(getRetailValue())} detail="Projected value at shelf price" />
        <MetricCard icon={AlertTriangle} label="Needs attention" value={number(lowStock.length + expiringSoon.length)} detail={`${lowStock.length} low stock, ${expiringSoon.length} expiring soon`} />
        <MetricCard icon={Truck} label="Open orders" value={number(purchaseOrders.length)} detail={`${suppliers.length} suppliers configured`} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)] lg:px-8">
        <div className="space-y-5">
          <div className="rounded-lg border border-black/10 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-normal">Product Catalog</h2>
                <p className="text-sm text-zinc-500">Live shelf counts, reorder levels, margins, expiry dates, and locations.</p>
              </div>
              <button className="inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-leaf hover:text-leaf">
                <ClipboardList className="h-4 w-4" aria-hidden />
                Cycle count
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
                  {products.map((product) => {
                    const margin = product.price === 0 ? 0 : ((product.price - product.cost) / product.price) * 100;
                    return (
                      <tr key={product.id} className="border-t border-black/5 align-top">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-ink">{product.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{product.sku} · {product.barcode}</p>
                        </td>
                        <td className="px-4 py-4"><StatusPill status={getProductStatus(product)} /></td>
                        <td className="px-4 py-4 font-semibold">{product.stock} <span className="font-normal text-zinc-500">{product.unit}</span></td>
                        <td className="px-4 py-4 text-zinc-600">{product.reorderLevel} / par {product.parLevel}</td>
                        <td className="px-4 py-4 text-zinc-600">{margin.toFixed(0)}%</td>
                        <td className="px-4 py-4 text-zinc-600">{product.expiryDate}</td>
                        <td className="px-4 py-4 text-zinc-600">{product.location}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-normal">Recent Movements</h2>
                  <p className="text-sm text-zinc-500">Every stock change becomes product history.</p>
                </div>
                <History className="h-5 w-5 text-leaf" aria-hidden />
              </div>
              <div className="mt-4 space-y-3">
                {movements.map((movement) => (
                  <div key={movement.id} className="rounded-md border border-black/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{movement.productName}</p>
                        <p className="mt-1 text-sm text-zinc-500">{movementLabels[movement.type]} · {movement.reason}</p>
                      </div>
                      <span className={movement.quantity > 0 ? "font-bold text-leaf" : "font-bold text-berry"}>
                        {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{movement.reference} · {movement.user}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-normal">Product History</h2>
                  <p className="text-sm text-zinc-500">{featuredProduct.name}</p>
                </div>
                <FileClock className="h-5 w-5 text-leaf" aria-hidden />
              </div>
              <div className="mt-4 border-l border-black/10 pl-4">
                {productHistory.map((movement) => (
                  <div key={movement.id} className="relative pb-4">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-leaf" />
                    <p className="font-semibold">{movementLabels[movement.type]} {movement.quantity > 0 ? "+" : ""}{movement.quantity}</p>
                    <p className="text-sm text-zinc-500">{movement.reason}</p>
                    <p className="mt-1 text-xs text-zinc-400">{new Date(movement.createdAt).toLocaleString("en-SG")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-black/10 bg-ink p-4 text-white shadow-soft">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-sun" aria-hidden />
              <h2 className="text-lg font-bold tracking-normal">Action Queue</h2>
            </div>
            <div className="mt-4 space-y-3">
              {reorderSuggestions.map(({ product, suggestedQuantity }) => (
                <div key={product.id} className="rounded-md bg-white/8 p-3 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-sm text-white/65">{product.supplier}</p>
                    </div>
                    <span className="rounded-md bg-sun px-2 py-1 text-xs font-bold text-ink">Order {suggestedQuantity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-normal">Purchase Orders</h2>
              <ReceiptText className="h-5 w-5 text-leaf" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              {purchaseOrders.map((order) => (
                <div key={order.id} className="rounded-md border border-black/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{order.id}</p>
                      <p className="mt-1 text-sm text-zinc-500">{order.supplier}</p>
                    </div>
                    <span className="rounded-md bg-mint px-2 py-1 text-xs font-bold capitalize text-leaf">{order.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600">{order.items} items · {currency(order.total)} · due {order.expectedDate}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-normal">Audit Log</h2>
              <FileClock className="h-5 w-5 text-leaf" aria-hidden />
            </div>
            <div className="mt-4 space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="border-b border-black/10 pb-3 last:border-0 last:pb-0">
                  <p className="font-semibold">{log.action}</p>
                  <p className="mt-1 text-sm text-zinc-500">{log.detail}</p>
                  <p className="mt-2 text-xs text-zinc-400">{log.user} · {new Date(log.createdAt).toLocaleDateString("en-SG")}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
