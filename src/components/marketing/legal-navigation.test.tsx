import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

describe("public legal navigation", () => {
  afterEach(() => cleanup());

  it("links every Paddle-required policy from the public footer", () => {
    render(<MarketingFooter />);

    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Refund policy" })).toHaveAttribute(
      "href",
      "/refund-policy",
    );
  });

  it("includes the policies in the sitemap and crawler allowlist", () => {
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    const urls = sitemap().map((entry) => entry.url);
    const rules = robots().rules;
    const allow = Array.isArray(rules) ? rules[0]?.allow : rules?.allow;

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://example.com/terms",
        "https://example.com/privacy",
        "https://example.com/refund-policy",
      ]),
    );
    expect(allow).toEqual(
      expect.arrayContaining(["/terms", "/privacy", "/refund-policy"]),
    );

    if (previousAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    }
  });
});
