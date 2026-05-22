import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const [productResult, categoryResult, supplierResult, movementResult, orderResult, logResult] = await Promise.all([
    adminSupabase.from("products").select("*, categories(name), suppliers(name)").eq("status", "active").order("name"),
    adminSupabase.from("categories").select("*").order("name"),
    adminSupabase.from("suppliers").select("*").order("name"),
    adminSupabase.from("stock_movements").select("*, products(name, sku)").order("created_at", { ascending: false }).limit(50),
    adminSupabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(20),
    adminSupabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20)
  ]);

  const error = productResult.error ?? categoryResult.error ?? supplierResult.error ?? movementResult.error ?? orderResult.error ?? logResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    products: productResult.data ?? [],
    categories: categoryResult.data ?? [],
    suppliers: supplierResult.data ?? [],
    movements: movementResult.data ?? [],
    orders: orderResult.data ?? [],
    logs: logResult.data ?? []
  });
}
