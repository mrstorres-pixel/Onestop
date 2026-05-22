import { createClient } from "@supabase/supabase-js";
import { pbkdf2Sync, randomBytes } from "crypto";

const [, , usernameArg, passwordArg, roleArg = "staff"] = process.argv;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = String(usernameArg ?? "").trim().toLowerCase();
const password = String(passwordArg ?? "");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!/^[a-z0-9_]{3,30}$/.test(username)) {
  console.error("Username must be 3 to 30 characters using letters, numbers, or underscores.");
  process.exit(1);
}

if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const salt = randomBytes(16).toString("hex");
const passwordHash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");

const { error } = await supabase.from("staff_users").insert({
  username,
  password_salt: salt,
  password_hash: passwordHash,
  role: roleArg
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Created ${roleArg} user: ${username}`);
