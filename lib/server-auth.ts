import { cookies } from "next/headers";
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const sessionCookieName = "onestop_session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const adminSupabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
      })
    : null;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return /^[a-z0-9_]{3,30}$/.test(normalizeUsername(username));
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, storedHash: string) {
  const { hash } = hashPassword(password, salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(storedHash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export async function requireUser() {
  if (!adminSupabase) return null;

  const token = cookies().get(sessionCookieName)?.value;
  if (!token) return null;

  const { data } = await adminSupabase
    .from("staff_sessions")
    .select("id, expires_at, staff_users(id, username, role)")
    .eq("token_hash", hashToken(token))
    .single();

  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;

  const user = Array.isArray(data.staff_users) ? data.staff_users[0] : data.staff_users;
  return user ?? null;
}
