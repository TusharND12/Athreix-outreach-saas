import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}));

vi.mock("@/components/auth/oauth-button", () => ({
  OAuthSection: ({
    label,
    consentNotice,
    onBeforeSignIn,
  }: {
    label: string;
    consentNotice?: React.ReactNode;
    onBeforeSignIn?: () => Promise<boolean>;
  }) => (
    <div>
      <button type="button" onClick={() => void onBeforeSignIn?.()}>
        {label}
      </button>
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
        privacyNoticeVersion="2026-07-20"
      />,
    );

    await user.type(screen.getByLabelText("Full name"), "Asha Mehta");
    await user.type(screen.getByLabelText("Work email"), "asha@example.com");
    await user.type(
      screen.getByLabelText("Password", { selector: "input" }),
      "SecurePassword123",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: /I freely give this specific consent/i,
      }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /I agree to the Terms/i }),
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/register",
      expect.objectContaining({
        body: expect.stringContaining(
          '"privacyConsent":{"noticeVersion":"2026-07-20","accepted":true}',
        ),
      }),
    );

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
    render(<LoginForm privacyNoticeVersion="2026-07-20" />);

    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(
      screen.getByRole("link", { name: "Responsible Use Policy" }),
    ).toHaveAttribute("href", "/responsible-use");
  });

  it("requires and forwards current DPDP consent for email login", async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({ ok: true, error: null });
    render(<LoginForm privacyNoticeVersion="2026-07-20" />);

    await user.type(screen.getByLabelText("Work email"), "asha@example.com");
    await user.type(
      screen.getByLabelText("Password", { selector: "input" }),
      "SecurePassword123",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Give data-processing consent to sign in."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", {
        name: /I freely give this specific consent/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        email: "asha@example.com",
        password: "SecurePassword123",
        privacyConsent: "true",
        privacyNoticeVersion: "2026-07-20",
        redirect: false,
      }),
    );
  });

  it("records consent intent before starting Google login", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { ready: true } })),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<LoginForm privacyNoticeVersion="2026-07-20" />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /I freely give this specific consent/i,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/privacy-consent-intent",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            noticeVersion: "2026-07-20",
            accepted: true,
          }),
        }),
      ),
    );
  });
});
