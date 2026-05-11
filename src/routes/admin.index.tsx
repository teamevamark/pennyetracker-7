import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [staff, wards, roles] = await Promise.all([
        supabase.from("delivery_staff").select("*", { count: "exact", head: true }),
        supabase.from("wards").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }),
      ]);
      return { staff: staff.count ?? 0, wards: wards.count ?? 0, roles: roles.count ?? 0 };
    },
  });

  const cards = [
    { label: "Delivery Staff", value: data?.staff ?? "—", icon: Users, to: "/admin/staff" },
    { label: "Wards", value: data?.wards ?? "—", icon: MapPin, to: "/admin/locations" },
    { label: "Role Assignments", value: data?.roles ?? "—", icon: ShieldCheck, to: "/admin/users" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Overview of your delivery operations.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
