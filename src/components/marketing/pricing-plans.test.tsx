import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PricingPlans } from "@/components/marketing/pricing-plans";

describe("public pricing", () => {
  afterEach(() => cleanup());

  it("publishes the three approved USD monthly prices", () => {
    render(<PricingPlans />);

    expect(screen.getByText("$29")).toBeInTheDocument();
    expect(screen.getByText("$59")).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
    expect(screen.getAllByText("USD / month")).toHaveLength(3);
    expect(screen.getByText("250 monthly credits")).toBeInTheDocument();
    expect(screen.getByText("500 monthly credits")).toBeInTheDocument();
    expect(screen.getByText("1,000 monthly credits")).toBeInTheDocument();
  });

  it("explains that Paddle confirms localized totals and tax", () => {
    render(<PricingPlans />);

    expect(
      screen.getByText(/Paddle shows the final localized total/i),
    ).toBeInTheDocument();
  });
});
