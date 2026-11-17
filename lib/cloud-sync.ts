/**
 * Cloud backup sync: the ONLY module that reads or writes contacts in
 * Firestore.
 *
 * Model
 * - The browser store (`localStorage["yakw_contacts"]`, session storage as
 *   fallback) is the source of truth. Every page reads it.
 * - Firestore collection `user_contacts` is a mirror of that store for the
 *   signed-in user, one document per contact with the deterministic id
 *   `<uid>_<contactId>`. Saves are idempotent and can never duplicate.
 * - On sign-in: pull the cloud copy (plus the retired `contacts` collection),
 *   merge it into the browser store (newer `updatedAt` wins), push the merged
 *   set, delete stale and legacy documents.
 * - After that, every local change schedules a push (debounced), which
 *   upserts all contacts and deletes cloud documents whose contact is gone.
 *
 * See docs/ops/DATA_FLOWS.md.
 */
import { auth, db } from "../firebase-config";
import { onAuthStateChanged } from "firebase/auth";
import { CONTACTS_CHANGED_EVENT } from "./contact-events";
import { prepareStoreWrite } from "./contact-store-write";
import { migrateContactsUp } from "./schema-migrations";
import {
  CLOUD_CONSENT_CHANGED_EVENT,
  hasCloudConsent,
  setCloudConsent,
} from "./cloud-consent";
import {
  checkLocalOwner,
  clearOwnerConflict,
  discardLocalContacts,
  requestOwnerResolution,
  setLocalOwner,
  wipeLocalData,
} from "./device-data";
import {
  deleteAllForUser,
  pushUser,
  syncUser,
  isBuiltInDemo,
  type RawContact,
} from "./cloud-sync-core";

export {
  CONTACTS_COLLECTION,
  LEGACY_CONTACTS_COLLECTION,
  cloudDocId,
  toCloud,
  fromCloud,
  mergeContacts,
  isBuiltInDemo,
} from "./cloud-sync-core";
export { CONTACTS_CHANGED_EVENT };

export const CONTACTS_STORAGE_KEY = "yakw_contacts";
const PUSH_DEBOUNCE_MS = 800;

// ---------------------------------------------------------------------------
// Browser store access
// ---------------------------------------------------------------------------

export function readLocalContacts(): RawContact[] {
  try {
    const raw =
      localStorage.getItem(CONTACTS_STORAGE_KEY) ??
      sessionStorage.getItem(CONTACTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c.id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeLocalContacts(contacts: RawContact[]): void {
  // Cloud data merged into this browser counts as an import in history.
  const text = JSON.stringify(prepareStoreWrite(contacts, "import"));
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, text);
  } catch {
    sessionStorage.setItem(CONTACTS_STORAGE_KEY, text);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONTACTS_CHANGED_EVENT, { detail: "cloud-sync" }),
    );
  }
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

let currentUid: string | null = null;
/** uid whose cloud copy has been merged in this session. Pushes wait for it. */
let readyUid: string | null = null;
let inFlight: Promise<void> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushAgain = false;
let started = false;

export type SyncState =
  | "signed-out"
  /** Signed in, but the user has not turned on cloud backup. */
  | "off"
  | "syncing"
  | "synced"
  | "error";
let state: SyncState = "signed-out";
let lastError: string | null = null;
export function getSyncState(): { state: SyncState; error: string | null } {
  return { state, error: lastError };
}

/**
 * Pull + merge + push for the signed-in user. Called on sign-in; safe to
 * call again (idempotent).
 */
export async function syncOnSignIn(uid: string): Promise<void> {
  if (!db) return;
  // Local contacts that belong to another account never sync until the user
  // decides what to do with them (components/owner-conflict-dialog.tsx).
  if (checkLocalOwner(uid) === "conflict") {
    readyUid = null;
    state = "off";
    requestOwnerResolution(uid);
    return;
  }
  // Nothing leaves the browser without the user's recorded choice.
  if (!hasCloudConsent(uid)) {
    readyUid = null;
    state = "off";
    return;
  }
  state = "syncing";
  try {
    const local = readLocalContacts();
    const { merged } = await syncUser(
      db,
      uid,
      local,
      (list) => migrateContactsUp(list) as RawContact[],
    );
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      writeLocalContacts(merged);
    }
    if (currentUid !== uid) return; // signed out meanwhile
    readyUid = uid;
    state = "synced";
    lastError = null;
  } catch (e) {
    state = "error";
    lastError = e instanceof Error ? e.message : String(e);
    console.warn("Cloud sync failed; contacts are safe in this browser:", e);
  }
}

