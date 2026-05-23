import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!data?.some((r) => r.role === "super_admin")) {
    throw new Error("Only super admins can perform this action");
  }
}

export const listPendingStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("delivery_staff")
      .select(
        "id, full_name, phone, status, created_at, delivery_staff_panchayaths(panchayath_id, panchayaths(name)), delivery_staff_wards(ward_id, wards(name, ward_number))",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id as string,
      full_name: s.full_name as string,
      phone: s.phone as string,
      created_at: s.created_at as string,
      panchayaths: (s.delivery_staff_panchayaths ?? [])
        .map((p: any) => p.panchayaths?.name)
        .filter(Boolean) as string[],
      wards: (s.delivery_staff_wards ?? [])
        .map((w: any) =>
          w.wards?.ward_number ? `Ward ${w.wards.ward_number}` : w.wards?.name,
        )
        .filter(Boolean) as string[],
    }));
  });

const ApproveSchema = z.object({
  staff_id: z.string().uuid(),
  role: z.enum(["admin", "delivery"]),
});

export const approveStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApproveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const { data: staff, error: sErr } = await supabaseAdmin
      .from("delivery_staff")
      .select("user_id")
      .eq("id", data.staff_id)
      .single();
    if (sErr || !staff?.user_id) throw new Error(sErr?.message ?? "Staff not found");

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: staff.user_id, role: data.role });
    if (rErr && !rErr.message.includes("duplicate")) throw new Error(rErr.message);

    const { error: uErr } = await supabaseAdmin
      .from("delivery_staff")
      .update({ status: "active" })
      .eq("id", data.staff_id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true as const };
  });

const RejectSchema = z.object({ staff_id: z.string().uuid() });

export const rejectStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RejectSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("delivery_staff")
      .update({ status: "rejected" })
      .eq("id", data.staff_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });