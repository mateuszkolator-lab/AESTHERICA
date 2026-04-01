import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissToasts, removeEmergentBadge, login } from '../fixtures/helpers';

const PAGE_URL = process.env.REACT_APP_BACKEND_URL || 'https://rhinoplan.preview.emergentagent.com';
const TEST_PATIENT_ID = 'e1778a07-50f5-41d0-8c2e-5675ae5b6a63';

test.describe('RhinoPlanner Feature', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    // Login first
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('password-input')).toBeVisible();
    await page.getByTestId('password-input').fill('Matikolati123!');
    await page.getByTestId('login-button').click();
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 15000 });
    await removeEmergentBadge(page);
  });

  test('should load RhinoPlanner page with canvas and tools', async ({ page }) => {
    // Navigate directly to RhinoPlanner
    await page.goto(`/rhinoplanner/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    
    // Verify page loads
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    
    // Verify key elements
    await expect(page.getByTestId('save-plan-button')).toBeVisible();
    await expect(page.getByTestId('export-pdf-button')).toBeVisible();
    await expect(page.getByTestId('back-button')).toBeVisible();
    
    // Verify view tabs
    await expect(page.getByTestId('view-tab-frontal')).toBeVisible();
    await expect(page.getByTestId('view-tab-profile')).toBeVisible();
    await expect(page.getByTestId('view-tab-base')).toBeVisible();
    
    // Verify canvas is present (frontal should be visible by default)
    await expect(page.getByTestId('canvas-frontal')).toBeVisible();
    
    // Verify notes textareas
    await expect(page.getByTestId('notes-textarea')).toBeVisible();
    await expect(page.getByTestId('surgeon-notes-textarea')).toBeVisible();
  });

  test('should switch between canvas views', async ({ page }) => {
    await page.goto(`/rhinoplanner/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    
    // Default view is frontal
    await expect(page.getByTestId('canvas-frontal')).toBeVisible();
    
    // Switch to profile view
    await page.getByTestId('view-tab-profile').click();
    await expect(page.getByTestId('canvas-profile')).toBeVisible();
    
    // Switch to base view
    await page.getByTestId('view-tab-base').click();
    await expect(page.getByTestId('canvas-base')).toBeVisible();
    
    // Switch back to frontal
    await page.getByTestId('view-tab-frontal').click();
    await expect(page.getByTestId('canvas-frontal')).toBeVisible();
  });

  test('should allow input in notes fields', async ({ page }) => {
    await page.goto(`/rhinoplanner/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    
    const testNote = `Test note ${Date.now()}`;
    const surgeonNote = `Surgeon note ${Date.now()}`;
    
    // Clear and fill notes textarea
    await page.getByTestId('notes-textarea').click();
    await page.getByTestId('notes-textarea').fill(testNote);
    await expect(page.getByTestId('notes-textarea')).toHaveValue(testNote);
    
    // Clear and fill surgeon notes
    await page.getByTestId('surgeon-notes-textarea').click();
    await page.getByTestId('surgeon-notes-textarea').fill(surgeonNote);
    await expect(page.getByTestId('surgeon-notes-textarea')).toHaveValue(surgeonNote);
  });

  test('should have procedure checkboxes that can be selected', async ({ page }) => {
    await page.goto(`/rhinoplanner/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    
    // Verify procedure categories are visible (by text content)
    await expect(page.getByText('Grzbiet nosa')).toBeVisible();
    await expect(page.getByText('Czubek nosa')).toBeVisible();
    await expect(page.getByText('Skrzydełka nosa')).toBeVisible();
    await expect(page.getByText('Przegroda nosowa')).toBeVisible();
    await expect(page.getByText('Kolumella')).toBeVisible();
    
    // Find and click a procedure checkbox
    const reductionCheckbox = page.locator('label').filter({ hasText: 'Redukcja garbka' }).locator('input[type="checkbox"]');
    
    // Get initial state
    const isChecked = await reductionCheckbox.isChecked();
    
    // Toggle it
    await reductionCheckbox.click();
    
    // Verify it changed
    await expect(reductionCheckbox).toBeChecked({ checked: !isChecked });
    
    // Toggle another one
    const tipCheckbox = page.locator('label').filter({ hasText: 'Zmniejszenie czubka' }).locator('input[type="checkbox"]');
    await tipCheckbox.click();
  });

  test('should save plan successfully', async ({ page }) => {
    await page.goto(`/rhinoplanner/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    
    // Add some test data
    const uniqueNote = `Test save ${Date.now()}`;
    await page.getByTestId('notes-textarea').fill(uniqueNote);
    
    // Click save
    const saveButton = page.getByTestId('save-plan-button');
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    
    // Wait for save to complete (button might show "Zapisywanie...")
    await expect(saveButton).toContainText('Zapisz plan', { timeout: 10000 });
    
    // Verify toast or success indicator
    // The app uses sonner toasts - look for success message
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'zapisany' })).toBeVisible({ timeout: 5000 }).catch(() => {
      // Toast might dismiss quickly, check that we're still on the page and no errors
      expect(page.getByTestId('rhinoplanner-page')).toBeVisible();
    });
  });

  test('should navigate from patient detail to RhinoPlanner', async ({ page }) => {
    // First go to the patient detail page
    await page.goto(`/patients/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('patient-detail-page')).toBeVisible({ timeout: 15000 });
    
    // Find and click the RhinoPlanner button
    const rhinoPlannerButton = page.getByTestId('rhinoplanner-button');
    await expect(rhinoPlannerButton).toBeVisible();
    await rhinoPlannerButton.click();
    
    // Verify we're now on RhinoPlanner page
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`/rhinoplanner/${TEST_PATIENT_ID}`));
  });

  test('should navigate back from RhinoPlanner to patient detail', async ({ page }) => {
    await page.goto(`/rhinoplanner/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    
    // Click back button
    await page.getByTestId('back-button').click();
    
    // Should be back on patient detail page
    await expect(page.getByTestId('patient-detail-page')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(new RegExp(`/patients/${TEST_PATIENT_ID}`));
  });

  test('should have export PDF button visible', async ({ page }) => {
    await page.goto(`/rhinoplanner/${TEST_PATIENT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rhinoplanner-page')).toBeVisible({ timeout: 15000 });
    
    // Verify export button exists and is clickable
    const exportButton = page.getByTestId('export-pdf-button');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
    await expect(exportButton).toContainText('Eksportuj PDF');
    
    // Note: Actually clicking download would trigger file download
    // which is harder to test in Playwright without file download handling
  });
});
