"use client";

import * as React from "react";
import { AlertTriangle, ShieldX } from "lucide-react";
import { manageUserRole } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RoleRevokeDialogProps {
  userId: string;
  displayName: string;
  currentRole: string;
  disabled?: boolean;
  isLastSuperAdmin?: boolean;
}

export function RoleRevokeDialog({
  userId,
  displayName,
  currentRole,
  disabled = false,
  isLastSuperAdmin = false,
}: RoleRevokeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  if (isLastSuperAdmin) {
    return (
      <span className="inline-flex items-center rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground">
        Protected
      </span>
    );
  }

  const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      await manageUserRole(formData);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/20"
        >
          Revoke Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleConfirm}>
          <input type="hidden" name="target_user_id" value={userId} />
          <input type="hidden" name="target_role" value={currentRole} />
          <input type="hidden" name="assign" value="false" />

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-rose-600 dark:text-rose-400">
              <ShieldX className="size-4.5" />
              Revoke Staff Privileges
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm the removal of administrative privileges for this account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staff Member:</span>
                <span className="font-semibold text-foreground">{displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Role:</span>
                <span className="font-mono font-bold uppercase text-foreground">
                  {currentRole.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account ID:</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {userId}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="leading-relaxed">
                Revoking this role immediately strips operational permissions for this staff member.
                The user account is retained but downgraded to standard customer access.
              </p>
            </div>
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
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? "Revoking..." : "Confirm Revocation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
