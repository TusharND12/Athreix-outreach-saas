import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminConsole } from "@/components/admin/admin-console";

describe("admin operations", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows invalid amount and reason errors inside the credit dialog", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/users")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "customer-1",
                name: "Test customer",
                email: "customer@example.com",
                emailVerified: "2026-08-04T00:00:00.000Z",
                isPlatformAdmin: false,
                approvalStatus: "PENDING",
                suspendedAt: null,
                createdAt: "2026-08-04T00:00:00.000Z",
                searchCount: 0,
                workspaces: [
                  {
                    id: "workspace-1",
                    name: "Test workspace",
                    role: "OWNER",
                    creditBalance: 0,
                    plan: "STARTER",
                    subscriptionStatus: "TRIALING",
                  },
                ],
              },
            ],
            meta: { pagination: { total: 1, pages: 1 } },
          }),
          { status: 200 },
        );
      }
      if (url === "/api/admin/health") {
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }
      if (url === "/api/admin") {
        return new Response(
          JSON.stringify({
            data: {
              users: 1,
              pendingAccounts: 1,
              workspaces: 1,
              searches: 0,
              failedJobs: 0,
              prospects: 0,
              exports: 0,
              creditsConsumed: 0,
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<AdminConsole />);
    await user.click(
      await screen.findByRole(
        "button",
        { name: /Credits/ },
        { timeout: 10_000 },
      ),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Adjust workspace credits",
    });
    await user.type(within(dialog).getByLabelText("Credit amount"), "0");
    await user.type(within(dialog).getByLabelText("Audit reason"), "k");
    await user.click(
      within(dialog).getByRole("button", { name: "Apply adjustment" }),
    );

    expect(
      within(dialog).getByText(
        "Correct the highlighted fields before applying.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Credit amount")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(within(dialog).getByLabelText("Audit reason")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/admin/credits",
        expect.anything(),
      );
    });
  });

  it("requires completion evidence in the privacy request dialog", async () => {
    const requestRecord = {
      id: "privacy-1",
      workspaceId: "workspace-1",
      type: "DELETION",
      status: "RECEIVED",
      dueAt: "2026-09-03T00:00:00.000Z",
      completedAt: null,
      createdAt: "2026-08-04T00:00:00.000Z",
      workspace: { name: "Test workspace" },
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/admin/users")) {
          return new Response(
            JSON.stringify({ data: [], meta: { pagination: { total: 0 } } }),
            { status: 200 },
          );
        }
        if (url === "/api/admin/health") {
          return new Response(JSON.stringify({ data: {} }), { status: 200 });
        }
        if (url === "/api/admin") {
          return new Response(
            JSON.stringify({
              data: {
                users: 0,
                pendingAccounts: 0,
                workspaces: 1,
                searches: 0,
                failedJobs: 0,
                prospects: 0,
                exports: 0,
                creditsConsumed: 0,
              },
            }),
            { status: 200 },
          );
        }
        if (url === "/api/admin/privacy" && !init?.method) {
          return new Response(JSON.stringify({ data: [requestRecord] }), {
            status: 200,
          });
        }
        if (url === "/api/admin/privacy?id=privacy-1") {
          return new Response(
            JSON.stringify({
              data: {
                ...requestRecord,
                requestPayload: {
                  identity: "customer@example.com",
                  details: "Delete the account and workspace data.",
                },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<AdminConsole />);
    await user.click(
      await screen.findByRole("button", { name: "Privacy requests" }),
    );
    await user.click(await screen.findByRole("button", { name: "Review" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Review deletion request",
    });
    await user.selectOptions(
      within(dialog).getByLabelText("Request state"),
      "COMPLETE",
    );
    await user.type(
      within(dialog).getByLabelText("Internal resolution"),
      "Verified and erased all scoped records.",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save request" }),
    );

    expect(within(dialog).getByLabelText("Evidence reference")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH"),
    ).toBe(false);
  });
});
