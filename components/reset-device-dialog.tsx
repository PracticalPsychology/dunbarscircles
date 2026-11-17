import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBackupFile } from "@/lib/backup-download";
import {
  isSignedIn,
  readLocalContacts,
  resetThisDevice,
} from "@/lib/cloud-sync";

export const RESET_PHRASE = "RESET";

interface ResetDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Typed-confirmation dialog for wiping everything this app stored in the
 * browser. Steps: download a backup, choose whether the cloud copy goes too,
 * type RESET.
 */
export function ResetDeviceDialog({
  open,
  onOpenChange,
}: ResetDeviceDialogProps) {
  const [count, setCount] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [skipBackup, setSkipBackup] = useState(false);
  const [deleteCloud, setDeleteCloud] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start fresh and re-read the store every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCount(readLocalContacts().length);
    setSignedIn(isSignedIn());
    setDownloaded(false);
    setSkipBackup(false);
    setDeleteCloud(false);
    setTyped("");
    setBusy(false);
    setError(null);
  }, [open]);

  const backupSatisfied = count === 0 || downloaded || skipBackup;
  const phraseOk = typed.trim().toUpperCase() === RESET_PHRASE;
  const canReset = backupSatisfied && phraseOk && !busy;

  const handleDownload = () => {
    downloadBackupFile(readLocalContacts());
    setDownloaded(true);
    toast.success(`Downloaded a backup of ${count} contacts`);
  };

  const handleReset = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetThisDevice({ deleteCloud: signedIn && deleteCloud });
      window.location.reload();
    } catch (e) {
      setBusy(false);
      setError(
        `${e instanceof Error ? e.message : "Reset failed"}. Nothing was removed from this browser.`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset this device</DialogTitle>
          <DialogDescription>
            This removes all {count} contacts, interactions, change history,
            backup choices and settings that Dunbar&apos;s Circles stored in
            this browser. It cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {count > 0 && (
            <div className="space-y-2">
              <p className="font-medium">1. Download a backup first</p>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                {downloaded ? "Download again" : "Download backup"}
              </Button>
              {downloaded ? (
                <p className="text-green-700" role="status">
                  Backup downloaded.
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reset-skip-backup"
                    checked={skipBackup}
                    onCheckedChange={(v) => setSkipBackup(v === true)}
                  />
                  <Label htmlFor="reset-skip-backup" className="font-normal">
                    I do not need a backup
                  </Label>
                </div>
              )}
            </div>
          )}

          {signedIn && (
            <div className="space-y-2">
              <p className="font-medium">
                {count > 0 ? "2. " : "1. "}Your cloud copy
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="reset-delete-cloud"
                  checked={deleteCloud}
                  onCheckedChange={(v) => setDeleteCloud(v === true)}
                />
                <Label
                  htmlFor="reset-delete-cloud"
                  className="font-normal leading-snug"
                >
                  Also delete my cloud copy
                </Label>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                {deleteCloud
                  ? "Your cloud copy is deleted for good, then this browser is wiped."
                  : "Your cloud copy stays. It returns to this browser if you turn cloud backup on again."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reset-confirm" className="font-medium">
              Type {RESET_PHRASE} to confirm
            </Label>
            <Input
              id="reset-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={RESET_PHRASE}
            />
          </div>

          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleReset()}
            disabled={!canReset}
          >
            {busy ? "Resetting…" : "Reset this device"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
