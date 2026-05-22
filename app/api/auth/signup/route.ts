import { NextResponse } from "next/server";
import { adminSupabase, createSessionToken, hashPassword, hashToken, isValidUsername, normalizeUsername, sessionCookieName } from "@/lib/server-auth";

export async function POST(request: Request) {
  if (!adminSupabase) {
    return NextResponse.json({ error: "Server auth is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel." }, { status: 500 });
  }

  const body = await request.json();
  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");

  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Username must be 3 to 30 characters using letters, numbers, or underscores." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const { salt, hash } = hashPassword(password);
  const { data: user, error } = await adminSupabase
    .from("staff_users")
    .insert({ username, password_salt: salt, password_hash: hash, role: "staff" })
    .select("id, username, role")
    .single();

  if (error) {
    return NextResponse.json({ error: error.code === "23505" ? "Username is already taken." : error.message }, { status: 400 });
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  await adminSupabase.from("staff_sessions").insert({ user_id: user.id, token_hash: hashToken(token), expires_at: expiresAt });

  const response = NextResponse.json({ user });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
  return response;
}