/** Push the browser store to the cloud now. */
export async function pushNow(): Promise<{
  upserted: number;
  deleted: number;
}> {
  const uid = currentUid;
  if (!uid || !db) throw new Error("Sign in to back up your contacts.");
  if (!hasCloudConsent(uid)) {
    throw new Error("Turn on cloud backup first.");
  }
  if (readyUid !== uid) {
    await syncOnSignIn(uid);
    if (readyUid !== uid) throw new Error(lastError ?? "Cloud sync failed");
    return { upserted: readLocalContacts().length, deleted: 0 };
  }
  state = "syncing";
  try {
    const result = await pushUser(
      db,
      uid,
      readLocalContacts().filter((c) => !isBuiltInDemo(c)),
    );
    state = "synced";
    lastError = null;
    return result;
  } catch (e) {
    state = "error";
    lastError = e instanceof Error ? e.message : String(e);
    throw e;
  }
}

function runPush(): void {
  if (inFlight) {
    pushAgain = true;
    return;
  }
  inFlight = pushNow()
    .then(() => undefined)
    .catch((e) => console.warn("Cloud backup push failed, will retry:", e))
    .finally(() => {
      inFlight = null;
      if (pushAgain) {
        pushAgain = false;
        schedulePush();
      }
    });
}

/**
 * Call after any change to the browser store. No-op when signed out.
 * Debounced so a burst of edits becomes one write.
 */
export function notifyLocalChange(): void {
  if (!currentUid || readyUid !== currentUid) return;
  schedulePush();
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    runPush();
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Resolve an owner conflict for `uid`. "keep" ties the contacts in this
 * browser to the new account; "discard" removes them first. Either way the
 * conflict is cleared and sync is retried for the signed-in account.
 */
export function resolveOwnerConflict(
  uid: string,
  choice: "keep" | "discard",
): void {
  if (choice === "discard") discardLocalContacts();
  setLocalOwner(uid);
  clearOwnerConflict();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONTACTS_CHANGED_EVENT, { detail: "owner-resolved" }),
    );
  }
  if (currentUid === uid) void syncOnSignIn(uid);
}

/** Stop all pending and future pushes until sync is started again. */
export function pauseSync(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  pushAgain = false;
  readyUid = null;
  state = currentUid ? "off" : "signed-out";
}

/**
 * Delete this account's cloud copy of the contact list. Signed-in only.
 * Works whether or not backup is on, so a leftover copy can always be
 * removed. Pushes are paused first so nothing re-creates the documents.
 */
export async function deleteCloudCopy(): Promise<{ deleted: number }> {
  const uid = currentUid;
  if (!uid || !db) throw new Error("Sign in to delete your cloud copy.");
  pauseSync();
  try {
    return await deleteAllForUser(db, uid);
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    throw e;
  }
}

/**
 * Turn cloud backup off for the signed-in account, optionally deleting the
 * cloud copy first. If deletion fails, backup stays on and the error is
 * thrown, so the choice the user made is never half-applied.
 */
export async function turnOffCloudBackup(
  options: { deleteCopy: boolean } = { deleteCopy: false },
): Promise<{ deleted: number }> {
  const uid = currentUid;
  if (!uid) throw new Error("Sign in first.");
  let deleted = 0;
  if (options.deleteCopy) deleted = (await deleteCloudCopy()).deleted;
  setCloudConsent(uid, "declined");
  return { deleted };
}

export interface ResetOptions {
  /** Also delete the signed-in account's cloud copy. */
  deleteCloud: boolean;
}

/**
 * Reset this device: optionally delete the cloud copy, then wipe everything
 * the app stored in this browser. The cloud copy is deleted first; if that
 * fails, nothing local is touched. Without `deleteCloud` the cloud copy is
 * left alone, and pushes are paused so the wipe is not mirrored to it.
 */
export async function resetThisDevice(options: ResetOptions): Promise<void> {
  if (options.deleteCloud) await deleteCloudCopy();
  pauseSync();
  wipeLocalData();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CONTACTS_CHANGED_EVENT, { detail: "device-reset" }),
    );
  }
}

/** Start listening for sign-in. Idempotent; called by the storage services. */
export function startCloudSync(): void {
  if (started || !auth) return;
  started = true;
  onAuthStateChanged(auth, (user) => {
    currentUid = user?.uid ?? null;
    if (!user) {
      readyUid = null;
      state = "signed-out";
      return;
    }
    void syncOnSignIn(user.uid); // no-op until the user turns backup on
  });
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => notifyLocalChange());
    // Turning backup on starts the first sync; turning it off stops pushes.
    window.addEventListener(CLOUD_CONSENT_CHANGED_EVENT, () => {
      if (!currentUid) return;
      if (hasCloudConsent(currentUid)) void syncOnSignIn(currentUid);
      else {
        readyUid = null;
        state = "off";
      }
    });
  }
}

export function currentUserId(): string | null {
  return currentUid;
}

export function isSignedIn(): boolean {
  return currentUid !== null;
}
