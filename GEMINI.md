# Project Context & Preferences

## Development Methodology: TDD (Test-Driven Development)

This project strictly follows a **Test-Driven Development (TDD)** workflow.
**No new features should be implemented without corresponding tests.**

### The Workflow: Red-Green-Refactor
1.  **Red**: Write a failing test for the new functionality or bug fix.
    *   Confirm the test fails (or fails to compile) before writing any implementation code.
    *   Run tests to demonstrate the failure.
2.  **Green**: Write the *minimum* amount of code necessary to make the test pass.
3.  **Refactor**: Clean up the code while ensuring tests still pass. This includes resolving any build or test warnings.

## Test Environment

The project uses two distinct testing frameworks. **Do not confuse them.**

### 1. Unit & Integration Tests (Jest)
*   **Framework**: [Jest](https://jestjs.io/) with `jest-preset-angular`.
*   **Use Cases**: Testing individual components, services, pipes, utility functions, and business logic.
*   **File Naming**: `*.spec.ts` (usually alongside the component/service file).
*   **Running Tests**:
    ```bash
    npm test
    # or
    npx jest
    ```

### 2. End-to-End (E2E) Tests (Playwright)
*   **Framework**: [Playwright](https://playwright.dev/).
*   **Use Cases**: Testing full user flows, browser interactions, routing, and real-world scenarios.
*   **Location**: `e2e/` directory.
*   **Running Tests**:
    ```bash
    npm run test:e2e
    # or
    npx playwright test
    ```
    *   *Note: `npm run test:audio` runs specific audio recognition tests.*

## Important Rules
*   **Tests First**: Always start with a test.
*   **Verify Failure**: You must see the test fail to confirm it is testing the right thing.
*   **No Untested Features**: Every new feature must have coverage.
*   **Correct Tool**: Use Jest for unit logic and Playwright for browser flows.
