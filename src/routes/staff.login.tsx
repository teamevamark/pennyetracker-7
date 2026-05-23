import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/staff/login")({
  component: StaffLoginPage,
  head: () => ({ meta: [{ title: "Staff Sign In — Penny-eTracker" }] }),
});

function StaffLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const normalized = phone.startsWith("+") ? phone : `+${phone}`;
      const { data, error } = await supabase.auth.signInWithPassword({ phone: normalized, password });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Sign-in failed");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const list = (roles ?? []).map((r) => r.role);
      if (list.includes("admin") || list.includes("super_admin")) {
        navigate({ to: "/admin" });
      } else if (list.includes("delivery")) {
        navigate({ to: "/landing" });
      } else {
        navigate({ to: "/staff/pending" });
      }
    } catch (e: any) {
      setErr(e?.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Staff Sign In</CardTitle>
          <CardDescription>Sign in with your mobile number and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input id="phone" placeholder="+919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <Link to="/staff/signup" className="hover:text-foreground">Create a staff account</Link>
            <Link to="/landing" className="hover:text-foreground">← Home</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}