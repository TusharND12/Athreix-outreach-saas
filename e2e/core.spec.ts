import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();

  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

async function signInAsDemoAdmin(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Fill demo account credentials" })
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(
    page.getByRole("heading", { name: "Who should you meet next?" }),
  ).toBeVisible();
}

test.describe("public experience", () => {
  test("landing page presents evidence-led B2B research and trust boundaries", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Know exactly who to reach and why.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start a live search" }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Live B2B intelligence", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/does not automate unsolicited mass messaging/i),
    ).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
  });

  test("@mobile navigation remains usable without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "Trust" })).toBeVisible();
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("authentication entry points expose recovery and legal consent", async ({
    page,
  }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Terms/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Responsible Use/i }).first(),
    ).toBeVisible();

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(
      page.getByRole("heading", { name: "Reset your password" }),
    ).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
    await signInAsDemoAdmin(page);
  });

  test("unknown routes fail gracefully without exposing workspace data", async ({
    page,
  }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(
      page.getByRole("heading", { name: "This route is outside the brief." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Return to research" }),
    ).toBeVisible();
  });
});

test.describe("prospect workflows", () => {
  test("creates and reviews a B2B prospect search", async ({ page }) => {
    const brief = "Find companies in India";
    await page.goto("/search");

    await expect(
      page.getByRole("heading", { name: "Who should you meet next?" }),
    ).toBeVisible();
    await expect(page.getByText("Business prospects")).toHaveCount(0);
    await expect(page.getByText("Consumer audience")).toHaveCount(0);
    await page.getByLabel("Search brief").fill(brief);
    await page.getByLabel("Lead limit").fill("3");
    await page.getByRole("button", { name: /Generate prospects/ }).click();

    await expect(page).toHaveURL(/\/search\/.+/);
    await expect(
      page.getByRole("heading", { name: brief, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: /(?:prospect|lead) results/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /^Open details for / })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByText(/Why (this is|they are) a good prospect/i).first(),
    ).toBeVisible();
  });

  test("reviews outreach and prepares an audited export", async ({ page }) => {
    await page.goto("/search/demo-search-b2b");

    await expect(
      page.getByRole("table", { name: /(?:prospect|lead) results/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /^Open details for / })
      .first()
      .click();
    await page.getByRole("tab", { name: "Outreach drafts" }).click();
    await page.getByRole("button", { name: "Generate reviewed draft" }).click();
    await expect(page.getByLabel("Cold email draft")).not.toHaveValue("");
    await expect(
      page.getByText(/Draft only — sending is your responsibility/i),
    ).toBeVisible();

    await page.getByRole("button", { name: "Close prospect details" }).click();
    await page
      .getByRole("checkbox", { name: /^Select (?!all visible prospects)/ })
      .first()
      .check();
    await page.getByRole("button", { name: "Export selected" }).click();
    await expect(
      page.getByRole("dialog", { name: "Prepare export" }),
    ).toBeVisible();
    await page.getByLabel(/I confirm I am authorized to export/i).check();
    await page.getByRole("button", { name: "Create export" }).click();
    await expect(
      page.getByRole("heading", { name: "Your export is ready" }),
    ).toBeVisible();
  });

  test("creates, renames, duplicates, and deletes a saved list", async ({
    page,
  }) => {
    const listName = `E2E shortlist ${Date.now()}`;
    const renamed = `${listName} reviewed`;
    await page.goto("/lists");

    await expect(
      page.getByRole("heading", { name: "Saved lists", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New list" }).click();
    await page.getByLabel("List name").fill(listName);
    await page.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByText(`Created ${listName}`)).toBeVisible();

    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("List name").fill(renamed);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("List renamed")).toBeVisible();
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByText("List duplicated")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete list" }).click();
    await expect(
      page.getByText(/deleted; its prospects remain/i),
    ).toBeVisible();
  });
});

test.describe("product surfaces", () => {
  test("keeps primary operator pages responsive and accessible", async ({
    page,
  }) => {
    await signInAsDemoAdmin(page);
    const surfaces = [
      ["/search", "Who should you meet next?"],
      ["/exports", "Exports"],
      ["/usage", "Usage and credits"],
      ["/settings", "Settings"],
      ["/billing", "Billing"],
      ["/profile", "Profile"],
    ] as const;

    for (const [path, heading] of surfaces) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const overflows = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflows, `${path} should not overflow horizontally`).toBe(false);
    }

    await expectNoSeriousAccessibilityViolations(page);
  });

  test("@mobile keeps the authenticated shell and result controls usable", async ({
    page,
  }) => {
    await page.goto("/search");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Saved lists" }).click();
    await expect(
      page.getByRole("heading", { name: "Saved lists", exact: true }),
    ).toBeVisible();

    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
    await expectNoSeriousAccessibilityViolations(page);
  });
});
