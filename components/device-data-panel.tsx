import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CONTACTS_CHANGED_EVENT,
  getSyncState,
  isSignedIn,
  readLocalContacts,
} from "@/lib/cloud-sync";
import { CLOUD_CONSENT_CHANGED_EVENT } from "@/lib/cloud-consent";
import { ResetDeviceDialog } from "@/components/reset-device-dialog";
import { TurnOffBackupDialog } from "@/components/turn-off-backup-dialog";

/** Settings section: what is stored on this device, and how to remove it. */
export function DeviceDataPanel() {
  const [count, setCount] = useState(() => readLocalContacts().length);
  const [signedIn, setSignedIn] = useState(() => isSignedIn());
  const [backupOn, setBackupOn] = useState(() => {
    const s = getSyncState().state;
    return s !== "off" && s !== "signed-out";
  });
  const [showReset, setShowReset] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    const read = () => {
      setCount(readLocalContacts().length);
      setSignedIn(isSignedIn());
      const s = getSyncState().state;
      setBackupOn(s !== "off" && s !== "signed-out");
    };
    const t = setInterval(read, 2000);
    window.addEventListener(CONTACTS_CHANGED_EVENT, read);
    window.addEventListener(CLOUD_CONSENT_CHANGED_EVENT, read);
    return () => {
      clearInterval(t);
      window.removeEventListener(CONTACTS_CHANGED_EVENT, read);
      window.removeEventListener(CLOUD_CONSENT_CHANGED_EVENT, read);
    };
  }, []);

  return (
    <section
      id="device-data"
      aria-labelledby="device-data-heading"
      className="space-y-3 scroll-mt-24"
    >
      <h2 id="device-data-heading" className="text-lg font-semibold">
        Your data on this device
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {count} contacts are stored in this browser.{" "}
        {signedIn
          ? backupOn
            ? "Cloud backup is on for your account."
            : "Cloud backup is off for your account."
          : "You are not signed in, so nothing is stored in the cloud."}{" "}
        Resetting removes contacts, interactions, history and settings from this
        browser. It never touches other devices.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setShowReset(true)}
          className="gap-2 text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" /> Reset this device…
        </Button>
        {signedIn && (
          <Button
            variant="outline"
            onClick={() => setShowDelete(true)}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete my cloud
            copy…
          </Button>
        )}
      </div>
      <ResetDeviceDialog open={showReset} onOpenChange={setShowReset} />
      <TurnOffBackupDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        mode="delete-only"
      />
    </section>
  );
}
