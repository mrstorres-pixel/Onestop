import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const body = await request.json();
  const productId = String(body.id ?? "");
  if (!productId) return NextResponse.json({ error: "Product id is required." }, { status: 400 });

  const { data: product, error: productError } = await adminSupabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .single();

  if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });

  const { error } = await adminSupabase
    .from("products")
    .update({ status: "archived" })
    .eq("id", productId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await adminSupabase.from("audit_logs").insert({
    action: "Product archived",
    detail: `${product.name} was archived and removed from active inventory.`,
    entity_type: "products",
    entity_id: product.id
  });

  return NextResponse.json({ ok: true });
}
