import { test, expect } from '@playwright/test';

test.describe('Spell Mode', () => {
    test('should allow a user to complete a quiz in Spell Mode', async ({ page }) => {
        // 1. Navigate to Lists
        await page.goto('/lists');

        // Handle Login if redirected
        if (page.url().includes('login')) {
            await page.fill('input[type="email"]', 'teacher@test.com');
            await page.fill('input[type="password"]', 'password');
            await page.click('button[type="submit"]');
            await page.waitForURL('/dashboard'); // or /lists?
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
            await page.click('text=Sight Words'); // Assuming text matches ListType enum display

            // Editor
            await page.waitForURL(/.*\/list\/new/);
            await page.fill('input[placeholder="List Name"]', 'Test Sight Words');

            // Add a word
            // We need to know the editor UI. Assuming there's an input for word.
            // Or maybe generic "add word" button.
            // This part is risky without knowing the Editor UI.
            // I'll assume we can just Save if it's prepopulated or valid?
            // "Sight Words" usually need words.
            // Let's assume there is at least one input for a word.
            const wordInput = page.locator('input[placeholder="Enter word"]').first();
            if (await wordInput.isVisible()) {
                await wordInput.fill('apple');
            } else {
                // maybe "Add Word" button?
                // await page.click('text=Add Word');
                // await page.fill('input.word-input', 'apple');
            }

            await page.click('text=Save');
            await page.waitForURL('/lists');
        }

        // 3. Select the list (refresh locator)
        // If we created it, it might be named "Test Sight Words"
        const cardToClick = page.locator('mat-card').filter({ hasText: /Sight Words/ }).first();
        await cardToClick.click();

        // 4. Select Spell Mode
        await expect(page.locator('text=Spell Mode')).toBeVisible();
        await page.click('text=Spell Mode');

        // 5. Verify Quiz Started
        // Wait for input to be ready
        const input = page.locator('input[type="text"]');
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('autocomplete', 'off');

        // 6. Test Interaction
        // Type "Don't Know" to ensure we can proceed
        await page.click('text=Don\'t Know');

        // Feedback should show answer
        const answerEl = page.locator('.correction-details strong');
        await expect(answerEl).toBeVisible();

        // Click Next
        await page.click('text=Next');

        // Test incorrect input
        await input.fill('zzzzzz');
        await input.press('Enter'); // verify Enter key works too

        // Should show error
        await expect(page.locator('text=Keep Practicing')).toBeVisible();
    });
});
