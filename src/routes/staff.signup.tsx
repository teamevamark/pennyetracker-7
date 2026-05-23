import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { staffSignup } from "@/lib/staff-signup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/staff/signup")({
  component: StaffSignupPage,
  head: () => ({ meta: [{ title: "Staff Sign Up — Penny-eTracker" }] }),
});

function StaffSignupPage() {
  const navigate = useNavigate();
  const signup = useServerFn(staffSignup);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    panchayath_id: "",
    ward_id: "",
    password: "",
    repeat_password: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { data: panchayaths = [] } = useQuery({
    queryKey: ["panchayaths-public"],
    queryFn: async () => {
      const { data } = await supabase.from("panchayaths").select("id, name").order("name");
      return data ?? [];
    },
  });
  const { data: wards = [] } = useQuery({
    queryKey: ["wards-public"],
    queryFn: async () => {
      const { data } = await supabase.from("wards").select("id, name, ward_number, panchayath_id").order("ward_number");
      return data ?? [];
    },
  });

  const wardsForPanchayath = useMemo(
    () => wards.filter((w) => w.panchayath_id === form.panchayath_id),
    [wards, form.panchayath_id],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (form.password !== form.repeat_password) {
      setErr("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await signup({ data: form });
      if (!res.ok) throw new Error(res.error);
      setDone(true);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Request submitted</CardTitle>
            <CardDescription>
              Your account is pending super admin approval. You'll be able to sign in once an admin approves it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/staff/login">Go to staff sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Staff Sign Up</CardTitle>
          <CardDescription>Create a staff account. A super admin will approve and assign your role.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input id="phone" placeholder="+919876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Panchayath</Label>
              <Select value={form.panchayath_id} onValueChange={(v) => setForm({ ...form, panchayath_id: v, ward_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Select panchayath" /></SelectTrigger>
                <SelectContent>
                  {panchayaths.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ward</Label>
              <Select value={form.ward_id} onValueChange={(v) => setForm({ ...form, ward_id: v })} disabled={!form.panchayath_id}>
                <SelectTrigger><SelectValue placeholder={form.panchayath_id ? "Select ward" : "Pick panchayath first"} /></SelectTrigger>
                <SelectContent>
                  {wardsForPanchayath.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.ward_number ? `Ward ${w.ward_number}` : w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rpassword">Repeat password</Label>
              <Input id="rpassword" type="password" minLength={6} value={form.repeat_password} onChange={(e) => setForm({ ...form, repeat_password: e.target.value })} required />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={loading || !form.panchayath_id || !form.ward_id}>
              {loading ? "Submitting…" : "Sign up"}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <Link to="/staff/login" className="hover:text-foreground">Already have an account? Sign in</Link>
            <button type="button" onClick={() => navigate({ to: "/landing" })} className="hover:text-foreground">← Home</button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}