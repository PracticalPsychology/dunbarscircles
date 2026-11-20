import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CloudConsentPrompt } from "../../../components/cloud-consent-prompt";
import {
  getCloudConsent,
  requestCloudConsent,
} from "../../../lib/cloud-consent";

describe("cloud backup consent prompt", () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ["Turn on cloud backup", "granted"],
    ["Not now", "declined"],
  ])("records the choice from %s", (label, choice) => {
    render(
      <MemoryRouter>
        <CloudConsentPrompt />
      </MemoryRouter>,
    );
    act(() => requestCloudConsent("test-user"));
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(getCloudConsent("test-user")?.choice).toBe(choice);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
