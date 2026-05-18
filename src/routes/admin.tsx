import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LayoutDashboard, Users, MapPin, Map, Settings, ShieldCheck, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Penny-eTracker" }] }),
});

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/staff", label: "Delivery Staff", icon: Users },
  { to: "/admin/locations", label: "Locations", icon: MapPin },
  { to: "/admin/mapping", label: "Mapping", icon: Map },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/users", label: "Roles", icon: ShieldCheck, superOnly: true },
];

function AdminLayout() {
  const { user, loading, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">No admin access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user.email}) doesn't have admin privileges. Ask a super admin to grant you access.
          </p>
          <Button onClick={signOut} variant="outline" className="mt-6">Sign out</Button>
        </div>
      </div>
    );
  }

  const items = nav.filter((n) => !n.superOnly || isSuperAdmin);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-1 px-3">
      {items.map((n) => {
        const active = n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const UserCard = () => (
    <div className="rounded-md border bg-background p-3 text-xs">
      <div className="truncate font-medium">{user.email}</div>
      <div className="mt-0.5 text-muted-foreground">{isSuperAdmin ? "Super Admin" : "Admin"}</div>
      <Button onClick={signOut} variant="ghost" size="sm" className="mt-2 h-7 w-full justify-start gap-2 px-2">
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="px-6 py-5">
          <Link to="/landing" className="text-lg font-semibold tracking-tight">Penny-eTracker</Link>
          <p className="mt-1 text-xs text-muted-foreground">Admin Panel</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="p-3"><UserCard /></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="px-6 py-5 text-left">
                  <SheetTitle>Penny-eTracker</SheetTitle>
                  <p className="text-xs text-muted-foreground">Admin Panel</p>
                </SheetHeader>
                <div className="flex h-[calc(100%-5rem)] flex-col">
                  <div className="flex-1 overflow-y-auto"><NavLinks onClick={() => setOpen(false)} /></div>
                  <div className="p-3"><UserCard /></div>
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/landing" className="font-semibold">Penny-eTracker</Link>
          </div>
          <Button onClick={signOut} variant="ghost" size="icon" aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </header>
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
