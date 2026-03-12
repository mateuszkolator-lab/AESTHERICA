import { Page, expect } from '@playwright/test';

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
}

export async function dismissToasts(page: Page) {
  await page.addLocatorHandler(
    page.locator('[data-sonner-toast], .Toastify__toast, [role="status"].toast, .MuiSnackbar-root'),
    async () => {
      const close = page.locator('[data-sonner-toast] [data-close], [data-sonner-toast] button[aria-label="Close"], .Toastify__close-button, .MuiSnackbar-root button');
      await close.first().click({ timeout: 2000 }).catch(() => {});
    },
    { times: 10, noWaitAfter: true }
  );
}

export async function checkForErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const errorElements = Array.from(
      document.querySelectorAll('.error, [class*="error"], [id*="error"]')
    );
    return errorElements.map(el => el.textContent || '').filter(Boolean);
  });
}

export async function login(page: Page, password: string = 'Matikolati123!') {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('password-input')).toBeVisible();
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-button').click();
  await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 10000 });
}

export async function navigateTo(page: Page, section: string) {
  const navMap: Record<string, string> = {
    'dashboard': 'pulpit',
    'patients': 'pacjenci',
    'planning': 'planowanie',
    'calendar': 'kalendarz',
    'stats': 'statystyki',
    'settings': 'ustawienia'
  };
  const testId = navMap[section.toLowerCase()] || section;
  await page.getByTestId(`nav-${testId}`).click();
}

export async function removeEmergentBadge(page: Page) {
  await page.evaluate(() => {
    const badge = document.querySelector('[class*="emergent"], [id*="emergent-badge"]');
    if (badge) badge.remove();
  });
}
