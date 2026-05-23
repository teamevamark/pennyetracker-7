import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SignupSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120),
    phone: z.string().trim().regex(/^\+?[0-9]{6,20}$/),
    password: z.string().min(6).max(72),
    repeat_password: z.string().min(6).max(72),
    panchayath_id: z.string().uuid(),
    ward_id: z.string().uuid(),
  })
  .refine((d) => d.password === d.repeat_password, {
    message: "Passwords do not match",
    path: ["repeat_password"],
  });

export const staffSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupSchema.parse(input))
  .handler(async ({ data }) => {
    const phone = data.phone.startsWith("+") ? data.phone : `+${data.phone}`;

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      phone,
      password: data.password,
      phone_confirm: true,
      user_metadata: { full_name: data.full_name, pending: "true" },
    });
    if (cErr || !created.user) {
      return { ok: false as const, error: cErr?.message ?? "Failed to create account" };
    }
    const userId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.full_name, phone });

    const { data: staff, error: sErr } = await supabaseAdmin
      .from("delivery_staff")
      .insert({
        user_id: userId,
        full_name: data.full_name,
        phone,
        status: "pending",
      })
      .select("id")
      .single();
    if (sErr || !staff) {
      return { ok: false as const, error: sErr?.message ?? "Failed to create staff record" };
    }

    await supabaseAdmin
      .from("delivery_staff_panchayaths")
      .insert({ staff_id: staff.id, panchayath_id: data.panchayath_id });
    await supabaseAdmin
      .from("delivery_staff_wards")
      .insert({ staff_id: staff.id, ward_id: data.ward_id });

    return { ok: true as const };
  });