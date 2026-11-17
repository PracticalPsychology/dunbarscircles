/**
 * Everything this app keeps in the browser, who owns it, and how to wipe it.
 *
 * The browser store is not tied to a Google account, so on a shared computer a
 * second person could see (and, with backup on, upload) the first person's
 * contacts. To prevent that we remember which account the local data belongs
 * to (`dc.local-owner`) and ask before a different account uses it.
 */

export const LOCAL_OWNER_KEY = "dc.local-owner";
export const OWNER_CONFLICT_EVENT = "dc:owner-conflict";
export const OWNER_RESOLVED_EVENT = "dc:owner-resolved";

const CONTACTS_KEY = "yakw_contacts";

/** localStorage key prefixes owned by this app; a device reset removes them. */
const APP_KEY_PREFIXES = ["yakw_", "yakw-", "dc_", "dc."];

export interface LocalOwner {
  uid: string;
  /** ISO timestamp when this browser's data was first tied to the account. */
  at: string;
}

export function getLocalOwner(): LocalOwner | null {
  try {
    const raw = localStorage.getItem(LOCAL_OWNER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.uid === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function setLocalOwner(uid: string): void {
  try {
    localStorage.setItem(
      LOCAL_OWNER_KEY,
      JSON.stringify({
        uid,
        at: new Date().toISOString(),
      } satisfies LocalOwner),
    );
  } catch {
    /* storage unavailable: no owner recorded */
  }
}

/** Number of people stored in this browser (0 when none or unreadable). */
export function localContactCount(): number {
  try {
    const raw =
      localStorage.getItem(CONTACTS_KEY) ??
      sessionStorage.getItem(CONTACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * True when this browser holds contacts that were tied to a different account
 * than `uid`. Empty stores never conflict: nothing is at stake.
 */
export function hasOwnerConflict(uid: string): boolean {
  const owner = getLocalOwner();
  return !!owner && owner.uid !== uid && localContactCount() > 0;
}

/**
 * Called on sign-in. Claims unowned data for `uid`, stays quiet when the owner
 * matches, and returns "conflict" when the data belongs to someone else.
 */
export function checkLocalOwner(uid: string): "ok" | "conflict" {
  const owner = getLocalOwner();
  if (!owner) {
    setLocalOwner(uid);
    return "ok";
  }
  if (owner.uid === uid) return "ok";
  if (localContactCount() === 0) {
    setLocalOwner(uid);
    return "ok";
  }
  return "conflict";
}

/** Account waiting for the user's decision; survives a late-mounting dialog. */
let pendingConflictUid: string | null = null;

export function getPendingOwnerConflict(): string | null {
  return pendingConflictUid;
}

export function clearOwnerConflict(): void {
  pendingConflictUid = null;
}

/** Keys holding people, interactions or history (not consent or flags). */
const PERSONAL_DATA_KEYS = [
  "yakw_contacts",
  "yakw_imported_contacts",
  "dc_interactions",
  "dc_history",
  "dc_contacts_v1_backup",
];

/** Remove contacts, interactions and history only. Keeps consent and flags. */
export function discardLocalContacts(): void {
  for (const k of PERSONAL_DATA_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem(CONTACTS_KEY);
  } catch {
    /* ignore */
  }
}

export function requestOwnerResolution(uid: string): void {
  pendingConflictUid = uid;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(OWNER_CONFLICT_EVENT, { detail: { uid } }),
    );
  }
}

/** All localStorage keys this app owns right now. */
export function appStorageKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && APP_KEY_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

/**
 * Remove every contact, interaction, history entry, consent record and flag
 * this app stored in the browser. Does not touch the cloud. The caller should
 * reload the page afterwards so no stale in-memory copy writes data back.
 */
export function wipeLocalData(): void {
  for (const k of appStorageKeys()) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem(CONTACTS_KEY);
  } catch {
    /* ignore */
  }
}
