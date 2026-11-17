import { describe, it, expect, beforeEach } from "vitest";
import {
  LOCAL_OWNER_KEY,
  appStorageKeys,
  checkLocalOwner,
  clearOwnerConflict,
  discardLocalContacts,
  getLocalOwner,
  getPendingOwnerConflict,
  hasOwnerConflict,
  localContactCount,
  requestOwnerResolution,
  setLocalOwner,
  wipeLocalData,
} from "../../../lib/device-data";

const people = (n: number) =>
  JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      name: `P${i}`,
      levelId: "inner-circle",
    })),
  );

describe("local data owner", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearOwnerConflict();
  });

  it("claims unowned data for the first account that signs in", () => {
    localStorage.setItem("yakw_contacts", people(3));
    expect(checkLocalOwner("A")).toBe("ok");
    expect(getLocalOwner()?.uid).toBe("A");
  });

  it("lets the owner back in without a prompt", () => {
    localStorage.setItem("yakw_contacts", people(3));
    setLocalOwner("A");
    expect(checkLocalOwner("A")).toBe("ok");
    expect(hasOwnerConflict("A")).toBe(false);
  });

  it("flags a different account when contacts are stored", () => {
    localStorage.setItem("yakw_contacts", people(3));
    setLocalOwner("A");
    expect(hasOwnerConflict("B")).toBe(true);
    expect(checkLocalOwner("B")).toBe("conflict");
    // A conflict never changes the recorded owner by itself.
    expect(getLocalOwner()?.uid).toBe("A");
  });

  it("hands an empty store to the new account without asking", () => {
    setLocalOwner("A");
    expect(checkLocalOwner("B")).toBe("ok");
    expect(getLocalOwner()?.uid).toBe("B");
  });

  it("counts people in local or session storage", () => {
    expect(localContactCount()).toBe(0);
    sessionStorage.setItem("yakw_contacts", people(2));
    expect(localContactCount()).toBe(2);
    localStorage.setItem("yakw_contacts", "not json");
    expect(localContactCount()).toBe(0);
  });

  it("remembers a pending conflict until it is cleared", () => {
    requestOwnerResolution("B");
    expect(getPendingOwnerConflict()).toBe("B");
    clearOwnerConflict();
    expect(getPendingOwnerConflict()).toBeNull();
  });
});

describe("discard and wipe", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("yakw_contacts", people(2));
    localStorage.setItem("dc_interactions", "[]");
    localStorage.setItem("dc_history", "[]");
    localStorage.setItem("dc_contacts_v1_backup", people(2));
    localStorage.setItem("dc.cloud-backup-consent", "[]");
    localStorage.setItem(LOCAL_OWNER_KEY, JSON.stringify({ uid: "A" }));
    localStorage.setItem("theme", "dark");
    sessionStorage.setItem("yakw_contacts", people(2));
  });

  it("discard removes people and logs but keeps consent and settings", () => {
    discardLocalContacts();
    expect(localStorage.getItem("yakw_contacts")).toBeNull();
    expect(localStorage.getItem("dc_interactions")).toBeNull();
    expect(localStorage.getItem("dc_history")).toBeNull();
    expect(localStorage.getItem("dc_contacts_v1_backup")).toBeNull();
    expect(sessionStorage.getItem("yakw_contacts")).toBeNull();
    expect(localStorage.getItem("dc.cloud-backup-consent")).not.toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("wipe removes every app key and leaves unrelated keys alone", () => {
    expect(appStorageKeys().length).toBe(6);
    wipeLocalData();
    expect(appStorageKeys()).toEqual([]);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(sessionStorage.getItem("yakw_contacts")).toBeNull();
  });
});
