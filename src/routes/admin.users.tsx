import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

type Role = "super_admin" | "admin" | "delivery";
const ROLES: Role[] = ["super_admin", "admin", "delivery"];

function UsersPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-with-roles"],
    queryFn: async () => {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (ps ?? []).map((p) => ({
        ...p,
        roles: (rs ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
      }));
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, role, has }: { userId: string; role: Role; has: boolean }) => {
      if (has) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles-with-roles"] }); toast.success("Role updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isSuperAdmin ? "Grant or revoke roles for any user." : "Only super admins can change roles."}
      </p>

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              {isSuperAdmin && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>
            )}
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.roles.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                    {p.roles.map((r) => (
                      <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"}>{r}</Badge>
                    ))}
                  </div>
                </TableCell>
                {isSuperAdmin && (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {ROLES.map((r) => {
                        const has = p.roles.includes(r);
                        return (
                          <Button
                            key={r}
                            size="sm"
                            variant={has ? "default" : "outline"}
                            onClick={() => toggle.mutate({ userId: p.id, role: r, has })}
                          >
                            {has ? "−" : "+"} {r}
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
