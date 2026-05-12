// Edge function: create-admin-user
// Allows a super_admin to create an admin/delivery user with phone+password.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization" }, 401);
    }

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check super_admin
    const { data: roles, error: rErr } = await admin
      .from("user_roles").select("role").eq("user_id", callerId);
    if (rErr) return json({ error: rErr.message }, 500);
    if (!roles?.some((r: any) => r.role === "super_admin")) {
      return json({ error: "Only super admins can create users" }, 403);
    }

    const body = await req.json();
    const full_name = String(body.full_name ?? "").trim();
    const rawPhone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    const role = (body.role === "delivery" ? "delivery" : "admin") as "admin" | "delivery";

    if (!full_name || full_name.length > 120) return json({ error: "Invalid full_name" }, 400);
    if (!/^\+?[0-9]{6,20}$/.test(rawPhone)) return json({ error: "Invalid phone" }, 400);
    if (password.length < 6) return json({ error: "Password too short" }, 400);

    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { full_name },
    });
    if (cErr) return json({ error: cErr.message }, 400);
    const newUserId = created.user!.id;

    await admin.from("profiles").upsert({ id: newUserId, full_name, phone });

    if (role !== "delivery") {
      await admin.from("user_roles").insert({ user_id: newUserId, role });
    }

    return json({ id: newUserId });
  } catch (e: any) {
    console.error("create-admin-user error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
