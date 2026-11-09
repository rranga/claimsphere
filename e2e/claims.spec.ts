import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, name: RegExp) {
  await page.goto('/');
  await page.getByRole('button', { name }).click();
  await expect(page.locator('[data-row-index="0"]')).toBeVisible();
}

/** Closed claims are read-only by design, so editing tests work on open claims. */
async function openEditableClaim(page: Page, row: number) {
  await page.goto('/claims?status=In%20Review');
  await page.locator(`[data-row-index="${row}"]`).click();
  await expect(page.getByRole('region', { name: /pages/ })).toBeVisible();
}

test.describe('claims grid', () => {
  test('renders 25k claims with a constant-size DOM and server-side filtering', async ({ page }) => {
    await signInAs(page, /Sofia Alvarez/);
    await expect(page.getByText(/of 25,000 claims/)).toBeVisible();
    const rendered = await page.locator('[role="row"][data-row-index]').count();
    expect(rendered).toBeLessThan(60); // virtualized: only the window is in the DOM

    await page.getByRole('button', { name: 'Filter by status' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Closed' }).click();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/status=Closed/);
    await expect(page.getByRole('row').nth(1)).toContainText('Closed');
  });

  test('RBAC: auditor gets a read-only grid, adjuster only sees their region', async ({ page }) => {
    await signInAs(page, /Marcus Lee/);
    await expect(page.getByRole('button', { name: /delete claim/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /edit claim/i })).toHaveCount(0);

    await page.getByRole('button', { name: /Marcus Lee/ }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await signInAs(page, /Evano Morales/);
    const footer = page.getByText(/of [\d,]+ claims/);
    await expect(footer).not.toContainText('25,000');
    await expect(page.getByRole('button', { name: /delete claim/i })).toHaveCount(0);
  });

  test('paginated mode mirrors the Figma footer', async ({ page }) => {
    await signInAs(page, /Sofia Alvarez/);
    await page.getByRole('radio', { name: 'Paginated' }).click();
    await expect(page.getByText(/Showing data 1 to 50 of 25,000 entries/)).toBeVisible();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(page.getByText(/Showing data 51 to 100/)).toBeVisible();
  });
});

test.describe('document workspace', () => {
  test('split + rotate → atomic save job → new document appears', async ({ page }) => {
    await signInAs(page, /Sofia Alvarez/);
    await openEditableClaim(page, 0);

    await page.getByRole('button', { name: /^FNOL Report/ }).click();
    await page.getByRole('option', { name: /^Page 4/ }).click();
    await page.getByRole('button', { name: 'Split document before this page' }).click();
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await page.getByRole('option', { name: /^Page 1/ }).click();
    await page.getByRole('button', { name: 'Rotate right' }).click();
    await expect(page.getByText('2 unsaved changes')).toBeVisible();

    await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
    await expect(page.getByText('1 unsaved change')).toBeVisible();

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/Saving ·/)).toBeVisible();
    await expect(page.getByText('All changes saved').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^FNOL Report \(part 2\)\.pdf/ })).toBeVisible();
  });

  test('failed save keeps the draft and can be retried', async ({ page }) => {
    await signInAs(page, /Sofia Alvarez/);
    await openEditableClaim(page, 1);
    await page.getByRole('option', { name: /^Page 1/ }).click();
    await page.getByRole('button', { name: 'Rotate left' }).click();
    await page.getByLabel('Simulate failure').check();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(/Save failed — no changes were applied/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('All changes saved').first()).toBeVisible({ timeout: 20_000 });
  });

  test('annotations and page comments', async ({ page }) => {
    await signInAs(page, /Sofia Alvarez/);
    await openEditableClaim(page, 2);
    const firstPage = page.locator('figure[aria-label^="Page 1 of"]');
    await expect(firstPage.locator('canvas')).toBeVisible();

    await page.getByRole('button', { name: 'Highlight' }).click();
    const box = (await firstPage.locator('svg').boundingBox())!;
    await page.mouse.move(box.x + 80, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 380, box.y + 160, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByText(/Highlight by Sofia Alvarez/)).toBeVisible();

    await page.getByLabel(/Add a comment to page/).fill('Policy number verified against PAS.');
    await page.getByRole('button', { name: 'Comment' }).click();
    await expect(page.getByText('Policy number verified against PAS.')).toBeVisible();
  });

  test('auditor sees documents read-only', async ({ page }) => {
    await signInAs(page, /Marcus Lee/);
    await page.locator('[data-row-index="0"]').click();
    await expect(page.getByText(/Read-only ·/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rotate right' })).toHaveCount(0);
  });
});
