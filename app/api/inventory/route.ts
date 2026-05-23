import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  await adminSupabase
    .from("products")
    .update({ status: "archived", stock: 0 })
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .lte("expiry_date", today);

  const [productResult, categoryResult, supplierResult, movementResult, logResult, expiredResult] = await Promise.all([
    adminSupabase.from("products").select("*, categories(name), suppliers(name)").eq("status", "active").order("name"),
    adminSupabase.from("categories").select("*").order("name"),
    adminSupabase.from("suppliers").select("*").order("name"),
    adminSupabase.from("stock_movements").select("*, products(name, sku)").order("created_at", { ascending: false }).limit(50),
    adminSupabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(30),
    adminSupabase.from("products").select("id, name, expiry_date").eq("status", "archived").eq("expiry_date", today).limit(20)
  ]);

  const error = productResult.error ?? categoryResult.error ?? supplierResult.error ?? movementResult.error ?? logResult.error ?? expiredResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    products: productResult.data ?? [],
    categories: categoryResult.data ?? [],
    suppliers: supplierResult.data ?? [],
    movements: movementResult.data ?? [],
    logs: logResult.data ?? [],
    expiredToday: expiredResult.data ?? []
  });
}
