import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const body = await request.json();
  const poNumber = `PO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.floor(Math.random() * 900 + 100)}`;
  const { data, error } = await adminSupabase
    .from("purchase_orders")
    .insert({
      po_number: poNumber,
      supplier_id: body.supplierId || null,
      status: body.status,
      expected_date: body.expectedDate || null,
      total: Number(body.total ?? 0)
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await adminSupabase.from("audit_logs").insert({ action: "Purchase order created", detail: `${poNumber} was created.`, entity_type: "purchase_orders", entity_id: data.id });
  return NextResponse.json({ ok: true });
}
