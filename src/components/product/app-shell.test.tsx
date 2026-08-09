import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AppShell simplified controls", () => {
  it("opens a unified desktop navigation strip beside the dock", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Workspace content</h1>
      </AppShell>,
    );

    expect(
      screen.getByRole("button", { name: "Expand navigation" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Signal operating system"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));

    const desktopNavigation = screen.getByRole("navigation", {
      name: "Desktop navigation",
    });
    expect(within(desktopNavigation).getAllByRole("link")).toHaveLength(9);
    expect(within(desktopNavigation).getByRole("list")).toHaveClass(
      "grid",
      "grid-cols-9",
    );
    expect(screen.queryByText("Athreix signal field")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Intelligence in motion"),
    ).not.toBeInTheDocument();

    const activeLink = screen.getByRole("link", {
      name: "AI research: Discover signal",
    });
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("is-active");

    await user.click(
      screen.getByRole("button", { name: "Collapse navigation" }),
    );
    expect(
      screen.queryByRole("navigation", { name: "Desktop navigation" }),
    ).not.toBeInTheDocument();
  });

  it("omits privileged admin controls and removed status, theme, notification, and usage-card UI", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Workspace content</h1>
      </AppShell>,
    );

    expect(screen.queryByText("Admin operations")).not.toBeInTheDocument();
    expect(screen.queryByText("Usage and credits")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Search or jump to/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open profile" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Use (dark|light) theme/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open notifications" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Search workspace" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.queryByText("Open admin operations")).not.toBeInTheDocument();
  });

  it("shows the admin control center only to platform administrators", async () => {
    const user = userEvent.setup();
    render(
      <AppShell isPlatformAdmin>
        <h1>Admin workspace content</h1>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));

    const desktopNavigation = screen.getByRole("navigation", {
      name: "Desktop navigation",
    });
    expect(within(desktopNavigation).getAllByRole("link")).toHaveLength(10);
    expect(
      within(desktopNavigation).getByRole("link", {
        name: "Admin operations: Customers and systems",
      }),
    ).toHaveAttribute("href", "/admin");
    expect(within(desktopNavigation).getByRole("list")).toHaveClass(
      "grid-cols-10",
    );
  });
});
