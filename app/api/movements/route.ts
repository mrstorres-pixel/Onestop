import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const body = await request.json();
  const type = String(body.type);
  const rawQuantity = Math.abs(Number(body.quantity ?? 1));
  const quantity = type === "restock" || type === "return" ? rawQuantity : -rawQuantity;

  const { error } = await adminSupabase.from("stock_movements").insert({
    product_id: body.productId,
    type,
    quantity,
    reason: String(body.reason ?? type).trim(),
    reference: String(body.reference ?? "").trim() || null
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await adminSupabase.from("audit_logs").insert({
    action: "Stock movement recorded",
    detail: `Product stock changed by ${quantity}.`,
    entity_type: "products",
    entity_id: body.productId
  });

  return NextResponse.json({ ok: true });
}
