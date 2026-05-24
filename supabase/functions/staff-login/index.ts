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
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const rawPhone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    if (!/^\+?[0-9]{6,20}$/.test(rawPhone)) return json({ error: "Invalid phone" }, 400);
    if (!password) return json({ error: "Password required" }, 400);

    const digits = rawPhone.replace(/\D/g, "");
    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
    const email = `staff-${digits}@staff.penny-etracker.local`;

    let result = await auth.auth.signInWithPassword({ email, password });
    if (result.error) {
      const user = await findUserByPhone(admin, phone);
      if (user && user.email !== email) {
        const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
          email,
          email_confirm: true,
          user_metadata: { ...(user.user_metadata ?? {}), phone },
        });
        if (updateError) return json({ error: updateError.message }, 400);
        result = await auth.auth.signInWithPassword({ email, password });
      }
    }

    if (result.error || !result.data.session || !result.data.user) {
      return json({ error: result.error?.message ?? "Invalid login" }, 400);
    }

    return json({ session: result.data.session, user: result.data.user });
  } catch (e: any) {
    console.error("staff-login error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

async function findUserByPhone(admin: ReturnType<typeof createClient>, phone: string) {
  const wantDigits = phone.replace(/\D/g, "");
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => {
      const candidates = [user.phone, user.user_metadata?.phone].filter(Boolean) as string[];
      return candidates.some((c) => c.replace(/\D/g, "") === wantDigits);
    });
    if (found || data.users.length < 1000) return found ?? null;
  }
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}