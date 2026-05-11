import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staff")({ component: StaffPage });

type Staff = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  vehicle_number: string | null;
  license_number: string | null;
  status: string;
  ward_id: string | null;
  wards?: { name: string; panchayaths: { name: string } } | null;
};

function StaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_staff")
        .select("*, wards(name, panchayaths(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Staff[];
    },
  });

  const { data: wards = [] } = useQuery({
    queryKey: ["wards-flat"],
    queryFn: async () => {
      const { data } = await supabase.from("wards").select("id, name, panchayaths(name, districts(name))");
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your delivery team.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Add Staff</Button>
          </DialogTrigger>
          <AddStaffDialog wards={wards as any} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Ward</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && staff.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No staff yet. Add your first delivery person.</TableCell></TableRow>
            )}
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell>{s.vehicle_number ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.wards ? `${s.wards.name}, ${s.wards.panchayaths.name}` : "—"}
                </TableCell>
                <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function AddStaffDialog({ wards, onClose }: { wards: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", vehicle_number: "", license_number: "", ward_id: "", status: "active",
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = { ...form, ward_id: form.ward_id || null, email: form.email || null };
      const { error } = await supabase.from("delivery_staff").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff added");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add delivery staff</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Email (optional)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle number" value={form.vehicle_number} onChange={(v) => setForm({ ...form, vehicle_number: v })} />
          <Field label="License number" value={form.license_number} onChange={(v) => setForm({ ...form, license_number: v })} />
        </div>
        <div className="space-y-1.5">
          <Label>Assign Ward</Label>
          <Select value={form.ward_id} onValueChange={(v) => setForm({ ...form, ward_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
            <SelectContent>
              {wards.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} — {w.panchayaths?.name} ({w.panchayaths?.districts?.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={!form.full_name || !form.phone || create.isPending}>
          {create.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
