import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { downloadBackupFile } from "@/lib/backup-download";
import { readLocalContacts, resolveOwnerConflict } from "@/lib/cloud-sync";
import { getCloudConsent, requestCloudConsent } from "@/lib/cloud-consent";
import {
  OWNER_CONFLICT_EVENT,
  getPendingOwnerConflict,
} from "@/lib/device-data";

/**
 * Shown when someone signs in on a browser whose contacts were tied to a
 * different account. Nothing syncs until the person chooses.
 */
export function OwnerConflictDialog() {
  const [uid, setUid] = useState<string | null>(() =>
    getPendingOwnerConflict(),
  );
  const [count, setCount] = useState(() => readLocalContacts().length);

  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<{ uid?: string }>).detail?.uid;
      if (!id) return;
      setCount(readLocalContacts().length);
      setUid(id);
    };
    window.addEventListener(OWNER_CONFLICT_EVENT, open);
    return () => window.removeEventListener(OWNER_CONFLICT_EVENT, open);
  }, []);

  const finish = (choice: "keep" | "discard") => {
    if (!uid) return;
    resolveOwnerConflict(uid, choice);
    // The consent prompt waited for this decision.
    if (!getCloudConsent(uid)) requestCloudConsent(uid);
    setUid(null);
    toast.success(
      choice === "discard"
        ? "Removed the other account's contacts from this browser"
        : "These contacts now belong to the account you signed in with",
    );
  };

  const signOutInstead = async () => {
    try {
      const { signOut } = await import("@/lib/auth-utils");
      await signOut();
    } catch (e) {
      console.error("Sign-out failed:", e);
    }
    setUid(null);
  };

  return (
    <AlertDialog open={uid !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            These contacts belong to another account
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                This browser holds {count} contacts that were saved under a
                different account than the one you just signed in with. Nothing
                is uploaded or merged until you choose.
              </p>
              <p>
                Download a backup if you want to keep a copy. Discard removes
                them from this browser only.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              downloadBackupFile(readLocalContacts());
              toast.success(`Downloaded a backup of ${count} contacts`);
            }}
          >
            <Download className="w-4 h-4" aria-hidden="true" /> Download a
            backup
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => finish("discard")}
          >
            Discard them and start fresh
          </Button>
          <Button type="button" onClick={() => finish("keep")}>
            Keep them for this account
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void signOutInstead()}
          >
            Sign out instead
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
