import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/staff/pending")({
  component: PendingPage,
  head: () => ({ meta: [{ title: "Pending Approval — Penny-eTracker" }] }),
});

function PendingPage() {
  const { user, roles, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/staff/login" });
    else if (isAdmin) navigate({ to: "/admin" });
    else if (roles.includes("delivery")) navigate({ to: "/landing" });
  }, [user, roles, loading, isAdmin, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Pending approval</CardTitle>
          <CardDescription>
            Your account is awaiting super admin approval. You'll get access as soon as it's reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => signOut().then(() => navigate({ to: "/staff/login" }))}>
            Sign out
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/landing">← Home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}