"use client";

import { useState, useTransition } from "react";
import { UserPlus, AlertTriangle, RefreshCw } from "lucide-react";

import { inviteStaffMember, resetStaffMfa } from "@/lib/staff/actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StaffInviteDialogProps {
  disabled?: boolean;
}

export function StaffInviteDialog({ disabled }: StaffInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"cashier" | "admin" | "super_admin">("admin");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      await inviteStaffMember(formData);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Invite Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            Send an onboarding invitation with designated operational privileges.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Staff Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="staff@1968clothing.com"
              required
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-xs">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="e.g. Maria Santos"
              required
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="requested_role" className="text-xs">Operational Role</Label>
            <select
              id="requested_role"
              name="requested_role"
              value={role}
              onChange={(e) => setRole(e.target.value as "cashier" | "admin" | "super_admin")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="cashier">Cashier (POS & Counter Pickup Only)</option>
              <option value="admin">Administrator (Orders, Catalog, Support)</option>
              <option value="super_admin">Super Administrator (Full System & Security)</option>
            </select>
          </div>

          {role === "super_admin" && (
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-xs font-semibold">Elevated Access Notice</AlertTitle>
              <AlertDescription className="text-[11px] leading-relaxed">
                Super Administrators have unrestricted administrative access to 1968 Clothing operations.
                MFA enrollment is required immediately upon initial sign-in.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-2">
              {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ResetMfaDialogProps {
  userId: string;
  displayName: string;
  disabled?: boolean;
}

export function ResetMfaDialog({ userId, displayName, disabled }: ResetMfaDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    const formData = new FormData();
    formData.set("target_user_id", userId);
    formData.set("confirmed", "true");

    startTransition(async () => {
      await resetStaffMfa(formData);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="text-xs h-8">
          Reset MFA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Reset MFA Factor
          </DialogTitle>
          <DialogDescription className="text-xs">
            Target account: <strong>{displayName}</strong> ({userId})
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 text-xs text-muted-foreground space-y-2">
          <p className="leading-relaxed">
            This removes the selected staff member&apos;s enrolled MFA factor.
            They will need to enroll MFA again before accessing protected Admin operations.
          </p>
          <p className="text-[11px] font-mono bg-muted p-2 rounded">
            Actor identity and timestamp will be logged immutably in the system audit logs.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Confirm MFA Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
