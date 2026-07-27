import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportDialog } from "./export-dialog";

describe("ExportDialog record scope", () => {
  afterEach(cleanup);

  it("uses the current selection whenever the dialog opens", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ExportDialog
        open={false}
        onOpenChange={onOpenChange}
        selectedCount={0}
        selectedIds={[]}
        searchId="search-1"
      />,
    );

    rerender(
      <ExportDialog
        open
        onOpenChange={onOpenChange}
        selectedCount={2}
        selectedIds={["result-1", "result-2"]}
        searchId="search-1"
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Records")).toHaveValue("selected"),
    );

    rerender(
      <ExportDialog
        open={false}
        onOpenChange={onOpenChange}
        selectedCount={0}
        selectedIds={[]}
        searchId="search-1"
      />,
    );
    rerender(
      <ExportDialog
        open
        onOpenChange={onOpenChange}
        selectedCount={0}
        selectedIds={[]}
        searchId="search-1"
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Records")).toHaveValue("score"),
    );
  });
});
