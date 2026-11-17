import { describe, it, expect, vi, beforeEach } from "vitest";

let authCallback: ((u: { uid: string } | null) => void) | null = null;
const deleteAllForUser = vi.fn();

vi.mock("../../../firebase-config", () => ({ auth: {}, db: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (
    _a: unknown,
    cb: (u: { uid: string } | null) => void,
  ) => {
    authCallback = cb;
  },
}));
vi.mock("../../../lib/cloud-sync-core", async (orig) => ({
  ...(await orig<typeof import("../../../lib/cloud-sync-core")>()),
  deleteAllForUser: (...a: unknown[]) => deleteAllForUser(...a),
  syncUser: vi.fn().mockResolvedValue({
    merged: [],
    upserted: 0,
    deleted: 0,
    migrated: 0,
  }),
  pushUser: vi.fn().mockResolvedValue({ upserted: 0, deleted: 0 }),
}));

import {
  deleteCloudCopy,
  resetThisDevice,
  resolveOwnerConflict,
  startCloudSync,
  turnOffCloudBackup,
} from "../../../lib/cloud-sync";
import { hasCloudConsent, setCloudConsent } from "../../../lib/cloud-consent";
import {
  getLocalOwner,
  getPendingOwnerConflict,
  setLocalOwner,
} from "../../../lib/device-data";

const person = JSON.stringify([
  { id: "c1", name: "P", levelId: "inner-circle" },
]);

describe("cloud sync: delete, turn off, reset, owner conflict", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    deleteAllForUser.mockReset().mockResolvedValue({ deleted: 7 });
    startCloudSync();
  });

  it("refuses to delete a cloud copy when signed out", async () => {
    authCallback?.(null);
    await expect(deleteCloudCopy()).rejects.toThrow(/sign in/i);
    expect(deleteAllForUser).not.toHaveBeenCalled();
  });

  it("deletes the signed-in account's copy", async () => {
    authCallback?.({ uid: "A" });
    await expect(deleteCloudCopy()).resolves.toEqual({ deleted: 7 });
    expect(deleteAllForUser).toHaveBeenCalledWith(expect.anything(), "A");
  });

  it("turns backup off and keeps the cloud copy by default", async () => {
    authCallback?.({ uid: "A" });
    setCloudConsent("A", "granted");
    await turnOffCloudBackup();
    expect(deleteAllForUser).not.toHaveBeenCalled();
    expect(hasCloudConsent("A")).toBe(false);
  });

  it("leaves backup on when cloud deletion fails", async () => {
    authCallback?.({ uid: "A" });
    setCloudConsent("A", "granted");
    deleteAllForUser.mockRejectedValue(new Error("denied"));
    await expect(turnOffCloudBackup({ deleteCopy: true })).rejects.toThrow(
      "denied",
    );
    expect(hasCloudConsent("A")).toBe(true);
  });

  it("reset wipes the browser and keeps the cloud copy by default", async () => {
    authCallback?.({ uid: "A" });
    localStorage.setItem("yakw_contacts", person);
    localStorage.setItem("dc_history", "[]");
    await resetThisDevice({ deleteCloud: false });
    expect(deleteAllForUser).not.toHaveBeenCalled();
    expect(localStorage.getItem("yakw_contacts")).toBeNull();
    expect(localStorage.getItem("dc_history")).toBeNull();
  });

  it("reset deletes the cloud copy first, and wipes nothing if that fails", async () => {
    authCallback?.({ uid: "A" });
    localStorage.setItem("yakw_contacts", person);
    deleteAllForUser.mockRejectedValue(new Error("offline"));
    await expect(resetThisDevice({ deleteCloud: true })).rejects.toThrow(
      "offline",
    );
    expect(localStorage.getItem("yakw_contacts")).toBe(person);

    deleteAllForUser.mockResolvedValue({ deleted: 3 });
    await resetThisDevice({ deleteCloud: true });
    expect(localStorage.getItem("yakw_contacts")).toBeNull();
  });

  it("holds sync and raises a conflict for a different account", () => {
    localStorage.setItem("yakw_contacts", person);
    setLocalOwner("A");
    setCloudConsent("B", "granted");
    authCallback?.({ uid: "B" });
    expect(getPendingOwnerConflict()).toBe("B");
    expect(getLocalOwner()?.uid).toBe("A");
  });

  it("resolves a conflict by discarding or keeping", () => {
    localStorage.setItem("yakw_contacts", person);
    setLocalOwner("A");
    authCallback?.({ uid: "B" });
    resolveOwnerConflict("B", "discard");
    expect(localStorage.getItem("yakw_contacts")).toBeNull();
    expect(getLocalOwner()?.uid).toBe("B");
    expect(getPendingOwnerConflict()).toBeNull();

    localStorage.setItem("yakw_contacts", person);
    setLocalOwner("A");
    authCallback?.({ uid: "B" });
    resolveOwnerConflict("B", "keep");
    expect(localStorage.getItem("yakw_contacts")).toBe(person);
    expect(getLocalOwner()?.uid).toBe("B");
  });
});
