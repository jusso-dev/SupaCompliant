import { test, expect } from "@playwright/test";

test.describe("critical path", () => {
  test("landing → demo overview → assessments → compare", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Continuous database assurance",
    );
    await expect(page.getByText(/Not affiliated with Supabase/i).first()).toBeVisible();

    await page.getByRole("link", { name: /Open demo/i }).first().click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Assessments", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Assessments" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Assessment #6/i }).first().click();
    await expect(page.getByText(/Digest/i).first()).toBeVisible();

    // Status badges include text, not colour alone
    await expect(page.getByText("Pass", { exact: true }).first()).toBeVisible();
  });


  test("login page offers demo path", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: /Continue to demo workspace/i }),
    ).toBeVisible();
  });

  test("frameworks page has disclaimer", async ({ page }) => {
    await page.goto("/app/frameworks");
    await expect(page.getByText(/not certification/i).first()).toBeVisible();
  });
});
