import { Page } from "@playwright/test";

/**
 * Utility function to attach grids to HTML pages that don't have their own script tags.
 * This is needed for lightweight HTML examples that rely on tests to handle table attachment.
 */
export async function attachTablesToPage(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import { attachTable } from "/src/attach.js";
      document.querySelectorAll(".bloom-table").forEach((table) => {
        attachTable(table);
      });
    `,
  });

  // Wait a bit for table attachment to complete
  await page.waitForTimeout(100);
}
