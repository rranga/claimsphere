import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Automated WCAG 2.1 A/AA audit (axe-core) of every primary screen. */
const audit = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

const summarize = (violations: Awaited<ReturnType<typeof audit>>['violations']) =>
  violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`);

test.describe('accessibility (WCAG 2.1 AA, axe-core)', () => {
  test('sign-in screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Sofia Alvarez/ })).toBeVisible();
    expect(summarize((await audit(page)).violations)).toEqual([]);
  });

  test('claims grid', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Sofia Alvarez/ }).click();
    await expect(page.locator('[data-row-index="0"]')).toBeVisible();
    await expect(page.getByText('Claims in scope')).toBeVisible();
    expect(summarize((await audit(page)).violations)).toEqual([]);
  });

  test('document workspace', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Evano Morales/ }).click();
    await page.locator('[data-row-index="0"]').click();
    await expect(page.locator('figure canvas').first()).toBeVisible();
    expect(summarize((await audit(page)).violations)).toEqual([]);
  });
});
