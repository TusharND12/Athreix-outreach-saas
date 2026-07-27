import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { FormField, PasswordField } from "@/components/auth/form-field";

describe("auth form fields", () => {
  it("associates validation errors with their input", () => {
    render(
      <FormField label="Work email" error="Enter a valid email address." />,
    );
    const input = screen.getByRole("textbox", { name: "Work email" });

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email address.");
  });

  it("lets a keyboard user reveal and hide a password", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" defaultValue="secure-password" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
