import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const body = await request.json();
  const saleId = String(body.saleId ?? "");
  if (!saleId) return NextResponse.json({ error: "Sale id is required." }, { status: 400 });

  const { data: sale, error: saleError } = await adminSupabase
    .from("wholesale_sales")
    .select("*")
    .eq("id", saleId)
    .single();

  if (saleError) return NextResponse.json({ error: saleError.message }, { status: 400 });
  if (String(sale.payment_method).startsWith("VOIDED")) {
    return NextResponse.json({ error: "This transaction is already voided." }, { status: 400 });
  }

  const { data: items, error: itemsError } = await adminSupabase
    .from("wholesale_sale_items")
    .select("*")
    .eq("sale_id", saleId);

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  const { error: movementError } = await adminSupabase.from("stock_movements").insert(
    (items ?? []).map((item) => ({
      product_id: item.product_id,
      type: "return",
      quantity: Number(item.quantity),
      reason: "Voided transaction restored to inventory",
      reference: `VOID-${sale.invoice_no}`
    }))
  );

  if (movementError) return NextResponse.json({ error: movementError.message }, { status: 400 });

  const { error: updateError } = await adminSupabase
    .from("wholesale_sales")
    .update({ payment_method: `VOIDED - ${sale.payment_method}` })
    .eq("id", saleId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await adminSupabase.from("audit_logs").insert({
    action: "Transaction voided",
    detail: `${sale.invoice_no} was voided and inventory quantities were restored.`,
    entity_type: "wholesale_sales",
    entity_id: saleId
  });

  return NextResponse.json({ ok: true });
}
