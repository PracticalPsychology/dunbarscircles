import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const resetThisDevice = vi.fn();
const downloadBackupFile = vi.fn();
let signedIn = true;
let contacts: unknown[] = [{ id: "a", name: "A", levelId: "inner-circle" }];

vi.mock("@/lib/cloud-sync", () => ({
  isSignedIn: () => signedIn,
  readLocalContacts: () => contacts,
  resetThisDevice: (...a: unknown[]) => resetThisDevice(...a),
}));
vi.mock("@/lib/backup-download", () => ({
  downloadBackupFile: (...a: unknown[]) => downloadBackupFile(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ResetDeviceDialog } from "@/components/reset-device-dialog";

const resetButton = () =>
  screen.getByRole("button", { name: "Reset this device" });

describe("ResetDeviceDialog", () => {
  beforeEach(() => {
    resetThisDevice.mockReset().mockResolvedValue(undefined);
    downloadBackupFile.mockReset();
    signedIn = true;
    contacts = [{ id: "a", name: "A", levelId: "inner-circle" }];
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: vi.fn() },
      writable: true,
    });
  });

  it("stays disabled until a backup step and the phrase are done", async () => {
    const user = userEvent.setup();
    render(<ResetDeviceDialog open onOpenChange={() => {}} />);
    expect(resetButton()).toBeDisabled();

    await user.type(screen.getByLabelText(/type reset/i), "reset");
    expect(resetButton()).toBeDisabled(); // phrase ok, backup step not done

    await user.click(screen.getByRole("button", { name: /download backup/i }));
    expect(downloadBackupFile).toHaveBeenCalledTimes(1);
    expect(resetButton()).toBeEnabled();
  });

  it("accepts the skip-backup checkbox instead of a download", async () => {
    const user = userEvent.setup();
    render(<ResetDeviceDialog open onOpenChange={() => {}} />);
    await user.click(screen.getByLabelText(/do not need a backup/i));
    await user.type(screen.getByLabelText(/type reset/i), "RESET");
    expect(resetButton()).toBeEnabled();
  });

  it("keeps the cloud copy unless the box is ticked", async () => {
    const user = userEvent.setup();
    render(<ResetDeviceDialog open onOpenChange={() => {}} />);
    await user.click(screen.getByLabelText(/do not need a backup/i));
    await user.type(screen.getByLabelText(/type reset/i), "RESET");
    await user.click(resetButton());
    await waitFor(() =>
      expect(resetThisDevice).toHaveBeenCalledWith({ deleteCloud: false }),
    );
  });

  it("passes deleteCloud when the box is ticked", async () => {
    const user = userEvent.setup();
    render(<ResetDeviceDialog open onOpenChange={() => {}} />);
    await user.click(screen.getByLabelText(/do not need a backup/i));
    await user.click(screen.getByLabelText(/delete my cloud copy/i));
    await user.type(screen.getByLabelText(/type reset/i), "RESET");
    await user.click(resetButton());
    await waitFor(() =>
      expect(resetThisDevice).toHaveBeenCalledWith({ deleteCloud: true }),
    );
  });

  it("hides the cloud option when signed out and skips backup for 0 contacts", async () => {
    signedIn = false;
    contacts = [];
    const user = userEvent.setup();
    render(<ResetDeviceDialog open onOpenChange={() => {}} />);
    expect(screen.queryByLabelText(/delete my cloud copy/i)).toBeNull();
    await user.type(screen.getByLabelText(/type reset/i), "RESET");
    expect(resetButton()).toBeEnabled();
  });

  it("shows the error and does not reload when the reset fails", async () => {
    resetThisDevice.mockRejectedValue(new Error("Permission denied"));
    const user = userEvent.setup();
    render(<ResetDeviceDialog open onOpenChange={() => {}} />);
    await user.click(screen.getByLabelText(/do not need a backup/i));
    await user.type(screen.getByLabelText(/type reset/i), "RESET");
    await user.click(resetButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /nothing was removed/i,
    );
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
