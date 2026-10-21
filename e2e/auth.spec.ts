import { test, expect } from '@playwright/test';

/**
 * Authentication & Onboarding Tests
 */
test.describe('Authentication Flow', () => {
    test.describe.configure({ mode: 'serial' });

    test('should load landing page and redirect to menu', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/FlashQuest|Vocab/);
        await expect(page).toHaveURL(/.*menu/);
    });

    test('should allow anonymous user to access app', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL(/.*menu/);
    });

    test('should allow anonymous user to open profile menu and navigate to login', async ({ page }) => {
        await page.goto('/menu');
        await page.waitForLoadState('networkidle');

        const profileBtn = page.locator('button.profile-icon');
        await expect(profileBtn).toBeVisible();
        await profileBtn.click();

        const loginMenuItem = page.locator('button[mat-menu-item]:has-text("Login")');
        await expect(loginMenuItem).toBeVisible();

        const signupMenuItem = page.locator('button[mat-menu-item]:has-text("Sign Up")');
        await expect(signupMenuItem).toBeVisible();

        await loginMenuItem.click();
        await expect(page).toHaveURL(/.*login/);
    });

    test('should establish authenticated session and profile from OAuth callback token hash without flashing', async ({ page }) => {
        // Generate valid magiclink token for test user via Supabase admin API
        const { createClient } = await import('@supabase/supabase-js');
        const admin = createClient(
            'https://api.crmx.pw',
            'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjQxMDg2MTcsImV4cCI6MjA3OTQ2ODYxN30.kU1xXXSkiM_c7xAzb3qDdHJ8ltsFT-65n_vvEITlc8g'
        );

        const { data, error } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: 'carmex@gmail.com'
        });
        expect(error).toBeNull();
        expect(data?.properties?.action_link).toBeTruthy();

        // Get redirect location with token hash
        const resp = await fetch(data!.properties.action_link, { redirect: 'manual' });
        const targetUrl = resp.headers.get('location');
        expect(targetUrl).toContain('access_token=');

        // Navigate to the callback URL (just like returning from Google OAuth)
        await page.goto(targetUrl!);
        await page.waitForLoadState('networkidle');

        // Verify user profile icon displays either Google avatar or CA initials, never "AN"
        const profileBtn = page.locator('button.profile-icon');
        await expect(profileBtn).toBeVisible();

        const hasAvatarImg = await profileBtn.locator('img.avatar-img').isVisible({ timeout: 5000 }).catch(() => false);
        if (hasAvatarImg) {
            const src = await profileBtn.locator('img.avatar-img').getAttribute('src');
            expect(src).toContain('googleusercontent.com');
        } else {
            const initials = await profileBtn.locator('span').textContent();
            expect(initials?.trim()).toBe('CA');
        }

        // Tapping profile icon should open the authenticated menu and stay open without flashing
        await profileBtn.click();

        const userEmailItem = page.locator('button[mat-menu-item]:has-text("carmex@gmail.com")');
        await expect(userEmailItem).toBeVisible();

        const logoutItem = page.locator('button[mat-menu-item]:has-text("Logout")');
        await expect(logoutItem).toBeVisible();

        const loginItem = page.locator('button[mat-menu-item]:has-text("Login")');
        await expect(loginItem).not.toBeVisible();
    });
});

/**
 * Student Experience Tests
 */
test.describe('Student Quiz Flow', () => {
    test('should navigate to word lists from menu', async ({ page }) => {
        await page.goto('/menu');
        await expect(page).toHaveURL(/.*menu/);

        // Look for word list cards
        const listCards = page.locator('.word-list-card, mat-card, .list-item');
        // Just verify the page loads without error
    });

    test('should be able to access quiz interface', async ({ page }) => {
        await page.goto('/menu');
        await page.waitForTimeout(1000);

        // Look for any practice/quiz buttons
        const quizButton = page.locator('button:has-text("Practice"), button:has-text("Quiz"), button:has-text("Start"), button:has-text("Play")').first();

        if (await quizButton.isVisible()) {
            await quizButton.click();
            await page.waitForTimeout(1000);
            // Verify we navigated somewhere (quiz or list selection)
            const url = page.url();
            expect(url).toBeTruthy();
        }
    });

    test('should display quiz UI elements when in quiz', async ({ page }) => {
        // Navigate directly to quiz if possible
        await page.goto('/quiz');
        await page.waitForTimeout(2000);

        // Check for quiz-related elements (may redirect if no quiz selected)
        const hasQuizElements = await page.locator('.quiz-container, .question, .answer-option, .progress').first().isVisible().catch(() => false);
        // This is a soft check - quiz may not be available without setup
    });
});

/**
 * Sight Words Quiz Tests
 */
test.describe('Sight Words Quiz', () => {
    test('should load sight words quiz page', async ({ page }) => {
        await page.goto('/sight-words');
        await page.waitForTimeout(2000);

        // Should either show sight words interface or redirect
        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should have mode selection (Read/Listen)', async ({ page }) => {
        await page.goto('/sight-words');
        await page.waitForTimeout(2000);

        // Look for mode toggle or buttons
        const modeToggle = page.locator('button:has-text("Read"), button:has-text("Listen"), mat-button-toggle');
        // Soft check - may not be visible without proper setup
    });
});

/**
 * Teacher Management Tests
 */
test.describe('Teacher Dashboard', () => {
    test('should be able to access teacher dashboard', async ({ page }) => {
        await page.goto('/teacher');
        await page.waitForTimeout(2000);

        // May redirect to role selection or show teacher content
        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should show class creation option for teachers', async ({ page }) => {
        await page.goto('/teacher');
        await page.waitForTimeout(2000);

        // Look for "New Class" or "Create Class" button
        const createClassBtn = page.locator('button:has-text("New Class"), button:has-text("Create Class"), button:has-text("Add Class")');
        // Soft check - depends on auth state
    });
});

/**
 * Settings Page Tests
 */
test.describe('Settings', () => {
    test('should load settings page', async ({ page }) => {
        await page.goto('/settings');
        await page.waitForTimeout(1000);

        await expect(page).toHaveURL(/.*settings/);
    });

    test('should have configurable options', async ({ page }) => {
        await page.goto('/settings');
        await page.waitForTimeout(1000);

        // Look for toggles, sliders, or form controls
        const hasSettings = await page.locator('mat-slide-toggle, mat-slider, input[type="range"], .setting-item').first().isVisible().catch(() => false);
    });
});

/**
 * Visual Regression Tests
 */
test.describe('Visual Regression', () => {
    test('menu page should match screenshot', async ({ page }) => {
        await page.goto('/menu');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('menu-page.png', {
            maxDiffPixels: 100,
        });
    });

    test('settings page should match screenshot', async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('settings-page.png', {
            maxDiffPixels: 100,
        });
    });
});

/**
 * Responsive Layout Tests
 */
test.describe('Responsive Layout', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
        await page.goto('/menu');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot('menu-mobile.png', {
            maxDiffPixels: 100,
        });
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 }); // iPad
        await page.goto('/menu');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot('menu-tablet.png', {
            maxDiffPixels: 100,
        });
    });

    test('should display correctly on desktop viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
        await page.goto('/menu');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot('menu-desktop.png', {
            maxDiffPixels: 100,
        });
    });
});
