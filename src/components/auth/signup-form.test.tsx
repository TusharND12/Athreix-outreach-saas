import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("@/components/auth/oauth-button", () => ({
  OAuthSection: ({
    label,
    consentNotice,
  }: {
    label: string;
    consentNotice?: React.ReactNode;
  }) => (
    <div>
      <button type="button">{label}</button>
      {consentNotice}
    </div>
  ),
}));

describe("authentication recovery and acceptance", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("surfaces failed verification delivery and offers a resend", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              message: "Account created, but delivery failed.",
              verification: { deliveryStatus: "pending_retry" },
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              message:
                "If an unverified account exists, a new verification link will be sent.",
              verification: { deliveryStatus: "sent" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SignupForm
        termsVersion="2026-07-20"
        responsibleUseVersion="2026-07-20"
      />,
    );

    await user.type(screen.getByLabelText("Full name"), "Asha Mehta");
    await user.type(screen.getByLabelText("Work email"), "asha@example.com");
    await user.type(
      screen.getByLabelText("Password", { selector: "input" }),
      "SecurePassword123",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Account created—email delivery needs a retry"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Retry verification email" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/resend-verification",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "asha@example.com",
          password: "SecurePassword123",
        }),
      }),
    );
  });

  it("shows the legal continuation notice beside Google login", () => {
    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(
      screen.getByRole("link", { name: "Responsible Use Policy" }),
    ).toHaveAttribute("href", "/responsible-use");
  });
});
