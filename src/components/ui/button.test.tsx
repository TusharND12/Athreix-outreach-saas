import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("fires the primary action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run search</Button>);

    await user.click(screen.getByRole("button", { name: "Run search" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("announces and disables its loading state", () => {
    render(<Button loading>Generating</Button>);
    const button = screen.getByRole("button", { name: "Generating" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
