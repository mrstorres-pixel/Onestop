import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

async function ensureCategory(name: string) {
  if (!adminSupabase) return null;
  const clean = name.trim();
  if (!clean) return null;
  const { data: existing } = await adminSupabase.from("categories").select("id").ilike("name", clean).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await adminSupabase.from("categories").insert({ name: clean }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function ensureSupplier(name: string) {
  if (!adminSupabase || !name.trim()) return null;
  const clean = name.trim();
  const { data: existing } = await adminSupabase.from("suppliers").select("id").ilike("name", clean).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await adminSupabase.from("suppliers").insert({ name: clean }).select("id").single();
  if (error) throw error;
  return data.id;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message);
    if (message.includes("products_barcode_key")) return "That barcode is already used by another product.";
    if (message.includes("products_sku_key")) return "That product code is already used by another product.";
    return message;
  }
  return "Unable to save product.";
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });

    const categoryId = await ensureCategory(String(body.categoryName ?? "Consumable"));
    const supplierId = await ensureSupplier(String(body.supplierName ?? ""));
    const barcode = String(body.barcode ?? "").trim();
    const existingProduct = body.id
      ? await adminSupabase.from("products").select("sku").eq("id", body.id).maybeSingle()
      : { data: null, error: null };

    if (existingProduct.error) throw existingProduct.error;

    if (barcode) {
      const duplicateBarcode = await adminSupabase
        .from("products")
        .select("id")
        .eq("barcode", barcode)
        .neq("id", String(body.id ?? "00000000-0000-0000-0000-000000000000"))
        .maybeSingle();

      if (duplicateBarcode.error) throw duplicateBarcode.error;
      if (duplicateBarcode.data) return NextResponse.json({ error: "That barcode is already used by another product." }, { status: 400 });
    }

    const generatedSku = barcode || `${slugify(name) || "product"}-${Date.now()}`;
    const requestedSku = String(body.sku ?? "").trim();
    const sku = existingProduct.data?.sku ?? (requestedSku || generatedSku);
    const payload = {
      name,
      sku,
      barcode: barcode || null,
      brand: String(body.brand ?? "").trim() || null,
      category_id: categoryId,
      supplier_id: supplierId,
      unit: String(body.unit ?? "pcs").trim() || "pcs",
      stock: Math.max(0, toNumber(body.stock)),
      reorder_level: Math.max(0, toNumber(body.reorderLevel)),
      par_level: Math.max(0, toNumber(body.parLevel)),
      cost: Math.max(0, toNumber(body.cost)),
      price: Math.max(0, toNumber(body.price)),
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
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
