import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const body = await request.json();
  const { error } = await adminSupabase.from("suppliers").insert({
    name: String(body.name ?? "").trim(),
    contact: String(body.contact ?? "").trim() || null,
    phone: String(body.phone ?? "").trim() || null,
    email: String(body.email ?? "").trim() || null,
    lead_time_days: Number(body.leadTimeDays ?? 1),
    reliability: 100
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await adminSupabase.from("audit_logs").insert({ action: "Supplier created", detail: `${body.name} was added as a supplier.`, entity_type: "suppliers" });
  return NextResponse.json({ ok: true });
}
