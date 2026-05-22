import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

async function ensureCategory(name: string) {
  if (!adminSupabase || !name.trim()) return null;
  const clean = name.trim();
  const { data: existing } = await adminSupabase.from("categories").select("id").ilike("name", clean).single();
  if (existing) return existing.id;
  const { data, error } = await adminSupabase.from("categories").insert({ name: clean }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function ensureSupplier(name: string) {
  if (!adminSupabase || !name.trim()) return null;
  const clean = name.trim();
  const { data: existing } = await adminSupabase.from("suppliers").select("id").ilike("name", clean).single();
  if (existing) return existing.id;
  const { data, error } = await adminSupabase.from("suppliers").insert({ name: clean }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  try {
    const body = await request.json();
    const categoryId = await ensureCategory(String(body.categoryName ?? ""));
    const supplierId = await ensureSupplier(String(body.supplierName ?? ""));
    const payload = {
      name: String(body.name ?? "").trim(),
      sku: String(body.sku ?? "").trim(),
      barcode: String(body.barcode ?? "").trim() || null,
      brand: String(body.brand ?? "").trim() || null,
      category_id: categoryId,
      supplier_id: supplierId,
      unit: String(body.unit ?? "pcs").trim() || "pcs",
      stock: Number(body.stock ?? 0),
      reorder_level: Number(body.reorderLevel ?? 0),
      par_level: Number(body.parLevel ?? 0),
      cost: Number(body.cost ?? 0),
      price: Number(body.price ?? 0),
      expiry_date: body.expiryDate || null,
      location: String(body.location ?? "").trim() || null
    };

    const result = body.id
      ? await adminSupabase.from("products").update(payload).eq("id", body.id).select("id").single()
      : await adminSupabase.from("products").insert(payload).select("id").single();

    if (result.error) throw result.error;

    await adminSupabase.from("audit_logs").insert({
      action: body.id ? "Product updated" : "Product created",
      detail: `${payload.name} was saved in the catalog.`,
      entity_type: "products",
      entity_id: result.data.id
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save product." }, { status: 400 });
  }
}
