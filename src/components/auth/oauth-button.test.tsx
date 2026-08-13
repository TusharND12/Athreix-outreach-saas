import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OAuthSection } from "@/components/auth/oauth-button";

const mocks = vi.hoisted(() => ({
  getProviders: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  getProviders: mocks.getProviders,
  signIn: mocks.signIn,
}));

describe("OAuthSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not render a blank loading bar while providers are checked", () => {
    mocks.getProviders.mockReturnValue(new Promise(() => undefined));

    render(<OAuthSection label="Continue with Google" />);

    expect(
      screen.queryByLabelText("Checking available sign-in methods"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).not.toBeInTheDocument();
  });
});
