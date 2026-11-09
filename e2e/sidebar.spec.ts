import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('sidebar (Figma expanded / minimized states)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Sofia Alvarez/ }).click();
    await expect(page.locator('[data-row-index="0"]')).toBeVisible();
  });

  test('minimizes to icons, keeps accessible names, and remembers the choice', async ({ page }) => {
    const sidebar = page.locator('#primary-sidebar');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false'); // 1600 px viewport → expanded by default

    // Regression: the toggle must sit fully inside the 256 px column (it was once clipped by the title).
    const bar = (await sidebar.boundingBox())!;
    const toggle = (await page.getByRole('button', { name: 'Collapse sidebar' }).boundingBox())!;
    expect(toggle.x + toggle.width).toBeLessThanOrEqual(bar.x + bar.width - 1);

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // Width animates over 200 ms; Figma's minimized frame is 102 px wide.
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(102);

    // Labels are visually hidden but still name the links, and appear as tooltips on focus.
    const claimsLink = page.getByRole('link', { name: 'Claims' });
    await expect(claimsLink).toHaveAttribute('aria-current', 'page');
    await claimsLink.focus();
    await expect(page.getByRole('tooltip', { name: 'Claims' })).toBeVisible();

    await page.reload();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  test('minimized state passes the WCAG 2.1 AA audit', async ({ page }) => {
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    const { violations } = await new AxeBuilder({ page })
      .include('#primary-sidebar')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });

  test('defaults to minimized on narrower screens', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.goto('/');
    await page.getByRole('button', { name: /Sofia Alvarez/ }).click();
    await expect(page.locator('#primary-sidebar')).toHaveAttribute('data-collapsed', 'true');
    await page.close();
  });
});
