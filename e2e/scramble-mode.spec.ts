import { test, expect } from '@playwright/test';

test.describe('Scramble Mode', () => {
    test('should allow a user to complete a quiz in Scramble Mode', async ({ page }) => {
        // 1. Navigate to Lists
        await page.goto('/lists');

        // Handle Login if redirected
        if (page.url().includes('login')) {
            await page.fill('input[type="email"]', 'teacher@test.com');
            await page.fill('input[type="password"]', 'password');
            await page.click('button[type="submit"]');
            await page.waitForURL('/dashboard');
            await page.goto('/lists');
        }

        // 2. Check for Sight Words list
        const sightWordsCard = page.locator('mat-card').filter({ hasText: 'Sight Words' }).first();
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
        const cardToClick = page.locator('mat-card').filter({ hasText: /Sight Words/ }).first();
        await cardToClick.click();

        // 4. Select Scramble Mode
        await expect(page.locator('text=Scramble Mode')).toBeVisible();
        await page.click('text=Scramble Mode');

        // 5. Verify Scramble UI elements
        const poolTiles = page.locator('.scramble-tile');
        await expect(poolTiles.first()).toBeVisible();

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
});
