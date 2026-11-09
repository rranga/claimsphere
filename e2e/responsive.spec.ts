import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const audit = async (page: Page) =>
  (
    await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  ).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Sofia Alvarez/ }).click();
  await expect(page.locator('[data-row-index="0"]')).toBeVisible();
}

const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('phone (390 × 844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('icon-only navigation, card rows and a sort control', async ({ page }) => {
    await signIn(page);

    const sidebar = page.locator('#primary-sidebar');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(64);
    await expect(page.getByRole('button', { name: /(Collapse|Expand) sidebar/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Claims' })).toBeVisible();

    // Cards instead of an 11-column table: no column headers; sorting via a select.
    await expect(page.getByRole('columnheader')).toHaveCount(0);
    await expect(page.locator('[data-row-index="0"]')).toContainText(/CLM-\d{4}-\d+/);
    await page.getByLabel('Sort by').selectOption({ label: 'Amount: high to low' });
    await expect(page).toHaveURL(/sort=amount/);

    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(await audit(page)).toEqual([]);
  });

  test('document workspace moves side panels into sheets', async ({ page }) => {
    await signIn(page);
    await page.goto('/claims?status=In%20Review');
    await page.locator('[data-row-index="0"]').click();
    await expect(page.locator('figure canvas').first()).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);

    await page.getByRole('button', { name: /^Pages/ }).click();
    const pagesSheet = page.getByRole('dialog', { name: 'Documents & pages' });
    await expect(pagesSheet.getByRole('navigation', { name: 'Claim documents' })).toBeVisible();
    await expect(pagesSheet.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Comments/ }).click();
    await expect(page.getByRole('dialog', { name: 'Comments & annotations' })).toBeVisible();
    await expect(page.getByLabel(/Add a comment to page/)).toBeVisible();
    await page.keyboard.press('Escape');

    expect(await audit(page)).toEqual([]);
  });
});

test.describe('tablet portrait (768 × 1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true });

  test('icon rail without toggle; cards; documents column with comments in a sheet', async ({ page }) => {
    await signIn(page);
    await expect.poll(async () => (await page.locator('#primary-sidebar').boundingBox())!.width).toBe(102);
    await expect(page.getByRole('button', { name: /(Collapse|Expand) sidebar/ })).toHaveCount(0);
    await expect(page.getByRole('columnheader')).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);

    await page.locator('[data-row-index="0"]').click();
    await expect(page.getByRole('navigation', { name: 'Claim documents' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pages/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Comments/ })).toBeVisible();
  });
});
