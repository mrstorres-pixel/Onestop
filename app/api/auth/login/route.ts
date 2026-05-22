import { NextResponse } from "next/server";
import { adminSupabase, createSessionToken, hashToken, normalizeUsername, sessionCookieName, verifyPassword } from "@/lib/server-auth";

export async function POST(request: Request) {
  if (!adminSupabase) {
    return NextResponse.json({ error: "Server auth is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel." }, { status: 500 });
  }

  const body = await request.json();
  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");

  const { data: user } = await adminSupabase
    .from("staff_users")
    .select("id, username, role, password_salt, password_hash")
    .eq("username", username)
    .single();

  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  await adminSupabase.from("staff_sessions").insert({ user_id: user.id, token_hash: hashToken(token), expires_at: expiresAt });

  const response = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
  return response;
}
