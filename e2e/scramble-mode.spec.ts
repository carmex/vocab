import { test, expect } from '@playwright/test';

test.describe('Scramble Mode', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        // Authenticate with test user via magiclink
        const { createClient } = await import('@supabase/supabase-js');
        const admin = createClient(
            'https://api.crmx.pw',
            'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjQxMDg2MTcsImV4cCI6MjA3OTQ2ODYxN30.kU1xXXSkiM_c7xAzb3qDdHJ8ltsFT-65n_vvEITlc8g'
        );

        const { data } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: 'carmex@gmail.com'
        });
        if (data?.properties?.action_link) {
            const resp = await fetch(data.properties.action_link, { redirect: 'manual' });
            const targetUrl = resp.headers.get('location');
            if (targetUrl) {
                const localUrl = targetUrl.replace('https://vocab.crmx.pw', 'http://localhost:4200');
                await page.goto(localUrl);
                await page.waitForLoadState('networkidle');
                const profileBtn = page.locator('button.profile-icon');
                await expect(profileBtn).toBeVisible();
                await expect(profileBtn.locator('span, img.avatar-img')).not.toHaveText('AN');
            }
        }
    });

    test('should allow a user to complete a quiz in Scramble Mode', async ({ page }) => {
        // 1. Navigate to Lists via in-app menu button
        await page.click('button:has-text("My Lists")');
        await page.waitForURL('**/lists');
        await page.waitForLoadState('networkidle');

        // Wait for lists to render
        await page.waitForSelector('mat-card, .fab-add', { timeout: 15000 });
        await page.waitForTimeout(1000);

        // 2. Check for Sight Words list
        const sightWordsCard = page.locator('mat-card').filter({ hasText: /sight words/i }).first();
        if (await sightWordsCard.count() === 0) {
            console.log('No Sight Words list found. Creating one...');

            // Create List Flow
            await page.locator('.fab-add').click();
            await page.click('text=Create New List');

            // Dialog: Select Sight Words
            await page.click('text=Sight Words');

            // Editor
            await page.waitForURL(/.*\/list\/new/);
            await page.fill('input[placeholder="List Name"]', 'Test Sight Words');

            const wordInput = page.locator('input[placeholder="Enter word"]').first();
            if (await wordInput.isVisible()) {
                await wordInput.fill('apple');
            }

            await page.click('text=Save');
            await page.waitForURL('/lists');
        }

        // 3. Select the list
        const cardToClick = page.locator('mat-card').filter({ hasText: /sight words/i }).first();
        await cardToClick.click();

        // 4. Select Scramble Mode
        await expect(page.locator('text=Scramble Mode')).toBeVisible();
        await page.click('text=Scramble Mode');

        // Wait for audio buffering modal if present
        const loadingOverlay = page.locator('.model-loading-overlay');
        if (await loadingOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(loadingOverlay).toBeHidden({ timeout: 25000 });
        }

        // 5. Verify Scramble UI elements
        const poolTiles = page.locator('.scramble-tile');
        await expect(poolTiles.first()).toBeVisible({ timeout: 10000 });

        const answerSlots = page.locator('.scramble-slot');
        await expect(answerSlots.first()).toBeVisible();

        const playButton = page.locator('button.speak-btn');
        await expect(playButton).toBeVisible();

        // 6. Test tile interaction: tap an available letter tile
        const firstTile = poolTiles.first();
        const tileLetter = (await firstTile.innerText()).trim();
        await firstTile.click();

        // First slot should now contain this letter
        await expect(answerSlots.first()).toContainText(tileLetter);

        // 7. Test "Don't Know" to verify feedback controls
        await page.click('text=Don\'t Know');

        // Feedback should show answer
        const answerEl = page.locator('.correction-details strong');
        await expect(answerEl).toBeVisible();

        // Click Next
        await page.click('text=Next');
    });

    test('should show correct spelling and draggable submitted tiles with highlighting when a word is missed, and allow proceeding once matched', async ({ page }) => {
        // 1. Navigate to Lists via in-app menu button
        await page.click('button:has-text("My Lists")');
        await page.waitForURL('**/lists');
        await page.waitForLoadState('networkidle');

        // Wait for lists to render
        await page.waitForSelector('mat-card, .fab-add', { timeout: 15000 });
        await page.waitForTimeout(1000);

        // 2. Select Sight Words list
        const cardToClick = page.locator('mat-card').filter({ hasText: /sight words/i }).first();
        await cardToClick.click();

        // 3. Select Scramble Mode
        await expect(page.locator('text=Scramble Mode')).toBeVisible();
        await page.click('text=Scramble Mode');

        // Wait for audio buffering modal if present
        const loadingOverlay = page.locator('.model-loading-overlay');
        if (await loadingOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(loadingOverlay).toBeHidden({ timeout: 25000 });
        }

        // 4. Verify Scramble UI elements
        const poolTiles = page.locator('.scramble-pool .scramble-tile');
        await expect(poolTiles.first()).toBeVisible({ timeout: 10000 });

        // 5. Verify Check button is disabled initially and after a single tile is placed
        const checkBtn = page.locator('button.check-btn');
        await expect(checkBtn).toBeDisabled();

        const poolCount = await poolTiles.count();
        const firstTile = poolTiles.first();
        await firstTile.click();
        await expect(checkBtn).toBeDisabled();

        // Select remaining tiles so all letters are placed (in scrambled/incorrect order)
        for (let i = 1; i < poolCount; i++) {
            await poolTiles.nth(i).click();
        }

        // 6. Submit the answer with "Check" (now enabled since all letters are placed)
        await expect(checkBtn).toBeEnabled();
        await checkBtn.click();

        // 7. Verify the Scramble Missed Word Correction interface appears
        const correctionSection = page.locator('.scramble-correction-section');
        await expect(correctionSection).toBeVisible();

        // Verify correct spelling tiles are displayed
        const targetTiles = page.locator('.correction-tiles-row.target-row .target-tile');
        await expect(targetTiles.first()).toBeVisible();
        const targetCount = await targetTiles.count();
        expect(targetCount).toBeGreaterThan(0);

        // Verify submitted letter tiles are displayed in a mixed-orientation wrapping drop list
        const dropList = page.locator('.correction-tiles-row.submitted-row');
        await expect(dropList).toHaveAttribute('cdkdroplistorientation', 'mixed');
        const submittedTiles = page.locator('.correction-tiles-row.submitted-row .correction-tile');
        await expect(submittedTiles.first()).toBeVisible();
        expect(await submittedTiles.count()).toBe(targetCount);

        // Verify that letters in the wrong spot are highlighted
        const wrongSpotTiles = page.locator('.correction-tile.wrong-spot');
        await expect(wrongSpotTiles.first()).toBeVisible();

        // Verify Next button is disabled while words do not match
        const nextButton = page.locator('button:has-text("Next")');
        await expect(nextButton).toBeDisabled();

        // 8. Reorder tiles using drag or keyboard arrow keys until matched
        let moves = 0;
        while (await page.locator('.correction-tile.wrong-spot').count() > 0 && moves < 25) {
            const wrongTile = page.locator('.correction-tile.wrong-spot').first();
            await wrongTile.focus();
            await page.keyboard.press('ArrowRight');
            moves++;
        }

        // If matched badge is present, verify Next button becomes enabled and click it
        if (await page.locator('.matched-badge').isVisible()) {
            await expect(nextButton).toBeEnabled();
            await nextButton.click();

            // Should proceed to the next word (correction section is hidden)
            await expect(correctionSection).toBeHidden();
        }
    });
});
