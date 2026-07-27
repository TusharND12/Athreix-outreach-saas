import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OutreachGenerator } from "./outreach-generator";
import { consumerProspects, prospects } from "@/lib/demo/data";

describe("OutreachGenerator permission controls", () => {
  afterEach(cleanup);
  it("blocks suppressed or limited B2B records before a draft can be copied", () => {
    render(
      <OutreachGenerator prospect={{ ...prospects[0]!, status: "Limited" }} />,
    );

    expect(
      screen.getByText("Outreach drafting is blocked"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy draft/i }),
    ).not.toBeInTheDocument();
  });

  it("blocks a consumer record whose permission needs review", () => {
    const prospect = consumerProspects[0]!;
    render(
      <OutreachGenerator
        prospect={{
          ...prospect,
          consumer: { ...prospect.consumer!, consentStatus: "Review" },
        }}
      />,
    );

    expect(
      screen.getByText("Outreach drafting is blocked"),
    ).toBeInTheDocument();
    expect(screen.getByText(/requires review/i)).toBeInTheDocument();
  });

  it("does not prepopulate a copyable draft even when a channel is permitted", () => {
    render(<OutreachGenerator prospect={consumerProspects[0]!} />);

    expect(screen.getByRole("button", { name: /copy draft/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /generate reviewed draft/i }),
    ).toBeEnabled();
  });
});
