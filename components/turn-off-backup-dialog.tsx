import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteCloudCopy, turnOffCloudBackup } from "@/lib/cloud-sync";

interface TurnOffBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * "turn-off": backup is on; offer to keep or delete the cloud copy.
   * "delete-only": backup is already off; just offer to delete the copy.
   */
  mode: "turn-off" | "delete-only";
}

/** Choice shown when cloud backup is switched off, or a copy is deleted. */
export function TurnOffBackupDialog({
  open,
  onOpenChange,
  mode,
}: TurnOffBackupDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const run = async (deleteCopy: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "delete-only") {
        const { deleted } = await deleteCloudCopy();
        toast.success(`Deleted your cloud copy (${deleted} documents)`);
      } else {
        const { deleted } = await turnOffCloudBackup({ deleteCopy });
        toast.success(
          deleteCopy
            ? `Cloud backup off. Deleted ${deleted} documents from the cloud.`
            : "Cloud backup off. Your cloud copy was kept.",
        );
      }
      onOpenChange(false);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Something went wrong"}. Backup settings are unchanged.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteOnly = mode === "delete-only";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {deleteOnly ? "Delete your cloud copy?" : "Turn off cloud backup?"}
          </DialogTitle>
          <DialogDescription>
            {deleteOnly
              ? "This permanently deletes the copy of your contacts stored under your account. Contacts in this browser are not touched."
              : "Your contacts stay in this browser either way. Choose what happens to the copy stored under your account."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {!deleteOnly && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void run(false)}
            >
              Turn off, keep my cloud copy
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => void run(true)}
          >
            {deleteOnly
              ? "Delete my cloud copy"
              : "Turn off and delete my cloud copy"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
