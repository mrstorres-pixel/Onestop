import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const [movementResult, logResult] = await Promise.all([
    adminSupabase
      .from("stock_movements")
      .select("*, products(name, sku, barcode)")
      .order("created_at", { ascending: false })
      .limit(500),
    adminSupabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  const error = movementResult.error ?? logResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    movements: movementResult.data ?? [],
    logs: logResult.data ?? []
  });
}
