import { NextResponse } from "next/server";
import { adminSupabase, requireUser } from "@/lib/server-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminSupabase) return NextResponse.json({ error: "Server database is not configured." }, { status: 500 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });

  const { error } = await adminSupabase.from("categories").insert({ name });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await adminSupabase.from("audit_logs").insert({ action: "Category created", detail: `${name} was added as a category.`, entity_type: "categories" });
  return NextResponse.json({ ok: true });
}
