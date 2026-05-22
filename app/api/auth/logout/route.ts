import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSupabase, hashToken, sessionCookieName } from "@/lib/server-auth";

export async function POST() {
  const token = cookies().get(sessionCookieName)?.value;
  if (adminSupabase && token) {
    await adminSupabase.from("staff_sessions").delete().eq("token_hash", hashToken(token));
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName);
  return response;
}
